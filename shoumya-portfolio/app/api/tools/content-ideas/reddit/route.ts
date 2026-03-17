import { NextResponse } from "next/server";
import { getAuthFromCookies } from "@/lib/auth";
import { getCache, setCache } from "@/lib/cache";
import { fetchRedditTopics } from "@/lib/api-clients/reddit-scraper";
import { fetchQuoraTopics } from "@/lib/api-clients/quora-scraper";
import type { TrendingTopic } from "@/lib/types";

export async function POST() {
  const isAdmin = await getAuthFromCookies();
  if (!isAdmin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const cachedReddit = getCache<TrendingTopic[]>("reddit");
    const cachedQuora = getCache<TrendingTopic[]>("quora");

    if (cachedReddit && cachedQuora) {
      return NextResponse.json({
        data: [...cachedReddit, ...cachedQuora],
        fromCache: true,
      });
    }

    const [redditData, quoraData] = await Promise.all([
      cachedReddit ? Promise.resolve(cachedReddit) : fetchRedditTopics(),
      cachedQuora ? Promise.resolve(cachedQuora) : fetchQuoraTopics(),
    ]);

    if (!cachedReddit) setCache("reddit", redditData);
    if (!cachedQuora) setCache("quora", quoraData);

    return NextResponse.json({
      data: [...redditData, ...quoraData],
      fromCache: false,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to fetch trending data";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
