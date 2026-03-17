import { NextResponse } from "next/server";
import { listProjects, listProspects, recalculateStats } from "@/lib/outreach/storage";
import { findNewProspects } from "@/lib/outreach/prospect-finder";
import { sendOutreachBatch } from "@/lib/outreach/email-scheduler";
import { pollForReplies } from "@/lib/outreach/email-poller";
import { generateAndSendContent } from "@/lib/outreach/content-pipeline";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const secret = searchParams.get("secret");

    if (!secret || secret !== process.env.CRON_SECRET) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const projects = listProjects();
    const activeProjects = projects.filter((p) => p.active);

    const summary = {
      projectsProcessed: 0,
      sitesFound: 0,
      emailsSent: 0,
      repliesChecked: 0,
      contentGenerated: 0,
      statsUpdated: 0,
      errors: [] as string[],
    };

    for (const project of activeProjects) {
      try {
        // 1. Find new prospects
        const findResult = await findNewProspects(project);
        summary.sitesFound += findResult.prospects.length;

        // 2. Send outreach batch
        const emailResult = await sendOutreachBatch(project);
        summary.emailsSent += emailResult.sent || 0;

        // 3. Poll for replies
        const repliesResult = await pollForReplies(project);
        summary.repliesChecked += repliesResult.processed || 0;

        // 4. Generate content for agreed prospects
        const prospects = listProspects(project.id);
        const agreedProspects = prospects.filter(
          (p) => p.state === "agreed" && !p.contentSentAt
        );

        for (const prospect of agreedProspects) {
          try {
            const contentResult = await generateAndSendContent(
              project,
              prospect.id
            );
            summary.contentGenerated += 1;
          } catch (error) {
            summary.errors.push(
              `Failed to generate content for prospect ${prospect.id}: ${error}`
            );
          }
        }

        // 5. Recalculate stats
        recalculateStats(project.id);
        summary.statsUpdated += 1;

        summary.projectsProcessed += 1;
      } catch (error) {
        summary.errors.push(
          `Failed to process project ${project.id}: ${error}`
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
