import { listProspects, saveProspect, getStats, recalculateStats, saveStats, getTodayDate, purgeDeadProspects } from "@/lib/outreach/storage";
import type { OutreachProject, OutreachProspect } from "@/lib/outreach/types";
import { composeOutreachEmail } from "@/lib/api-clients/claude-email-composer";
import { sendEmail } from "@/lib/api-clients/email-client";
import { getSites } from "@/lib/config";
import { matchProspectToTarget, chooseAnchorStrategy, calculateBacklinkTargets } from "@/lib/outreach/backlink-strategy";
import { selectTopicsForProspect } from "@/lib/outreach/topic-selector";
import { logJob, completeJob, failJob } from "@/lib/outreach/job-runner";
import { composeFollowUpEmail } from "@/lib/outreach/follow-up";

const DELAY_BETWEEN_EMAILS_MS = 3000;

function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Get the proper "From" header with name + email.
 * e.g. "Shoumya Chowdhury <shoumya@example.com>"
 */
function formatSenderFrom(project: OutreachProject): string {
  const name = project.senderName || project.name;
  return `"${name}" <${project.emailAddress}>`;
}

/**
 * Send a batch of outreach emails.
 *
 * New flow for each prospect:
 * 1. Match to best backlink target (from cached SEO data)
 * 2. Select smart topics (Claude analyzes prospect niche + our SEO needs)
 * 3. Compose convincing email with specific topic pitches
 * 4. Send via SMTP
 *
 * Reports progress via the job runner so the frontend can poll for updates.
 */
