import { NextResponse } from "next/server";
import { getAuthFromCookies } from "@/lib/auth";
import { listSites, getSite, saveSite, deleteSite } from "@/lib/social-bookmarking/storage";
import type { BookmarkSite } from "@/lib/social-bookmarking/types";

export async function GET() {
  const isAdmin = await getAuthFromCookies();
  if (!isAdmin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  return NextResponse.json({ sites: listSites() });
}

export async function POST(req: Request) {
  const isAdmin = await getAuthFromCookies();
  if (!isAdmin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  if (!body.url || !body.name) {
    return NextResponse.json({ error: "URL and name are required" }, { status: 400 });
  }

  const site: BookmarkSite = {
    id: `site_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    url: body.url,
    name: body.name,
    description: body.description || "",
    keywords: body.keywords || [],
    sitemapUrl: body.sitemapUrl || "",
    rssUrl: body.rssUrl || "",
    contactEmail: body.contactEmail || "",
    active: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  saveSite(site);
  return NextResponse.json({ site });
}

export async function PUT(req: Request) {
  const isAdmin = await getAuthFromCookies();
  if (!isAdmin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  if (!body.id) return NextResponse.json({ error: "id is required" }, { status: 400 });

  const existing = getSite(body.id);
  if (!existing) return NextResponse.json({ error: "Site not found" }, { status: 404 });

  const updated: BookmarkSite = {
    ...existing,
    ...body,
    updatedAt: new Date().toISOString(),
  };
  saveSite(updated);
  return NextResponse.json({ site: updated });
}

export async function DELETE(req: Request) {
  const isAdmin = await getAuthFromCookies();
  if (!isAdmin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id is required" }, { status: 400 });

  deleteSite(id);
  return NextResponse.json({ success: true });
}
