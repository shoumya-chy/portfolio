import { NextResponse } from "next/server";
import { getAuthFromCookies } from "@/lib/auth";
import { getProject } from "@/lib/outreach/storage";
import { pollForReplies } from "@/lib/outreach/email-poller";

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

    const result = await pollForReplies(project);

    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to check replies" },
      { status: 500 }
    );
  }
}
