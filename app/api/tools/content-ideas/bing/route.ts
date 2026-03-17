import { NextResponse } from "next/server";
import { getAuthFromCookies } from "@/lib/auth";
import { getCache, setCache } from "@/lib/cache";
import { fetchBingData } from "@/lib/api-clients/bing-client";
import type { KeywordData } from "@/lib/types";

export async function POST() {
  const isAdmin = await getAuthFromCookies();
  if (!isAdmin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const cached = getCache<KeywordData>("bing");
    if (cached) return NextResponse.json({ data: cached, fromCache: true });

    const data = await fetchBingData();
    setCache("bing", data);
    return NextResponse.json({ data, fromCache: false });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to fetch Bing data";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
