import { NextResponse } from "next/server";
import { getAuthFromCookies } from "@/lib/auth";
import { getProject } from "@/lib/outreach/storage";
import { findNewProspects } from "@/lib/outreach/prospect-finder";

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

    const result = await findNewProspects(project);

    return NextResponse.json({
      found: result.length,
      prospects: result,
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Unknown error";
    console.log("[FindSites] Error:", msg);
    return NextResponse.json(
      { error: msg },
      { status: 500 }
    );
  }
}