export async function sendOutreachBatch(
  project: OutreachProject,
  batchSize?: number
): Promise<{ sent: number; errors: string[]; skipped: string }> {
  const errors: string[] = [];
  let sent = 0;
  let skipped = "";

  try {
    const stats = getStats(project.id);
    const todayDate = getTodayDate();

    let emailsSentToday = stats.emailsSentToday || 0;
    if (stats.todayDate !== todayDate) emailsSentToday = 0;

    const dailyLimit = batchSize || project.emailsPerDay || 20;
    const remainingToday = dailyLimit - emailsSentToday;

    if (remainingToday <= 0) {
      skipped = `Daily quota reached (${emailsSentToday}/${dailyLimit} sent today). Try again tomorrow.`;
      logJob(project.id, skipped);
      return { sent: 0, errors: [], skipped };
    }

    const sites = getSites();
    const site = sites.find(s => s.id === project.siteId);
    const siteUrl = site?.url || project.emailAddress.split("@")[1] || "";
    const senderFrom = formatSenderFrom(project);
    const senderName = project.senderName || project.name;

    const prospects = listProspects(project.id, "found")
      .filter(p => p.contactEmail)
      .sort((a, b) => (b.domainAuthority || 0) - (a.domainAuthority || 0));

    if (prospects.length === 0) {
      skipped = "No prospects with contact emails in 'found' state. Run Find Sites or Bulk Find first.";
      logJob(project.id, skipped);
      return { sent: 0, errors: [], skipped };
    }

    // Pre-calculate backlink targets once (uses cached data, no API calls)
    logJob(project.id, "Loading SEO data from cache...", 0, prospects.length);
    const backlinkTargets = await calculateBacklinkTargets(project.id, siteUrl);

    const batch = prospects.slice(0, remainingToday);
    logJob(project.id, `Sending batch of ${batch.length} emails (${backlinkTargets.length} backlink targets loaded)...`, 0, batch.length);

    for (let i = 0; i < batch.length; i++) {
      const prospect = batch[i];
      try {
        // Step 1: Match to best backlink target (20s timeout)
        logJob(project.id, `[${i + 1}/${batch.length}] Matching ${prospect.targetDomain} to backlink target...`, i, batch.length);
        const target = await Promise.race([
          matchProspectToTarget(project.id, siteUrl, prospect.siteNiche || project.niche),
          new Promise<null>((resolve) => setTimeout(() => resolve(null), 20000)),
        ]);

        // Step 2: Choose anchor strategy
        let anchorText = "";
        let anchorStrategy: "partial-match" | "natural" | "branded" = "natural";
        if (target) {
          const strategy = chooseAnchorStrategy(target.title, target.focusKeyword || "", target.backlinkCount);
          anchorText = strategy.anchorText;
          anchorStrategy = strategy.strategy;
        }

        // Step 3: Select smart topics based on prospect niche + our SEO needs
        logJob(project.id, `[${i + 1}/${batch.length}] Selecting topics for ${prospect.targetDomain} (niche: ${prospect.siteNiche || "unknown"})...`, i, batch.length);
        let topics = await Promise.race([
          selectTopicsForProspect(
            prospect.targetDomain,
            prospect.siteNiche || "",
            prospect.guidelinesSnippet || "",
            siteUrl,
            project.niche,
            backlinkTargets
          ),
          new Promise<never[]>((resolve) => setTimeout(() => resolve([]), 30000)),
        ]);

        // Fallback if topic selection failed
        if (!topics || topics.length === 0) {
          topics = [{
            topic: `Expert Guide on ${project.niche}`,
            angle: "Actionable insights from real experience",
            targetPage: target?.url || siteUrl,
            targetKeyword: target?.focusKeyword || project.niche,
            whyRelevant: `Relevant to ${prospect.siteNiche || prospect.targetDomain} readers`,
          }];
        }

        // Step 4: Compose convincing email with topic pitches
        logJob(project.id, `[${i + 1}/${batch.length}] Composing email for ${prospect.targetDomain} (${topics.length} topics)...`, i, batch.length);
        const emailContent = await composeOutreachEmail(
          senderName, siteUrl, project.niche,
          prospect.targetDomain, prospect.pageTitle || prospect.writeForUsPage,
          topics
        );

        // Step 5: Send via SMTP with proper From header
        logJob(project.id, `[${i + 1}/${batch.length}] Sending to ${prospect.contactEmail}...`, i, batch.length);
        const messageId = await sendEmail(project.smtpConfig, senderFrom, {
          to: prospect.contactEmail,
          subject: emailContent.subject,
          html: `<p>${emailContent.body.replace(/\n/g, "<br/>")}</p>`,
          text: emailContent.body,
        });

        // Update prospect with all the intelligence
        prospect.state = "emailed";
        prospect.lastEmailSentAt = new Date().toISOString();
        prospect.matchedPostUrl = target?.url || "";
        prospect.matchedPostTitle = target?.title || "";
        prospect.anchorText = anchorText;
        prospect.anchorStrategy = anchorStrategy;
        prospect.pitchedTopics = topics.map(t => t.topic);
        prospect.followUpCount = 0;
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

        // Immediately update daily count to prevent over-sending
        const currentStats = getStats(project.id);
        currentStats.emailsSentToday = (currentStats.emailsSentToday || 0) + 1;
        currentStats.todayDate = todayDate;
        saveStats(project.id, currentStats);

        logJob(project.id, `[${i + 1}/${batch.length}] ✓ Sent to ${prospect.contactEmail} — Topics: ${topics.map(t => t.topic).join(" | ")}`, i + 1, batch.length);

        // Delay between emails
        if (i < batch.length - 1) await sleep(DELAY_BETWEEN_EMAILS_MS);
      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        errors.push(`Failed ${prospect.contactEmail}: ${msg}`);
        logJob(project.id, `[${i + 1}/${batch.length}] ✗ FAILED ${prospect.contactEmail}: ${msg}`, i + 1, batch.length);
      }
    }

    recalculateStats(project.id);
    return { sent, errors, skipped };
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    errors.push(`Batch error: ${msg}`);
    return { sent, errors, skipped };
  }
}

/**
 * Send follow-up emails to prospects who haven't responded.
 * Called during daily run.
 */
