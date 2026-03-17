import { NextResponse } from "next/server";
import { getAuthFromCookies } from "@/lib/auth";
import { getCache, setCache } from "@/lib/cache";
import { analyzeContentIdeas } from "@/lib/api-clients/claude-client";
import type { AnalysisResult, Keyword, TrendingTopic } from "@/lib/types";

export async function POST(req: Request) {
  const isAdmin = await getAuthFromCookies();
  if (!isAdmin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const cached = getCache<AnalysisResult>("analysis");
    if (cached) return NextResponse.json({ data: cached, fromCache: true });

    const { keywords, trendingTopics } = (await req.json()) as {
      keywords: Keyword[];
      trendingTopics: TrendingTopic[];
    };

    if (!keywords?.length) {
      return NextResponse.json({ error: "No keywords provided" }, { status: 400 });
    }

    const data = await analyzeContentIdeas(keywords, trendingTopics || []);
    setCache("analysis", data);
    return NextResponse.json({ data, fromCache: false });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Analysis failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
