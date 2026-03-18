import { NextResponse } from "next/server";
import { getAuthFromCookies } from "@/lib/auth";
import { getCache, setCache, clearCache } from "@/lib/cache";
import { analyzeContentIdeas } from "@/lib/api-clients/claude-client";
import type { AnalysisResult, Keyword, TrendingTopic } from "@/lib/types";

export async function POST(req: Request) {
  const isAdmin = await getAuthFromCookies();
  if (!isAdmin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const { keywords, trendingTopics, siteUrl, force } = (await req.json()) as {
      keywords: Keyword[];
      trendingTopics: TrendingTopic[];
      siteUrl?: string;
      force?: boolean;
    };

    if (!keywords?.length) {
      return NextResponse.json({ error: "No keywords provided" }, { status: 400 });
    }

    // Check cache unless force refresh
    if (!force) {
      const cached = getCache<AnalysisResult>("analysis", siteUrl);
      if (cached) return NextResponse.json({ data: cached, fromCache: true });
    } else {
      // Clear old analysis cache
      clearCache("analysis", siteUrl);
    }

    const data = await analyzeContentIdeas(keywords, trendingTopics || [], siteUrl);
    setCache("analysis", data, siteUrl);
    return NextResponse.json({ data, fromCache: false });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Analysis failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
