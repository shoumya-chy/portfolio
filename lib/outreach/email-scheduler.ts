import { listProspects, saveProspect, getStats, recalculateStats } from "@/lib/outreach/storage";
import type { OutreachProject } from "@/lib/outreach/types";
import { composeOutreachEmail } from "@/lib/api-clients/claude-email-composer";
import { sendEmail } from "@/lib/api-clients/email-client";
import { getSites } from "@/lib/config";

export async function sendOutreachBatch(
  project: OutreachProject
): Promise<{ sent: number; errors: string[] }> {
  const errors: string[] = [];
  let sent = 0;

  try {
    const stats = getStats(project.id);

    // Reset weekly counter if needed
    const now = new Date();
    const weekStart = new Date(stats.weekStart);
    const daysSinceWeekStart = Math.floor((now.getTime() - weekStart.getTime()) / (1000 * 60 * 60 * 24));
    let emailsSentThisWeek = stats.emailsSentThisWeek;

    if (daysSinceWeekStart >= 7) {
      emailsSentThisWeek = 0;
    }

    const emailsPerWeek = project.emailsPerWeek || 20;
    const remainingQuota = emailsPerWeek - emailsSentThisWeek;

    if (remainingQuota <= 0) {
      return { sent: 0, errors: [] };
    }

    // Get siteUrl from project's site config
    const sites = getSites();
    const site = sites.find((s) => s.id === project.siteId);
    const siteUrl = site?.url || project.emailAddress.split("@")[1] || "";

    // Get prospects ready to email (only those with contact emails)
    const prospects = listProspects(project.id, "found").filter(p => p.contactEmail);
    const batch = prospects.slice(0, remainingQuota);

    for (const prospect of batch) {
      try {
        // composeOutreachEmail(senderName, senderSite, niche, targetDomain, targetPageTitle)
        const emailContent = await composeOutreachEmail(
          project.name,
          siteUrl,
          project.niche,
          prospect.targetDomain,
          prospect.writeForUsPage
        );

        // sendEmail(smtpConfig, from, options)
        const messageId = await sendEmail(project.smtpConfig, project.emailAddress, {
          to: prospect.contactEmail,
          subject: emailContent.subject,
          html: `<p>${emailContent.body.replace(/\n/g, "<br/>")}</p>`,
          text: emailContent.body,
        });

        // Update prospect
        prospect.state = "emailed";
        prospect.lastEmailSentAt = new Date().toISOString();
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
        errors.push(`Failed to email ${prospect.contactEmail}: ${msg}`);
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
