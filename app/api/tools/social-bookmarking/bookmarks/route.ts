import { NextResponse } from "next/server";
import { getAuthFromCookies } from "@/lib/auth";
import platforms from "@/lib/social-bookmarking/platforms";

export async function GET() {
  const isAdmin = await getAuthFromCookies();
  if (!isAdmin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const active = platforms.filter((p) => p.active);
  const byType: Record<string, number> = {};
  for (const p of active) {
    byType[p.type] = (byType[p.type] || 0) + 1;
  }

  return NextResponse.json({ platforms: active, byType, total: active.length });
}
