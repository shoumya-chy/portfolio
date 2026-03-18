import Anthropic from "@anthropic-ai/sdk";
import type { Keyword, TrendingTopic, AnalysisResult, ContentIdea, PageKeywordMap } from "@/lib/types";
import { getApiKey } from "@/lib/config";
import { fetchGSCPageKeywords } from "@/lib/api-clients/gsc-client";
import {
  fetchWordPressData,
  buildExistingTopicSet,
  isIdeaDuplicate,
  type WPPost,
} from "@/lib/api-clients/wordpress-client";

/**
 * Merge GSC page-keyword data with WordPress post data.
 * Creates a rich picture: "Article X ranks for these keywords at these positions"
 */
function buildPageAnalysis(
  pageKeywords: PageKeywordMap[],
  wpPosts: WPPost[]
): string {
  if (pageKeywords.length === 0) return "";

  const lines: string[] = [];
  lines.push("## EXISTING PAGES AND THEIR KEYWORDS\n");
  lines.push("Each page shows what keywords it currently ranks for. Use this to decide:");
  lines.push("- OPTIMIZE: if a page ranks for keywords at poor position → suggest adding those keywords to the article");
  lines.push("- NEW: if keywords have no matching page → suggest a new article\n");

  // Match GSC pages to WP posts by URL
  const topPages = pageKeywords.slice(0, 40); // Top 40 pages by impressions

  for (const page of topPages) {
    const wpPost = wpPosts.find(p => {
      const pageClean = page.url.replace(/\/$/, "").toLowerCase();
      const postClean = p.url.replace(/\/$/, "").toLowerCase();
      return pageClean === postClean;
    });

    const title = wpPost?.title || page.url;
    const wordCount = wpPost?.wordCount || 0;
    const focusKw = wpPost?.seo?.focusKeyword || "";

    lines.push(`### ${title}`);
    if (wordCount > 0) lines.push(`   ${wordCount} words${focusKw ? ` | Focus: "${focusKw}"` : ""} | ${page.url}`);

    // Show top keywords for this page
    const topKws = page.keywords.slice(0, 8);
    for (const kw of topKws) {
      const status = kw.position <= 3 ? "TOP3" : kw.position <= 10 ? "PAGE1" : kw.position <= 20 ? "PAGE2" : "DEEP";
      lines.push(`   - "${kw.query}" → ${kw.impressions} imp, ${kw.clicks} clicks, pos ${kw.position} [${status}]`);
    }
    if (page.keywords.length > 8) {
      lines.push(`   - ...and ${page.keywords.length - 8} more keywords`);
    }
    lines.push("");
  }

  return lines.join("\n");
}

/**
 * Find "orphan keywords" — keywords getting impressions but NOT assigned to any strong page
 */
function findOrphanKeywords(
  allKeywords: Keyword[],
  pageKeywords: PageKeywordMap[]
): string {
  // Build a set of keywords that have a dedicated page ranking in top 20
  const coveredKeywords = new Set<string>();
  for (const page of pageKeywords) {
    for (const kw of page.keywords) {
      if (kw.position <= 20) {
        coveredKeywords.add(kw.query.toLowerCase());
      }
    }
  }

  // Find high-impression keywords not covered
  const orphans = allKeywords
    .filter(k => k.impressions >= 3 && !coveredKeywords.has(k.query.toLowerCase()))
    .sort((a, b) => b.impressions - a.impressions)
    .slice(0, 30);

  if (orphans.length === 0) return "";

  const lines = ["\n## ORPHAN KEYWORDS (getting impressions but NO page ranks well for them — NEED NEW CONTENT):\n"];
  for (const kw of orphans) {
    lines.push(`- "${kw.query}" → ${kw.impressions} imp, pos ${kw.position}`);
  }
  return lines.join("\n");
}

