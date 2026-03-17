import { NextResponse } from "next/server";
import { getAuthFromCookies } from "@/lib/auth";
import { getProject } from "@/lib/outreach/storage";
import { generateAndSendContent } from "@/lib/outreach/content-pipeline";

export async function POST(request: Request) {
  const isAdmin = await getAuthFromCookies();
  if (!isAdmin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { projectId, prospectId } = body;

    if (!projectId || !prospectId) {
      return NextResponse.json(
        { error: "projectId and prospectId required" },
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

    const result = await generateAndSendContent(project, prospectId);

    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to generate content" },
      { status: 500 }
    );
  }
}
