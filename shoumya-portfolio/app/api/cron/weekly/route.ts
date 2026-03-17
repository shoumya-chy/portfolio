import { NextRequest, NextResponse } from "next/server";
import { getSites } from "@/lib/config";
import { getCache, setCache, getCacheRaw } from "@/lib/cache";
import { analyzeContentIdeas } from "@/lib/api-clients/claude-client";
import type { KeywordData, TrendingTopic, Keyword } from "@/lib/types";

const CRON_SECRET = process.env.CRON_SECRET || "dev-cron-secret";

export async function GET(req: NextRequest) {
  const secret = req.nextUrl.searchParams.get("secret");
  if (secret !== CRON_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const sites = getSites();
  const results: Record<string, string> = {};

  for (const site of sites) {
    try {
      // Get cached keyword data (even if expired, use last known data)
      const gscEntry = getCacheRaw<KeywordData>("gsc", site.url);
      const bingEntry = getCacheRaw<KeywordData>("bing", site.url);
      const redditEntry = getCacheRaw<TrendingTopic[]>("reddit");
      const quoraEntry = getCacheRaw<TrendingTopic[]>("quora");

      const gscKeywords = gscEntry?.data?.keywords || [];
      const bingKeywords = bingEntry?.data?.keywords || [];
      const allKeywords: Keyword[] = [...gscKeywords, ...bingKeywords];

      if (allKeywords.length === 0) {
        results[site.name] = "skipped (no keyword data available)";
        continue;
      }

      const trendingTopics: TrendingTopic[] = [
        ...(redditEntry?.data || []),
        ...(quoraEntry?.data || []),
      ];

      const analysis = await analyzeContentIdeas(allKeywords, trendingTopics);
      setCache("analysis", analysis, site.url);
      results[site.name] = `ok (${analysis.ideas.length} ideas generated)`;
    } catch (err) {
      results[site.name] = `error: ${err instanceof Error ? err.message : "unknown"}`;
    }
  }

  const summary = {
    ran: new Date().toISOString(),
    sites: results,
  };

  console.log("[CRON:WEEKLY]", JSON.stringify(summary));
  return NextResponse.json(summary);
}
