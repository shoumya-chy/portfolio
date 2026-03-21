import { NextResponse } from "next/server";
import { getAuthFromCookies } from "@/lib/auth";
import { getProject } from "@/lib/outreach/storage";
import { calculateBacklinkTargets } from "@/lib/outreach/backlink-strategy";
import { getSites } from "@/lib/config";

export async function POST(request: Request) {
  const isAdmin = await getAuthFromCookies();
  if (!isAdmin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const { projectId } = await request.json();
    if (!projectId) return NextResponse.json({ error: "projectId required" }, { status: 400 });

    const project = getProject(projectId);
    if (!project) return NextResponse.json({ error: "Project not found" }, { status: 404 });

    const sites = getSites();
    const site = sites.find(s => s.id === project.siteId);
    const siteUrl = site?.url || "";

    if (!siteUrl) {
      return NextResponse.json({ error: "No site URL configured for this project" }, { status: 400 });
    }

    const targets = await calculateBacklinkTargets(projectId, siteUrl);

    return NextResponse.json({ targets });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Failed to calculate targets";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
