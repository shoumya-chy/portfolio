import { NextResponse } from "next/server";
import { getAuthFromCookies } from "@/lib/auth";
import { getJobStatus, clearJob } from "@/lib/outreach/job-runner";

export async function GET(request: Request) {
  const isAdmin = await getAuthFromCookies();
  if (!isAdmin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(request.url);
  const projectId = url.searchParams.get("projectId");

  if (!projectId) {
    return NextResponse.json({ error: "projectId required" }, { status: 400 });
  }

  const job = getJobStatus(projectId);
  return NextResponse.json({ job });
}

/**
 * DELETE: Clear a completed/failed job so a new one can start.
 */
export async function DELETE(request: Request) {
  const isAdmin = await getAuthFromCookies();
  if (!isAdmin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(request.url);
  const projectId = url.searchParams.get("projectId");

  if (!projectId) {
    return NextResponse.json({ error: "projectId required" }, { status: 400 });
  }

  clearJob(projectId);
  return NextResponse.json({ cleared: true });
}
