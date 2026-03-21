import { NextResponse } from "next/server";
import { getAuthFromCookies } from "@/lib/auth";
import { getCache, setCache, clearCache } from "@/lib/cache";
import { runDiscoveryPipeline } from "@/lib/content-discovery/pipeline";
import type { DiscoveryResult } from "@/lib/types";

export async function POST(req: Request) {
  const isAdmin = await getAuthFromCookies();
  if (!isAdmin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const { siteUrl, force } = (await req.json()) as { siteUrl: string; force?: boolean };

    if (!siteUrl) {
      return NextResponse.json({ error: "siteUrl required" }, { status: 400 });
    }

    // Check cache unless forced
    if (!force) {
      const cached = getCache<DiscoveryResult>("discovery", siteUrl);
      if (cached) return NextResponse.json({ data: cached, fromCache: true });
    } else {
      clearCache("discovery", siteUrl);
    }

    const result = await runDiscoveryPipeline(siteUrl);
    setCache("discovery", result, siteUrl);

    return NextResponse.json({ data: result, fromCache: false });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Discovery pipeline failed";
    console.log("[Discovery] Error:", msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
