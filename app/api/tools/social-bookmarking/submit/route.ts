import { NextResponse } from "next/server";
import { getAuthFromCookies } from "@/lib/auth";
import { getSite, listPosts, getJob, saveJob } from "@/lib/social-bookmarking/storage";
import { runBookmarkPipeline } from "@/lib/social-bookmarking/submitter";
import type { BookmarkJob } from "@/lib/social-bookmarking/types";

export async function POST(req: Request) {
  const isAdmin = await getAuthFromCookies();
  if (!isAdmin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const { siteId, postIds, mode = "new" } = await req.json();

    if (!siteId) {
      return NextResponse.json({ error: "siteId is required" }, { status: 400 });
    }

    const site = getSite(siteId);
    if (!site) return NextResponse.json({ error: "Site not found" }, { status: 404 });

    const currentJob = getJob();
    if (currentJob?.status === "running") {
      return NextResponse.json(
        { error: "A job is already running. Wait for it to complete or cancel it." },
        { status: 409 },
      );
    }

    // Get posts to submit
    let posts = listPosts(siteId);
    if (postIds && Array.isArray(postIds) && postIds.length > 0) {
      const idSet = new Set(postIds);
      posts = posts.filter((p) => idSet.has(p.id));
    }

    if (posts.length === 0) {
      return NextResponse.json({ error: "No posts to submit. Fetch posts first." }, { status: 400 });
    }

    const job: BookmarkJob = {
      jobId: `bjob_${Date.now()}`,
      siteId,
      status: "running",
      totalPlatforms: 0,
      totalPosts: posts.length,
      processed: 0,
      succeeded: 0,
      failed: 0,
      skipped: 0,
      startedAt: new Date().toISOString(),
      log: [`Job started: ${posts.length} post(s) — mode: ${mode}`],
    };
    saveJob(job);

    // Run in background
    runBookmarkPipeline(posts, siteId, mode).catch((err) => {
      const j = getJob();
      if (j) {
        j.status = "failed";
        j.log.push(`Pipeline error: ${err.message}`);
        j.completedAt = new Date().toISOString();
        saveJob(j);
      }
    });

    return NextResponse.json({ message: "Bookmark job started", jobId: job.jobId });
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }
}
