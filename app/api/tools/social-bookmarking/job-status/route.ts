import { NextResponse } from "next/server";
import { getAuthFromCookies } from "@/lib/auth";
import { getJob, saveJob } from "@/lib/social-bookmarking/storage";

export async function GET() {
  const isAdmin = await getAuthFromCookies();
  if (!isAdmin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  return NextResponse.json({ job: getJob() });
}

/** Cancel a running job */
export async function DELETE() {
  const isAdmin = await getAuthFromCookies();
  if (!isAdmin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const job = getJob();
  if (job && job.status === "running") {
    job.status = "cancelled";
    job.log.push("Cancelled by user");
    job.completedAt = new Date().toISOString();
    saveJob(job);
  }
  return NextResponse.json({ success: true });
}
