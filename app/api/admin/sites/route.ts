import { NextResponse } from "next/server";
import { getAuthFromCookies } from "@/lib/auth";
import { readConfig, writeConfig } from "@/lib/config";

export async function GET() {
  const isAdmin = await getAuthFromCookies();
  if (!isAdmin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const config = readConfig();
  return NextResponse.json({ sites: config.sites });
}

export async function POST(req: Request) {
  const isAdmin = await getAuthFromCookies();
  if (!isAdmin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const { name, url } = await req.json();
    if (!name || !url) {
      return NextResponse.json({ error: "Name and URL required" }, { status: 400 });
    }

    const config = readConfig();
    const id = Date.now().toString(36);
    config.sites.push({ id, name, url });
    writeConfig(config);
    return NextResponse.json({ success: true, site: { id, name, url } });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to add site";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  const isAdmin = await getAuthFromCookies();
  if (!isAdmin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const { id } = await req.json();
    if (!id) return NextResponse.json({ error: "Site ID required" }, { status: 400 });

    const config = readConfig();
    config.sites = config.sites.filter((s) => s.id !== id);
    writeConfig(config);
    return NextResponse.json({ success: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to remove site";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
