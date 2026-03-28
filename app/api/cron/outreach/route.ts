import { NextResponse } from "next/server";
import { listProjects, getProject, recalculateStats } from "@/lib/outreach/storage";
import { dailyOutreachRun } from "@/lib/outreach/email-scheduler";
import { readConfig } from "@/lib/config";

/**
 * GET /api/cron/outreach?secret=...
 *
 * Called by the nightly cron job. Runs the full daily outreach pipeline
 * for all active projects: purge → find sites → poll replies → follow-ups → send emails.
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const secret = searchParams.get("secret");

    // Check secret from env var OR config.json
    const envSecret = process.env.CRON_SECRET;
    const config = readConfig();
    const configSecret = (config as unknown as Record<string, unknown>).cronSecret as string | undefined;

    if (!secret || (secret !== envSecret && secret !== configSecret)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const projects = listProjects();
    const activeProjects = projects.filter((p) => p.active !== false);

    if (activeProjects.length === 0) {
      return NextResponse.json({
        success: true,
        message: "No active projects",
        timestamp: new Date().toISOString(),
      });
    }

    const summary = {
      projectsProcessed: 0,
      purged: 0,
      sitesFound: 0,
      emailsSent: 0,
      followUpsSent: 0,
      repliesProcessed: 0,
      errors: [] as string[],
    };

    for (const project of activeProjects) {
      try {
        const result = await dailyOutreachRun(project);

        summary.purged += result.purged || 0;
        summary.sitesFound += result.found;
        summary.emailsSent += result.sent;
        summary.followUpsSent += result.followUps || 0;
        summary.repliesProcessed += result.replies || 0;
        if (result.errors.length > 0) {
          summary.errors.push(...result.errors.map(e => `[${project.name}] ${e}`));
        }

        recalculateStats(project.id);
        summary.projectsProcessed += 1;
      } catch (error) {
        summary.errors.push(
          `[${project.name}] Failed: ${error instanceof Error ? error.message : String(error)}`
        );
      }
    }

    return NextResponse.json({
      success: true,
      summary,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    return NextResponse.json(
      { error: "Cron job failed", details: String(error) },
      { status: 500 }
    );
  }
}
