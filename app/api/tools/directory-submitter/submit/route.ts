import { NextResponse } from "next/server";
import { getAuthFromCookies } from "@/lib/auth";
import { getSite, listSubmissions, saveJob, getJob } from "@/lib/directory-submitter/storage";
import { runSubmissionPipeline } from "@/lib/directory-submitter/submitter";
import type { SubmissionJob } from "@/lib/directory-submitter/types";

export async function POST(req: Request) {
  const isAdmin = await getAuthFromCookies();
  if (!isAdmin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const { siteId } = await req.json();

    if (!siteId) {
      return NextResponse.json({ error: "siteId is required" }, { status: 400 });
    }

    const site = getSite(siteId);
    if (!site) {
      return NextResponse.json({ error: "Site not found" }, { status: 404 });
    }

    // Check if a job is already running
    const currentJob = getJob();
    if (currentJob?.status === "running") {
      return NextResponse.json(
        { error: "A submission job is already running. Wait for it to complete or cancel it." },
        { status: 409 },
      );
    }

    const existingSubmissions = listSubmissions(siteId);

    // Create the job
    const job: SubmissionJob = {
      jobId: `job_${Date.now()}`,
      siteId,
      status: "running",
      totalDirectories: 0,
      processed: 0,
      succeeded: 0,
      failed: 0,
      skipped: 0,
      startedAt: new Date().toISOString(),
      log: [`Job started for site: ${site.name}`],
    };
    saveJob(job);

    // Run pipeline in background (don't await)
    runSubmissionPipeline(site, existingSubmissions).catch((err) => {
      const j = getJob();
      if (j) {
        j.status = "failed";
        j.log.push(`Pipeline error: ${err.message}`);
        j.completedAt = new Date().toISOString();
        saveJob(j);
      }
    });

    return NextResponse.json({
      message: "Submission job started",
      jobId: job.jobId,
    });
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }
}
