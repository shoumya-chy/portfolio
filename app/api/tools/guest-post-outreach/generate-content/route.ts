import { NextResponse } from "next/server";
import { getAuthFromCookies } from "@/lib/auth";
import { getProject, getGeneratedContent } from "@/lib/outreach/storage";
import { generateAndSendContent } from "@/lib/outreach/content-pipeline";

// GET: Fetch already-generated content for a prospect
export async function GET(request: Request) {
  const isAdmin = await getAuthFromCookies();
  if (!isAdmin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const { searchParams } = new URL(request.url);
    const projectId = searchParams.get("projectId");
    const prospectId = searchParams.get("prospectId");
    if (!projectId || !prospectId) return NextResponse.json({ content: null });

    const content = getGeneratedContent(projectId, prospectId);
    return NextResponse.json({ content });
  } catch {
    return NextResponse.json({ content: null });
  }
}

// POST: Generate and send new content
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
    const msg = error instanceof Error ? error.message : "Failed to generate content";
    console.log("[GenerateContent] Error:", msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
