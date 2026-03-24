import { NextResponse } from "next/server";
import { getAuthFromCookies } from "@/lib/auth";
import { listProjects, getProject } from "@/lib/outreach/storage";
import { dailyOutreachRun } from "@/lib/outreach/email-scheduler";
import { readConfig } from "@/lib/config";
import { startJob, completeJob, failJob, isJobRunning } from "@/lib/outreach/job-runner";

/**
 * POST /api/tools/guest-post-outreach/daily-run
 *
 * Runs the daily outreach cycle: find new sites + send batch of emails.
 * Starts as a background job and returns immediately.
 *
 * Auth: either admin cookie OR ?secret=<configured secret> for cron.
 */
export async function POST(request: Request) {
  const url = new URL(request.url);
  const cronSecret = url.searchParams.get("secret");

  const isAdmin = await getAuthFromCookies();
  const config = readConfig();
  const configuredSecret = (config as unknown as Record<string, unknown>).cronSecret as string | undefined;
  const isValidCron = cronSecret && configuredSecret && cronSecret === configuredSecret;

  if (!isAdmin && !isValidCron) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    let body: Record<string, string> = {};
    try { body = await request.json(); } catch { /* empty body OK for cron */ }
    const { projectId } = body;

    // If projectId provided, run for that project. Otherwise, run for all active projects.
    const projectIds: string[] = [];
    if (projectId) {
      projectIds.push(projectId);
    } else {
      const allProjects = listProjects();
      for (const p of allProjects) {
        if (p.active !== false) projectIds.push(p.id);
      }
    }

    if (projectIds.length === 0) {
      return NextResponse.json({ error: "No active projects found" }, { status: 404 });
    }

    const started: string[] = [];
    const skipped: string[] = [];

    for (const pid of projectIds) {
      if (isJobRunning(pid)) {
        skipped.push(pid);
        continue;
      }

      const project = getProject(pid);
      if (!project) continue;

      const job = startJob(pid, "daily-run", `Daily run starting for "${project.name}"...`);
      if (!job) {
        skipped.push(pid);
        continue;
      }

      // Fire and forget
      void (async () => {
        try {
          const result = await dailyOutreachRun(project);
          const summary = `Daily run complete: purged ${result.purged || 0} dead, found ${result.found} sites, ${result.replies || 0} replies processed, ${result.followUps || 0} follow-ups, ${result.sent} new emails`;
          completeJob(pid, {
            found: result.found,
            sent: result.sent,
            followUps: result.followUps || 0,
            replies: result.replies || 0,
            errors: result.errors,
            log: result.log,
          }, summary);
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          failJob(pid, msg);
        }
      })();

      started.push(pid);
    }

    return NextResponse.json({
      started,
      skipped,
      message: `Started daily run for ${started.length} project(s)${skipped.length > 0 ? `, ${skipped.length} already running` : ""}`,
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

// Also support GET for easy cron testing
export async function GET(request: Request) {
  return POST(request);
}
