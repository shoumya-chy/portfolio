import { NextResponse } from "next/server";
import { getAuthFromCookies } from "@/lib/auth";
import { listSites, saveSite, deleteSite, getSite } from "@/lib/pinterest/storage";
import type { PinterestSite } from "@/lib/pinterest/types";

export async function GET() {
  const isAdmin = await getAuthFromCookies();
  if (!isAdmin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  return NextResponse.json({ sites: listSites() });
}

export async function POST(request: Request) {
  const isAdmin = await getAuthFromCookies();
  if (!isAdmin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const body = await request.json();
    const { name, wpBaseUrl, wpUsername, wpAppPassword, pinterestAccessToken, pinterestBoardId, pinsPerDay } = body;

    if (!name || !wpBaseUrl) {
      return NextResponse.json({ error: "name and wpBaseUrl are required" }, { status: 400 });
    }

    const site: PinterestSite = {
      id: Date.now().toString(36) + Math.random().toString(36).substring(2, 6),
      name,
      wpBaseUrl: wpBaseUrl.replace(/\/$/, ""),
      wpUsername: wpUsername || "",
      wpAppPassword: wpAppPassword || "",
      pinterestAccessToken: pinterestAccessToken || "",
      pinterestBoardId: pinterestBoardId || "",
      pinsPerDay: pinsPerDay || 10,
      active: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    saveSite(site);
    return NextResponse.json({ site });
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }
}

export async function PUT(request: Request) {
  const isAdmin = await getAuthFromCookies();
  if (!isAdmin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const body = await request.json();
    const { id, ...updates } = body;
    if (!id) return NextResponse.json({ error: "id is required" }, { status: 400 });

    const existing = getSite(id);
    if (!existing) return NextResponse.json({ error: "Site not found" }, { status: 404 });

    const updated: PinterestSite = {
      ...existing,
      ...updates,
      id: existing.id,
      createdAt: existing.createdAt,
      updatedAt: new Date().toISOString(),
    };
    if (updated.wpBaseUrl) updated.wpBaseUrl = updated.wpBaseUrl.replace(/\/$/, "");

    saveSite(updated);
    return NextResponse.json({ site: updated });
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }
}

export async function DELETE(request: Request) {
  const isAdmin = await getAuthFromCookies();
  if (!isAdmin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id query param required" }, { status: 400 });

  const deleted = deleteSite(id);
  return deleted
    ? NextResponse.json({ success: true })
    : NextResponse.json({ error: "Site not found" }, { status: 404 });
}
