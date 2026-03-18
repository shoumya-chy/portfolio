import Anthropic from "@anthropic-ai/sdk";
import type { Keyword, TrendingTopic, AnalysisResult } from "@/lib/types";
import { getApiKey, getSites } from "@/lib/config";
import { fetchSitemap } from "@/lib/api-clients/sitemap-parser";

export async function analyzeContentIdeas(
  keywords: Keyword[],
  trendingTopics: TrendingTopic[],
  siteUrl?: string
): Promise<AnalysisResult> {
  const apiKey = getApiKey("anthropic");
  if (!apiKey) throw new Error("Anthropic API key not configured. Add it in Settings.");

  // Fetch existing pages from sitemap to avoid duplicates
  let existingPages: string[] = [];
  if (siteUrl) {
    try {
      const sites = getSites();
      const site = sites.find(s => s.url === siteUrl);
      const sitemapUrl = site?.sitemapUrl || `${siteUrl.replace(/\/$/, "")}/sitemap.xml`;
      const sitemapUrls = await fetchSitemap(sitemapUrl);
      existingPages = sitemapUrls.map(u => u.loc);
      console.log(`[Analysis] Found ${existingPages.length} existing pages from sitemap`);
    } catch (err) {
      console.log("[Analysis] Sitemap fetch failed:", err instanceof Error ? err.message : err);
    }
  }

  const client = new Anthropic({ apiKey });

  const topKeywords = keywords
    .sort((a, b) => b.impressions - a.impressions)
    .slice(0, 100)
    .map((k) => `"${k.query}" (imp: ${k.impressions}, clicks: ${k.clicks}, pos: ${k.position})`)
    .join("\n");

  const topTopics = trendingTopics
    .slice(0, 20)
    .map((t) => `"${t.title}" (source: ${t.source}${t.subreddit ? `, r/${t.subreddit}` : ""})`)
    .join("\n");

  const existingPagesList = existingPages.length > 0
    ? `\n## EXISTING PAGES ON THIS SITE (${existingPages.length} pages — DO NOT suggest content that already exists):\n${existingPages.slice(0, 200).map(u => {
        try { return new URL(u).pathname; } catch { return u; }
      }).join("\n")}`
    : "";

  const prompt = `You are an SEO content strategist. Based on the search data and trending topics below, create a PRIORITY-RANKED content plan for the next 7 days.

## Search Console Keywords (top 100):
${topKeywords}

## Trending Topics (Reddit & Quora):
${topTopics}
${existingPagesList}

RULES:
1. Return EXACTLY 7 content ideas — one per day for the next week
2. Rank by PRIORITY — Day 1 should be the highest-impact content to publish first
3. Priority is based on: high impressions + poor position (quick wins), trending topics, content gaps
4. NEVER suggest content that already exists on the site (check the existing pages list)
5. Each idea must be specific and actionable — not generic
6. Focus on topics where the site already gets impressions but needs better content to rank higher
7. Include the target keyword for each idea

Return JSON ONLY:
{
  "ideas": [
    {
      "title": "Exact article title to use",
      "description": "What to cover in 2-3 sentences",
      "relatedKeywords": ["primary keyword", "secondary keyword"],
      "difficulty": "low|medium|high",
      "contentType": "blog|guide|case-study|tool|video",
      "estimatedSearchVolume": "low|medium|high",
      "day": 1,
      "reason": "Why this is priority — e.g. 'Getting 79 impressions at position 9.1, needs dedicated page to rank top 3'"
    }
  ],
  "summary": "2-3 sentence summary of the 7-day content strategy"
}`;

  const message = await client.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 4096,
    messages: [{ role: "user", content: prompt }],
  });

  const text = message.content[0].type === "text" ? message.content[0].text : "";

  try {
    const result = JSON.parse(text);
    return {
      ideas: result.ideas || [],
      clusters: [],
      gaps: [],
      summary: result.summary || "",
      analyzedAt: new Date().toISOString(),
    };
  } catch {
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const result = JSON.parse(jsonMatch[0]);
      return {
        ideas: result.ideas || [],
        clusters: [],
        gaps: [],
        summary: result.summary || "",
        analyzedAt: new Date().toISOString(),
      };
    }
    throw new Error("Failed to parse Claude response as JSON");
  }
}
