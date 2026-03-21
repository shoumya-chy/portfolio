import { NextResponse } from "next/server";
import { getAuthFromCookies } from "@/lib/auth";
import { getCache } from "@/lib/cache";
import type { DiscoveryResult } from "@/lib/types";

/**
 * GET cached discovery results only — never triggers the pipeline.
 * Used when switching between sites to show last results instantly.
 */
export async function POST(req: Request) {
  const isAdmin = await getAuthFromCookies();
  if (!isAdmin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const { siteUrl } = (await req.json()) as { siteUrl: string };
    if (!siteUrl) return NextResponse.json({ data: null });

    const cached = getCache<DiscoveryResult>("discovery", siteUrl);
    if (cached) {
      return NextResponse.json({ data: cached, fromCache: true });
    }

    return NextResponse.json({ data: null });
  } catch {
    return NextResponse.json({ data: null });
  }
}
