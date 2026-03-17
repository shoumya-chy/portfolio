import { NextResponse } from "next/server";
import { getAuthFromCookies } from "@/lib/auth";
import { getCache, setCache } from "@/lib/cache";
import { fetchGSCData } from "@/lib/api-clients/gsc-client";
import type { KeywordData } from "@/lib/types";

export async function POST() {
  const isAdmin = await getAuthFromCookies();
  if (!isAdmin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const cached = getCache<KeywordData>("gsc");
    if (cached) return NextResponse.json({ data: cached, fromCache: true });

    const data = await fetchGSCData();
    setCache("gsc", data);
    return NextResponse.json({ data, fromCache: false });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to fetch GSC data";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