export async function sendFollowUpBatch(
  project: OutreachProject
): Promise<{ sent: number; errors: string[] }> {
  const errors: string[] = [];
  let sent = 0;

  const followUpDays = project.followUpDays || 5;
  const maxFollowUps = project.maxFollowUps || 2;
  const senderFrom = formatSenderFrom(project);
  const senderName = project.senderName || project.name;

  const emailed = listProspects(project.id, "emailed").filter(p => {
    if (!p.lastEmailSentAt || !p.contactEmail) return false;
    const followUpCount = p.followUpCount || 0;
    if (followUpCount >= maxFollowUps) return false;

    // Check if enough days have passed since last email
    const lastSent = new Date(p.lastFollowUpAt || p.lastEmailSentAt);
    const daysSinceLast = (Date.now() - lastSent.getTime()) / (1000 * 60 * 60 * 24);
    return daysSinceLast >= followUpDays;
  });

  if (emailed.length === 0) return { sent: 0, errors: [] };

  // Check daily quota
  const stats = getStats(project.id);
  const todayDate = getTodayDate();
  let emailsSentToday = stats.todayDate === todayDate ? (stats.emailsSentToday || 0) : 0;
  const dailyLimit = project.emailsPerDay || 20;

  // Reserve at least half the daily quota for new outreach, use the rest for follow-ups
  const followUpBudget = Math.max(0, Math.floor(dailyLimit / 2) - emailsSentToday);
  if (followUpBudget <= 0) return { sent: 0, errors: [] };

  const batch = emailed.slice(0, Math.min(followUpBudget, 10));
  logJob(project.id, `Sending ${batch.length} follow-up emails...`);

  for (const prospect of batch) {
    try {
      const followUpNum = (prospect.followUpCount || 0) + 1;
      const originalSubject = prospect.outboundEmails[0]?.subject || `Guest post for ${prospect.targetDomain}`;
      const originalBody = prospect.outboundEmails[0]?.body || "";

      // Compose follow-up email
      const emailContent = await composeFollowUpEmail(
        senderName,
        prospect.targetDomain,
        originalSubject,
        originalBody,
        followUpNum,
        prospect.pitchedTopics || []
      );

      const messageId = await sendEmail(project.smtpConfig, senderFrom, {
        to: prospect.contactEmail,
        subject: emailContent.subject,
        html: `<p>${emailContent.body.replace(/\n/g, "<br/>")}</p>`,
        text: emailContent.body,
      });

      prospect.lastFollowUpAt = new Date().toISOString();
      prospect.lastEmailSentAt = new Date().toISOString();
      prospect.followUpCount = followUpNum;
      prospect.outboundEmails.push({
        sentAt: new Date().toISOString(),
        from: project.emailAddress,
        to: prospect.contactEmail,
        subject: emailContent.subject,
        body: emailContent.body,
        messageId,
      });

      // If max follow-ups reached, mark as no_response
      if (followUpNum >= maxFollowUps) {
        prospect.state = "no_response";
      }

      saveProspect(prospect);
      sent++;

      // Update daily count
      const currentStats = getStats(project.id);
      currentStats.emailsSentToday = (currentStats.emailsSentToday || 0) + 1;
      currentStats.todayDate = todayDate;
      saveStats(project.id, currentStats);

      logJob(project.id, `✓ Follow-up #${followUpNum} sent to ${prospect.contactEmail}`);

      await sleep(DELAY_BETWEEN_EMAILS_MS);
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      errors.push(`Follow-up failed ${prospect.contactEmail}: ${msg}`);
    }
  }

  recalculateStats(project.id);
  return { sent, errors };
}

/**
 * Daily automated run: find new sites + send batch + follow-ups + poll replies.
 * Called by cron endpoint or Daily Run button.
 */
