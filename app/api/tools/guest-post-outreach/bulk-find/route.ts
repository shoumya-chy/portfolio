import { NextResponse } from "next/server";
import { getAuthFromCookies } from "@/lib/auth";
import { getProject, recalculateStats } from "@/lib/outreach/storage";
import { bulkFindProspects } from "@/lib/outreach/prospect-finder";
import { startJob, completeJob, failJob, isJobRunning, logJob } from "@/lib/outreach/job-runner";

export async function POST(request: Request) {
  const isAdmin = await getAuthFromCookies();
  if (!isAdmin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { projectId } = body;

    if (!projectId) {
      return NextResponse.json({ error: "projectId required" }, { status: 400 });
    }

    const project = getProject(projectId);
    if (!project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    if (isJobRunning(projectId)) {
      return NextResponse.json({ error: "A job is already running for this project. Check progress on the dashboard." }, { status: 409 });
    }

    // Start job and return immediately
    const job = startJob(projectId, "bulk-find", "Starting bulk search...");
    if (!job) {
      return NextResponse.json({ error: "Failed to start job" }, { status: 500 });
    }

    // Fire and forget — runs in background after response is sent
    void (async () => {
      try {
        const result = await bulkFindProspects(project, (msg) => {
          logJob(projectId, msg);
        });
        recalculateStats(projectId);
        completeJob(projectId, {
          total: result.total,
          withEmail: result.withEmail,
          debug: result.debug,
        }, `Bulk search complete: ${result.total} prospects found, ${result.withEmail} with emails`);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        failJob(projectId, msg);
      }
    })();

    return NextResponse.json({ started: true, jobId: job.jobId });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
