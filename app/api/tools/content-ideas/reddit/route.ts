import { NextResponse } from "next/server";
import { getAuthFromCookies } from "@/lib/auth";
import { getCache, setCache } from "@/lib/cache";
import { fetchRedditTopics } from "@/lib/api-clients/reddit-scraper";
import type { TrendingTopic } from "@/lib/types";

export async function POST() {
  const isAdmin = await getAuthFromCookies();
  if (!isAdmin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const cached = getCache<TrendingTopic[]>("reddit");
    if (cached) return NextResponse.json({ data: cached, fromCache: true });

    const data = await fetchRedditTopics();
    setCache("reddit", data);
    return NextResponse.json({ data, fromCache: false });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to fetch Reddit data";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
