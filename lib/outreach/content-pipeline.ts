import {
  getProspect,
  saveProspect,
  saveGeneratedContent,
  logBacklink,
} from "@/lib/outreach/storage";
import type { OutreachProject } from "@/lib/outreach/types";
import { canTransition } from "@/lib/outreach/state-machine";
import { calculateBacklinkTargets } from "@/lib/outreach/backlink-strategy";
import { scrapePageContent } from "@/lib/api-clients/content-scraper";
import { generateGuestPost } from "@/lib/api-clients/claude-guest-post-generator";
import { sendEmail } from "@/lib/api-clients/email-client";
import { getSites } from "@/lib/config";

interface ContentPipelineResult {
  success: boolean;
  error?: string;
}

/**
 * Orchestrates the full content generation pipeline for an agreed prospect.
 */
export async function generateAndSendContent(
  project: OutreachProject,
  prospectId: string
): Promise<ContentPipelineResult> {
  try {
    // Step 1: Get prospect and verify state
    const prospect = getProspect(project.id, prospectId);
    if (!prospect) {
      return { success: false, error: `Prospect ${prospectId} not found` };
    }

    if (prospect.state !== "agreed") {
      return { success: false, error: `Prospect state is "${prospect.state}", expected "agreed"` };
    }

    if (!canTransition(prospect.state, "content_sent")) {
      return { success: false, error: `Cannot transition from "${prospect.state}" to "content_sent"` };
    }

    // Step 2: Scrape target site for writing style
    let styleText = "";
    try {
      const scraped = await scrapePageContent(prospect.targetUrl);
      styleText = scraped.sampleParagraphs.join("\n\n");
      if (!styleText) styleText = scraped.bodyText.slice(0, 2000);
    } catch {
      styleText = "Professional, informative blog style";
    }

    // Step 3: Get siteUrl from project's site config
    const sites = getSites();
    const site = sites.find((s) => s.id === project.siteId);
    const siteUrl = site?.url || "";

    // Step 4: Calculate backlink targets
    const backlinkTargets = await calculateBacklinkTargets(project.id, siteUrl);

    // Step 5: Generate guest post
    const guestPost = await generateGuestPost(
      project.niche,
      prospect.targetDomain,
      styleText,
      siteUrl,
      backlinkTargets
    );

    // Step 6: Save generated content
    saveGeneratedContent(project.id, prospectId, guestPost);

    // Step 7: Log backlinks used
    for (const bl of guestPost.backlinks) {
      logBacklink(project.id, bl.url);
    }

    // Step 8: Compose and send delivery email
    const emailSubject = `Guest Post for ${prospect.targetDomain}: ${guestPost.title}`;
    const emailHtml = composeDeliveryEmail(guestPost.title, guestPost.body, siteUrl);

    await sendEmail(project.smtpConfig, project.emailAddress, {
      to: prospect.contactEmail,
      subject: emailSubject,
      html: emailHtml,
      text: guestPost.body,
    });

    // Step 9: Update prospect state
    prospect.state = "content_sent";
    prospect.contentSentAt = new Date().toISOString();
    prospect.outboundEmails.push({
      sentAt: new Date().toISOString(),
      from: project.emailAddress,
      to: prospect.contactEmail,
      subject: emailSubject,
      body: guestPost.body.slice(0, 500),
    });
    saveProspect(prospect);

    return { success: true };
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Unknown error";
    console.log("[ContentPipeline] Error:", msg);
    return { success: false, error: `Content pipeline failed: ${msg}` };
  }
}

function composeDeliveryEmail(title: string, body: string, senderSite: string): string {
  const escapedTitle = escapeHtml(title);
  const escapedSite = escapeHtml(senderSite);
  return `<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 800px; margin: 0 auto; padding: 20px; }
    .article { background: #f9f9f9; padding: 20px; border-left: 4px solid #0066cc; margin: 20px 0; }
    .footer { margin-top: 30px; color: #666; font-size: 14px; }
  </style>
</head>
<body>
  <div class="container">
    <p>Hi,</p>
    <p>Thanks for accepting our guest post! Here's the article we've prepared for your publication.</p>
    <div class="article">
      <h2>${escapedTitle}</h2>
      <div style="margin-top: 20px; white-space: pre-wrap;">${escapeHtml(body)}</div>
    </div>
    <div class="footer">
      <p>Please let us know if you'd like any changes to better fit your publication's style.</p>
      <p>Best regards,<br/>${escapedSite}</p>
    </div>
  </div>
</body>
</html>`;
}

function escapeHtml(text: string): string {
  const map: Record<string, string> = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" };
  return text.replace(/[&<>"']/g, (c) => map[c]);
}
