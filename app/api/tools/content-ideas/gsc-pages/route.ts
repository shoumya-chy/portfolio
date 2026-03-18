import { NextResponse } from "next/server";
import { getAuthFromCookies } from "@/lib/auth";
import { getCache, setCache } from "@/lib/cache";
import { fetchGSCPageKeywords } from "@/lib/api-clients/gsc-client";
import type { PageKeywordMap } from "@/lib/types";

export async function POST(req: Request) {
  const isAdmin = await getAuthFromCookies();
  if (!isAdmin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const { siteUrl } = (await req.json()) as { siteUrl: string };
    if (!siteUrl) return NextResponse.json({ error: "siteUrl required" }, { status: 400 });

    const cached = getCache<PageKeywordMap[]>("gsc-pages", siteUrl);
    if (cached) return NextResponse.json({ data: cached, fromCache: true });

    const data = await fetchGSCPageKeywords(siteUrl);
    setCache("gsc-pages", data, siteUrl);
    return NextResponse.json({ data, fromCache: false });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to fetch page keywords";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
