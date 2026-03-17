import { NextResponse } from "next/server";
import { getAuthFromCookies } from "@/lib/auth";
import { getProject } from "@/lib/outreach/storage";
import { sendOutreachBatch } from "@/lib/outreach/email-scheduler";

export async function POST(request: Request) {
  const isAdmin = await getAuthFromCookies();
  if (!isAdmin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { projectId } = body;

    if (!projectId) {
      return NextResponse.json(
        { error: "projectId required" },
        { status: 400 }
      );
    }

    const project = getProject(projectId);
    if (!project) {
      return NextResponse.json(
        { error: "Project not found" },
        { status: 404 }
      );
    }

    const result = await sendOutreachBatch(project);

    return NextResponse.json(result);
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.log("[SendEmails] Error:", msg);
    return NextResponse.json(
      { error: msg, sent: 0, errors: [msg] },
      { status: 500 }
    );
  }
}
