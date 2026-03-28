import { NextResponse } from "next/server";
import { getAuthFromCookies } from "@/lib/auth";
import { listSites, getSite, saveSite, deleteSite } from "@/lib/directory-submitter/storage";
import type { SiteToSubmit } from "@/lib/directory-submitter/types";

export async function GET() {
  const isAdmin = await getAuthFromCookies();
  if (!isAdmin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const sites = listSites();
  return NextResponse.json({ sites });
}

export async function POST(req: Request) {
  const isAdmin = await getAuthFromCookies();
  if (!isAdmin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const body = await req.json();
    const {
      url, name, description, longDescription, category, keywords,
      contactName, contactEmail, contactPhone, address, city, state,
      country, language, reciprocalUrl,
    } = body;

    if (!url || !name || !description || !contactEmail) {
      return NextResponse.json(
        { error: "Required fields: url, name, description, contactEmail" },
        { status: 400 },
      );
    }

    const site: SiteToSubmit = {
      id: `site_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      url: url.replace(/\/$/, ""), // strip trailing slash
      name,
      description: description.substring(0, 250),
      longDescription: (longDescription || description).substring(0, 500),
      category: category || "General",
      keywords: Array.isArray(keywords) ? keywords.slice(0, 10) : [],
      contactName: contactName || "",
      contactEmail,
      contactPhone: contactPhone || "",
      address: address || "",
      city: city || "",
      state: state || "",
      country: country || "",
      language: language || "English",
      reciprocalUrl: reciprocalUrl || "",
      active: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    saveSite(site);
    return NextResponse.json({ site, message: "Site added successfully" });
  } catch (err) {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }
}

export async function PUT(req: Request) {
  const isAdmin = await getAuthFromCookies();
  if (!isAdmin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const body = await req.json();
    const { id, ...updates } = body;

    if (!id) {
      return NextResponse.json({ error: "Site ID is required" }, { status: 400 });
    }

    const existing = getSite(id);
    if (!existing) {
      return NextResponse.json({ error: "Site not found" }, { status: 404 });
    }

    const updated: SiteToSubmit = {
      ...existing,
      ...updates,
      id: existing.id,
      createdAt: existing.createdAt,
      updatedAt: new Date().toISOString(),
    };

    saveSite(updated);
    return NextResponse.json({ site: updated, message: "Site updated" });
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }
}

export async function DELETE(req: Request) {
  const isAdmin = await getAuthFromCookies();
  if (!isAdmin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const siteId = searchParams.get("id");

  if (!siteId) {
    return NextResponse.json({ error: "Site ID is required" }, { status: 400 });
  }

  const deleted = deleteSite(siteId);
  if (!deleted) {
    return NextResponse.json({ error: "Site not found" }, { status: 404 });
  }

  return NextResponse.json({ message: "Site deleted" });
}
