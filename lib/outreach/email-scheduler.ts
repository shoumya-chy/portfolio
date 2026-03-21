import { listProspects, saveProspect, getStats, recalculateStats } from "@/lib/outreach/storage";
import type { OutreachProject } from "@/lib/outreach/types";
import { composeOutreachEmail } from "@/lib/api-clients/claude-email-composer";
import { sendEmail } from "@/lib/api-clients/email-client";
import { getSites } from "@/lib/config";
import { matchProspectToTarget, chooseAnchorStrategy } from "@/lib/outreach/backlink-strategy";

/**
 * Phase 2: Smart outreach batch.
 *
 * For each prospect:
 * 1. Match to the highest-priority post that fits the prospect's niche
 * 2. Choose anchor strategy based on backlink profile
 * 3. Generate personalized email with 2-3 topic ideas
 * 4. Send and track
 */
export async function sendOutreachBatch(
  project: OutreachProject
): Promise<{ sent: number; errors: string[] }> {
  const errors: string[] = [];
  let sent = 0;

  try {
    const stats = getStats(project.id);
    const now = new Date();
    const weekStart = new Date(stats.weekStart);
    const daysSinceWeekStart = Math.floor((now.getTime() - weekStart.getTime()) / (1000 * 60 * 60 * 24));
    let emailsSentThisWeek = stats.emailsSentThisWeek;
    if (daysSinceWeekStart >= 7) emailsSentThisWeek = 0;

    const remainingQuota = (project.emailsPerWeek || 20) - emailsSentThisWeek;
    if (remainingQuota <= 0) return { sent: 0, errors: [] };

    const sites = getSites();
    const site = sites.find(s => s.id === project.siteId);
    const siteUrl = site?.url || project.emailAddress.split("@")[1] || "";

    // Get prospects with contact emails, sorted by DA (high DA first)
    const prospects = listProspects(project.id, "found")
      .filter(p => p.contactEmail)
      .sort((a, b) => (b.domainAuthority || 0) - (a.domainAuthority || 0));

    const batch = prospects.slice(0, remainingQuota);

    for (const prospect of batch) {
      try {
        // Phase 2 Step 1: Match to best backlink target
        const target = await matchProspectToTarget(
          project.id,
          siteUrl,
          prospect.siteNiche || project.niche
        );

        // Phase 2 Step 2: Choose anchor strategy
        let anchorText = "";
        let anchorStrategy: "partial-match" | "natural" | "branded" = "natural";
        if (target) {
          const strategy = chooseAnchorStrategy(
            target.title,
            target.focusKeyword || "",
            target.backlinkCount
          );
          anchorText = strategy.anchorText;
          anchorStrategy = strategy.strategy;
        }

        // Phase 2 Step 3: Generate personalized email
        const emailContent = await composeOutreachEmail(
          project.name,
          siteUrl,
          project.niche,
          prospect.targetDomain,
          prospect.writeForUsPage
        );

        // Phase 2 Step 4: Send
        const messageId = await sendEmail(project.smtpConfig, project.emailAddress, {
          to: prospect.contactEmail,
          subject: emailContent.subject,
          html: `<p>${emailContent.body.replace(/\n/g, "<br/>")}</p>`,
          text: emailContent.body,
        });

        // Update prospect with Phase 2 data
        prospect.state = "emailed";
        prospect.lastEmailSentAt = new Date().toISOString();
        prospect.matchedPostUrl = target?.url || "";
        prospect.matchedPostTitle = target?.title || "";
        prospect.anchorText = anchorText;
        prospect.anchorStrategy = anchorStrategy;
        prospect.outboundEmails.push({
          sentAt: new Date().toISOString(),
          from: project.emailAddress,
          to: prospect.contactEmail,
          subject: emailContent.subject,
          body: emailContent.body,
          messageId,
        });
        saveProspect(prospect);
        sent++;
      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        errors.push(`Failed ${prospect.contactEmail}: ${msg}`);
      }
    }

    recalculateStats(project.id);
    return { sent, errors };
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    errors.push(`Batch error: ${msg}`);
    return { sent, errors };
  }
}
