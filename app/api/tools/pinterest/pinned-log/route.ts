import { NextResponse } from "next/server";
import { getAuthFromCookies } from "@/lib/auth";
import { getPinnedLog } from "@/lib/pinterest/storage";

export async function GET(request: Request) {
  const isAdmin = await getAuthFromCookies();
  if (!isAdmin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const siteId = searchParams.get("siteId");
  if (!siteId) return NextResponse.json({ error: "siteId required" }, { status: 400 });

  const log = getPinnedLog(siteId);
  return NextResponse.json({ log });
}
