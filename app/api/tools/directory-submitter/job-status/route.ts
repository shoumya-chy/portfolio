import { NextResponse } from "next/server";
import { getAuthFromCookies } from "@/lib/auth";
import { getJob, saveJob } from "@/lib/directory-submitter/storage";

export async function GET() {
  const isAdmin = await getAuthFromCookies();
  if (!isAdmin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const job = getJob();
  return NextResponse.json({ job });
}

/** Cancel the current running job */
export async function DELETE() {
  const isAdmin = await getAuthFromCookies();
  if (!isAdmin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const job = getJob();
  if (!job) {
    return NextResponse.json({ error: "No active job" }, { status: 404 });
  }

  if (job.status === "running") {
    job.status = "cancelled";
    job.completedAt = new Date().toISOString();
    job.log.push("Job cancelled by user");
    saveJob(job);
  }

  return NextResponse.json({ message: "Job cancelled", job });
}
