import { NextResponse } from "next/server";
import { getAuthFromCookies } from "@/lib/auth";
import {
  listProjects,
  saveProject,
  deleteProject,
} from "@/lib/outreach/storage";

export async function GET() {
  const isAdmin = await getAuthFromCookies();
  if (!isAdmin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const projects = listProjects();
    return NextResponse.json({ projects });
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to list projects" },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  const isAdmin = await getAuthFromCookies();
  if (!isAdmin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const {
      name,
      siteId,
      niche,
      emailAddress,
      domainFilters,
      smtpConfig,
      imapConfig,
      emailsPerWeek,
    } = body;

    if (!name || !emailAddress) {
      return NextResponse.json(
        { error: "Name and email address are required" },
        { status: 400 }
      );
    }

    const project = {
      id: Date.now().toString(36),
      name,
      siteId: siteId || "",
      niche: niche || "",
      emailAddress,
      domainFilters: domainFilters || [],
      smtpConfig,
      imapConfig,
      emailsPerWeek: emailsPerWeek || 20,
      active: true,
      createdAt: new Date().toISOString(),
    };

    saveProject(project);
    return NextResponse.json({ project }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to create project" },
      { status: 500 }
    );
  }
}

export async function PUT(request: Request) {
  const isAdmin = await getAuthFromCookies();
  if (!isAdmin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { id } = body;
    if (!id) return NextResponse.json({ error: "Project id required" }, { status: 400 });

    const { getProject } = await import("@/lib/outreach/storage");
    const existing = getProject(id);
    if (!existing) return NextResponse.json({ error: "Project not found" }, { status: 404 });

    const updated = {
      ...existing,
      name: body.name ?? existing.name,
      siteId: body.siteId ?? existing.siteId,
      niche: body.niche ?? existing.niche,
      emailAddress: body.emailAddress ?? existing.emailAddress,
      domainFilters: body.domainFilters ?? existing.domainFilters,
      emailsPerWeek: body.emailsPerWeek ?? existing.emailsPerWeek,
      active: body.active ?? existing.active,
      smtpConfig: body.smtpConfig ? {
        ...existing.smtpConfig,
        ...body.smtpConfig,
        password: body.smtpConfig.password === "••••••" ? existing.smtpConfig.password : (body.smtpConfig.password || existing.smtpConfig.password),
      } : existing.smtpConfig,
      imapConfig: body.imapConfig ? {
        ...existing.imapConfig,
        ...body.imapConfig,
        password: body.imapConfig.password === "••••••" ? existing.imapConfig.password : (body.imapConfig.password || existing.imapConfig.password),
      } : existing.imapConfig,
    };

    saveProject(updated);
    return NextResponse.json({ project: updated });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Failed to update project";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  const isAdmin = await getAuthFromCookies();
  if (!isAdmin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { id } = body;

    if (!id) {
      return NextResponse.json(
        { error: "Project id required" },
        { status: 400 }
      );
    }

    deleteProject(id);
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to delete project" },
      { status: 500 }
    );
  }
}
