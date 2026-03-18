import { NextResponse } from "next/server";
import { getAuthFromCookies } from "@/lib/auth";
import { getCache, setCache } from "@/lib/cache";
import { fetchRedditTopics } from "@/lib/api-clients/reddit-scraper";
import { fetchQuoraTopics } from "@/lib/api-clients/quora-scraper";
import { getSites } from "@/lib/config";
import type { TrendingTopic } from "@/lib/types";

export async function POST(req: Request) {
  const isAdmin = await getAuthFromCookies();
  if (!isAdmin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const { siteUrl } = (await req.json()) as { siteUrl?: string };

    // Detect niche from site name
    let niche: string | undefined;
    if (siteUrl) {
      const sites = getSites();
      const site = sites.find(s => s.url === siteUrl);
      if (site?.name) {
        niche = site.name;
      }
    }

    const cachedReddit = getCache<TrendingTopic[]>("reddit", siteUrl);
    const cachedQuora = getCache<TrendingTopic[]>("quora", siteUrl);

    if (cachedReddit && cachedQuora) {
      return NextResponse.json({
        data: [...cachedReddit, ...cachedQuora],
        fromCache: true,
      });
    }

    const [redditData, quoraData] = await Promise.all([
      cachedReddit ? Promise.resolve(cachedReddit) : fetchRedditTopics(niche),
      cachedQuora ? Promise.resolve(cachedQuora) : fetchQuoraTopics(niche),
    ]);

    if (!cachedReddit) setCache("reddit", redditData, siteUrl);
    if (!cachedQuora) setCache("quora", quoraData, siteUrl);

    return NextResponse.json({
      data: [...redditData, ...quoraData],
      fromCache: false,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to fetch trending data";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
