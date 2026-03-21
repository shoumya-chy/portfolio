import {
  getProspect,
  saveProspect,
  saveGeneratedContent,
  logBacklink,
} from "@/lib/outreach/storage";
import type { OutreachProject } from "@/lib/outreach/types";
import { canTransition } from "@/lib/outreach/state-machine";
import { calculateBacklinkTargets, chooseAnchorStrategy } from "@/lib/outreach/backlink-strategy";
import { scrapePageContent } from "@/lib/api-clients/content-scraper";
import { generateGuestPost } from "@/lib/api-clients/claude-guest-post-generator";
import { sendEmail } from "@/lib/api-clients/email-client";
import { getSites } from "@/lib/config";
import { fetchWordPressData } from "@/lib/api-clients/wordpress-client";

interface ContentPipelineResult {
  success: boolean;
  error?: string;
}

/**
 * Phase 3: Generate and send content with full context.
 */
export async function generateAndSendContent(
  project: OutreachProject,
  prospectId: string
): Promise<ContentPipelineResult> {
  try {
    const prospect = getProspect(project.id, prospectId);
    if (!prospect) return { success: false, error: `Prospect ${prospectId} not found` };
    if (prospect.state !== "agreed") return { success: false, error: `State "${prospect.state}", expected "agreed"` };
    if (!canTransition(prospect.state, "content_sent")) return { success: false, error: `Cannot transition` };

    // Step 1: Re-scrape target site for guidelines + style
    let styleText = "", guidelinesText = "";
    try {
      const scraped = await scrapePageContent(prospect.writeForUsPage);
      guidelinesText = scraped.bodyText.slice(0, 3000);
      styleText = scraped.sampleParagraphs.join("\n\n") || scraped.bodyText.slice(0, 2000);
    } catch { styleText = "Professional blog style"; }

    // Step 2: Get site config
    const sites = getSites();
    const site = sites.find(s => s.id === project.siteId);
    const siteUrl = site?.url || "";

    // Step 3: Fetch full WP post content for the matched target
    let matchedPostContent = "", matchedPostTitle = prospect.matchedPostTitle || "", matchedPostUrl = prospect.matchedPostUrl || "";
    if (siteUrl && matchedPostUrl) {
      try {
        const wpData = await fetchWordPressData(siteUrl);
        if (wpData) {
          const matchedPost = wpData.content.find(p =>
            p.url.replace(/\/$/, "").toLowerCase() === matchedPostUrl.replace(/\/$/, "").toLowerCase()
          );
          if (matchedPost) {
            matchedPostTitle = matchedPost.title;
            matchedPostContent = matchedPost.excerpt || "";
            if (matchedPost.headings.length > 0) {
              matchedPostContent += "\n\nArticle structure:\n" + matchedPost.headings.map(h => `${"  ".repeat(h.level - 1)}${h.text}`).join("\n");
            }
          }
        }
      } catch { /* use basic info */ }
    }

    // Step 4: Backlink targets + anchor strategy
    const backlinkTargets = await calculateBacklinkTargets(project.id, siteUrl);
    let anchorText = prospect.anchorText || "";
    if (!anchorText && backlinkTargets.length > 0) {
      anchorText = chooseAnchorStrategy(backlinkTargets[0].title, backlinkTargets[0].focusKeyword || "", backlinkTargets[0].backlinkCount).anchorText;
    }

    // Step 5: Generate with full context
    const guestPost = await generateGuestPost(
      project.niche, prospect.targetDomain, styleText, siteUrl, backlinkTargets,
      { guidelines: guidelinesText, matchedPostTitle, matchedPostUrl, matchedPostContent, anchorText, anchorStrategy: prospect.anchorStrategy || "natural" }
    );

    // Step 6: Save + send
    saveGeneratedContent(project.id, prospectId, guestPost);
    for (const bl of guestPost.backlinks) logBacklink(project.id, bl.url);

    const emailSubject = `Guest Post for ${prospect.targetDomain}: ${guestPost.title}`;
    const emailHtml = composeDeliveryEmail(guestPost.title, guestPost.body, siteUrl);

    await sendEmail(project.smtpConfig, project.emailAddress, {
      to: prospect.contactEmail, subject: emailSubject, html: emailHtml, text: guestPost.body,
    });

    prospect.state = "content_sent";
    prospect.contentSentAt = new Date().toISOString();
    prospect.outboundEmails.push({ sentAt: new Date().toISOString(), from: project.emailAddress, to: prospect.contactEmail, subject: emailSubject, body: guestPost.body.slice(0, 500) });
    saveProspect(prospect);

    return { success: true };
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Unknown error";
    console.log("[ContentPipeline] Error:", msg);
    return { success: false, error: msg };
  }
}

function composeDeliveryEmail(title: string, body: string, senderSite: string): string {
  const esc = (s: string) => s.replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" }[c] || c));
  return `<!DOCTYPE html><html><head><style>body{font-family:-apple-system,sans-serif;line-height:1.6;color:#333}.c{max-width:800px;margin:0 auto;padding:20px}.a{background:#f9f9f9;padding:20px;border-left:4px solid #0066cc;margin:20px 0}.f{margin-top:30px;color:#666;font-size:14px}</style></head><body><div class="c"><p>Hi,</p><p>Thanks for accepting our guest post! Here's the article:</p><div class="a"><h2>${esc(title)}</h2><div style="margin-top:20px;white-space:pre-wrap">${esc(body)}</div></div><div class="f"><p>Let us know if you'd like any changes.</p><p>Best,<br/>${esc(senderSite)}</p></div></div></body></html>`;
}