export async function dailyOutreachRun(
  project: OutreachProject
): Promise<{ found: number; sent: number; followUps: number; replies: number; purged: number; errors: string[]; log: string[] }> {
  const log: string[] = [];
  const allErrors: string[] = [];
  let foundCount = 0;
  let followUpsSent = 0;
  let repliesProcessed = 0;
  let purgedCount = 0;

  logJob(project.id, "Daily run: Step 0 — Purging dead prospects...", 0, 5);
  log.push(`[${new Date().toISOString()}] Daily run started for "${project.name}"`);

  // Step 0: Purge dead prospects (no email, rejected)
  try {
    purgedCount = purgeDeadProspects(project.id);
    if (purgedCount > 0) {
      log.push(`Purged ${purgedCount} dead prospects (no email or rejected)`);
      logJob(project.id, `Purged ${purgedCount} dead prospects`, 0, 5);
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    log.push(`Purge failed: ${msg}`);
  }

  logJob(project.id, "Daily run: Step 1/5 — Finding new sites...", 0, 5);

  // Step 1: Find new sites
  try {
    const { findNewProspects } = await import("@/lib/outreach/prospect-finder");
    const findResult = await findNewProspects(project);
    foundCount = findResult.prospects.length;
    log.push(`Found ${foundCount} new prospects`);
    logJob(project.id, `Step 1 done: Found ${foundCount} new prospects`, 1, 5);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    log.push(`Find sites failed: ${msg}`);
    allErrors.push(`Find: ${msg}`);
    logJob(project.id, `Step 1 failed: ${msg}`, 1, 5);
  }

  // Step 2: Poll inbox for replies
  logJob(project.id, "Step 2/5 — Checking inbox for replies...", 1, 5);
  try {
    const { pollForReplies } = await import("@/lib/outreach/email-poller");
    const pollResult = await pollForReplies(project);
    repliesProcessed = pollResult.processed;
    log.push(`Processed ${pollResult.processed} replies (${pollResult.agreements} agreements)`);
    logJob(project.id, `Step 2 done: ${pollResult.processed} replies processed`, 2, 5);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    log.push(`Reply polling failed: ${msg}`);
    allErrors.push(`Replies: ${msg}`);
    logJob(project.id, `Step 2 failed: ${msg}`, 2, 5);
  }

  // Step 3: Send follow-up emails to non-responders
  logJob(project.id, "Step 3/5 — Sending follow-up emails...", 2, 5);
  try {
    const followUpResult = await sendFollowUpBatch(project);
    followUpsSent = followUpResult.sent;
    log.push(`Sent ${followUpsSent} follow-up emails`);
    if (followUpResult.errors.length > 0) {
      allErrors.push(...followUpResult.errors);
    }
    logJob(project.id, `Step 3 done: ${followUpsSent} follow-ups sent`, 3, 5);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    log.push(`Follow-ups failed: ${msg}`);
    allErrors.push(`Follow-ups: ${msg}`);
    logJob(project.id, `Step 3 failed: ${msg}`, 3, 5);
  }

  // Step 4: Send daily batch of new outreach emails
  logJob(project.id, "Step 4/5 — Sending new outreach emails...", 3, 5);
  const sendResult = await sendOutreachBatch(project);
  log.push(`Sent ${sendResult.sent} new outreach emails`);
  if (sendResult.skipped) log.push(`Skipped: ${sendResult.skipped}`);
  if (sendResult.errors.length > 0) {
    log.push(`Send errors: ${sendResult.errors.join("; ")}`);
    allErrors.push(...sendResult.errors);
  }

  // Update last daily run timestamp
  const stats = getStats(project.id);
  stats.lastDailyRunAt = new Date().toISOString();
  saveStats(project.id, stats);

  log.push(`Daily run complete: purged=${purgedCount}, found=${foundCount}, replies=${repliesProcessed}, follow-ups=${followUpsSent}, sent=${sendResult.sent}`);
  return { found: foundCount, sent: sendResult.sent, followUps: followUpsSent, replies: repliesProcessed, purged: purgedCount, errors: allErrors, log };
}