export async function analyzeContentIdeas(
  keywords: Keyword[],
  trendingTopics: TrendingTopic[],
  siteUrl?: string
): Promise<AnalysisResult> {
  const apiKey = getApiKey("anthropic");
  if (!apiKey) throw new Error("Anthropic API key not configured.");

  // Step 1: Fetch all data in parallel
  let wpPosts: WPPost[] = [];
  let existingTitles: string[] = [];
  let existingTopicSet = new Set<string>();
  let pageKeywords: PageKeywordMap[] = [];

  if (siteUrl) {
    const [wpData, gscPages] = await Promise.all([
      fetchWordPressData(siteUrl),
      fetchGSCPageKeywords(siteUrl).catch(() => [] as PageKeywordMap[]),
    ]);

    if (wpData?.content?.length) {
      wpPosts = wpData.content.filter(p => p.type === "post");
      existingTitles = wpPosts.map(p => p.title);
      existingTopicSet = buildExistingTopicSet(wpData);
      console.log(`[Analysis] WP: ${wpPosts.length} posts`);
    }

    pageKeywords = gscPages;
    console.log(`[Analysis] GSC pages: ${pageKeywords.length} pages with keyword data`);
  }

  // Step 2: Build the analysis blocks
  const pageAnalysis = buildPageAnalysis(pageKeywords, wpPosts);
  const orphanKeywords = findOrphanKeywords(keywords, pageKeywords);

  const topTopics = trendingTopics
    .slice(0, 15)
    .map(t => `- ${t.title} (${t.source})`)
    .join("\n");

  // Step 3: Claude prompt
  const client = new Anthropic({ apiKey });

  const prompt = `You are an expert SEO content strategist. Analyze this site's keyword performance and recommend actions.

${pageAnalysis}
${orphanKeywords}

## TRENDING TOPICS (Reddit & Quora):
${topTopics || "(none)"}

## YOUR TASK

Based on the data above, give me exactly 10 content recommendations. There are TWO types:

**OPTIMIZE** — An existing page ranks for valuable keywords but at poor positions (page 2+). Suggest what keywords to add, what sections to expand, what to improve.

**NEW** — Orphan keywords or trending topics that have NO matching page. Suggest a new article.

RULES:
1. Prioritize by IMPACT — highest impressions × worst position = biggest opportunity
2. For OPTIMIZE: reference the exact existing page URL and which keywords to target
3. For NEW: reference the exact orphan keywords from the data
4. Be specific — not generic advice
5. Every recommendation must reference actual keyword data with numbers

Return ONLY valid JSON:
{
  "ideas": [
    {
      "title": "Article title or optimization task",
      "description": "Specific action: what to write, which keywords to target, what to add (2-3 sentences)",
      "relatedKeywords": ["primary keyword", "secondary keyword"],
      "difficulty": "low|medium|high",
      "contentType": "blog|guide|case-study|tool|video",
      "estimatedSearchVolume": "low|medium|high",
      "day": 1,
      "reason": "Getting X impressions at position Y, needs Z",
      "action": "optimize|new",
      "existingUrl": "https://... (only for optimize, empty for new)"
    }
  ],
  "summary": "2-3 sentence strategy overview"
}`;

  const message = await client.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 4096,
    messages: [{ role: "user", content: prompt }],
  });

  const text = message.content[0].type === "text" ? message.content[0].text : "";

  let ideas: ContentIdea[] = [];
  let summary = "";

  try {
    const result = JSON.parse(text);
    ideas = result.ideas || [];
    summary = result.summary || "";
  } catch {
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const result = JSON.parse(jsonMatch[0]);
      ideas = result.ideas || [];
      summary = result.summary || "";
    } else {
      throw new Error("Failed to parse Claude response");
    }
  }

  // Step 4: Programmatic dedup — only for "new" ideas
  if (existingTitles.length > 0) {
    const beforeCount = ideas.length;
    ideas = ideas.filter(idea => {
      if (idea.action === "optimize") return true; // Keep optimize suggestions
      const isDup = isIdeaDuplicate(
        idea.title,
        idea.relatedKeywords || [],
        existingTopicSet,
        existingTitles
      );
      if (isDup) console.log(`[Analysis] FILTERED duplicate: "${idea.title}"`);
      return !isDup;
    });
    if (beforeCount !== ideas.length) {
      console.log(`[Analysis] Dedup: ${beforeCount} → ${ideas.length} (removed ${beforeCount - ideas.length})`);
    }
  }

  // Re-number
  ideas = ideas.slice(0, 10).map((idea, i) => ({ ...idea, day: i + 1 }));

  return {
    ideas,
    clusters: [],
    gaps: [],
    summary,
    analyzedAt: new Date().toISOString(),
  };
}
