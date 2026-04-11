import { NextResponse } from "next/server";
import { getAuthFromCookies } from "@/lib/auth";
import { getSite, isJobRunning, startJob, completeJob, failJob } from "@/lib/pinterest/storage";
import { runPinterestPipeline } from "@/lib/pinterest/pipeline";

export async function POST(request: Request) {
  const isAdmin = await getAuthFromCookies();
  if (!isAdmin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const body = await request.json();
    const { siteId } = body;

    if (!siteId) return NextResponse.json({ error: "siteId required" }, { status: 400 });

    const site = getSite(siteId);
    if (!site) return NextResponse.json({ error: "Site not found" }, { status: 404 });

    if (isJobRunning(siteId)) {
      return NextResponse.json({ error: "A job is already running for this site" }, { status: 409 });
    }

    const job = startJob(siteId);
    if (!job) return NextResponse.json({ error: "Failed to start job" }, { status: 500 });

    // Fire and forget — runs in background
    void (async () => {
      try {
        const result = await runPinterestPipeline(site);
        completeJob(siteId, result, `${result.published} pinned, ${result.failed} failed out of ${result.attempted}`);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        failJob(siteId, msg);
      }
    })();

    return NextResponse.json({ started: true, jobId: job.jobId });
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }
}
