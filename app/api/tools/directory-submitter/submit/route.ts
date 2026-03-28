import { NextResponse } from "next/server";
import { getAuthFromCookies } from "@/lib/auth";
import { getSite, listSubmissions, saveJob, getJob, saveSubmissionsBatch } from "@/lib/directory-submitter/storage";
import { runSubmissionPipeline } from "@/lib/directory-submitter/submitter";
import type { SubmissionJob } from "@/lib/directory-submitter/types";

/**
 * mode:
 *   "new"          — only submit to directories not yet attempted (default)
 *   "retry-failed" — re-submit to directories that previously failed
 *   "retry-skipped" — re-submit to directories that were skipped (e.g. CAPTCHA)
 *   "retry-both"   — re-submit to both failed and skipped directories
 */
export async function POST(req: Request) {
  const isAdmin = await getAuthFromCookies();
  if (!isAdmin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const { siteId, mode = "new" } = await req.json();

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

    let existingSubmissions = listSubmissions(siteId);

    // For retry modes, remove the old records so they get re-attempted
    if (mode === "retry-failed" || mode === "retry-both") {
      existingSubmissions = existingSubmissions.filter((s) => s.status !== "failed");
    }
    if (mode === "retry-skipped" || mode === "retry-both") {
      existingSubmissions = existingSubmissions.filter((s) => s.status !== "skipped");
    }

    // Also clean the stored submissions so the pipeline sees them as new
    if (mode !== "new") {
      const allSubmissions = listSubmissions(siteId);
      const statusesToRetry: string[] = [];
      if (mode === "retry-failed" || mode === "retry-both") statusesToRetry.push("failed");
      if (mode === "retry-skipped" || mode === "retry-both") statusesToRetry.push("skipped");

      const kept = allSubmissions.filter((s) => !statusesToRetry.includes(s.status));
      // Overwrite with the kept records (removes the ones being retried)
      const allSubs = listSubmissions(); // all sites
      const otherSiteSubs = allSubs.filter((s) => s.siteId !== siteId);
      saveSubmissionsBatch([...otherSiteSubs, ...kept]);
    }

    const modeLabel = mode === "new" ? "" : ` (${mode})`;

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
      log: [`Job started for site: ${site.name}${modeLabel}`],
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
      message: `Submission job started${modeLabel}`,
      jobId: job.jobId,
    });
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }
}
