import Anthropic from "@anthropic-ai/sdk";
import type { Keyword, TrendingTopic, AnalysisResult, ContentIdea, TrendingContentIdea, PageKeywordMap } from "@/lib/types";
import { getApiKey } from "@/lib/config";
import { fetchGSCPageKeywords } from "@/lib/api-clients/gsc-client";
import {
  fetchWordPressData,
  buildExistingTopicSet,
  isIdeaDuplicate,
  type WPPost,
} from "@/lib/api-clients/wordpress-client";

function normalize(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9\s]/g, "").replace(/\s+/g, " ").trim();
}

/**
 * Merge GSC page-keyword data with WordPress post data.
 */
function buildPageAnalysis(pageKeywords: PageKeywordMap[], wpPosts: WPPost[]): string {
  if (pageKeywords.length === 0) return "";

  const lines: string[] = [];
  lines.push("## EXISTING PAGES AND THEIR KEYWORDS\n");
  lines.push("OPTIMIZE = page ranks poorly for valuable keywords. NEW = no page exists.\n");

  const topPages = pageKeywords.slice(0, 40);

  for (const page of topPages) {
    const wpPost = wpPosts.find(p =>
      page.url.replace(/\/$/, "").toLowerCase() === p.url.replace(/\/$/, "").toLowerCase()
    );

    const title = wpPost?.title || page.url;
    const wordCount = wpPost?.wordCount || 0;
    const focusKw = wpPost?.seo?.focusKeyword || "";

    lines.push(`### ${title}`);
    if (wordCount > 0) lines.push(`   ${wordCount} words${focusKw ? ` | Focus: "${focusKw}"` : ""} | ${page.url}`);

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
 * Find orphan keywords — getting impressions but no page ranks well
 */
function findOrphanKeywords(allKeywords: Keyword[], pageKeywords: PageKeywordMap[]): string {
  const coveredKeywords = new Set<string>();
  for (const page of pageKeywords) {
    for (const kw of page.keywords) {
      if (kw.position <= 20) coveredKeywords.add(kw.query.toLowerCase());
    }
  }

  const orphans = allKeywords
    .filter(k => k.impressions >= 3 && !coveredKeywords.has(k.query.toLowerCase()))
    .sort((a, b) => b.impressions - a.impressions)
    .slice(0, 30);

  if (orphans.length === 0) return "";

  const lines = ["\n## ORPHAN KEYWORDS (need NEW content):\n"];
  for (const kw of orphans) {
    lines.push(`- "${kw.query}" → ${kw.impressions} imp, pos ${kw.position}`);
  }
  return lines.join("\n");
}

/**
 * Cross-reference trending topics against existing WP content.
 * Returns topics NOT already covered by the site.
 */
function findUncoveredTrendingTopics(
  trendingTopics: TrendingTopic[],
  existingTopicSet: Set<string>,
  existingTitles: string[]
): TrendingTopic[] {
  return trendingTopics.filter(topic => {
    const normTitle = normalize(topic.title);

    // Check against existing titles
    for (const existing of existingTitles) {
      const normExisting = normalize(existing);
      // Word overlap check
      const topicWords = normTitle.split(/\s+/).filter(w => w.length > 3);
      const existingWords = new Set(normExisting.split(/\s+/).filter(w => w.length > 3));
      if (topicWords.length > 0) {
        const overlap = topicWords.filter(w => existingWords.has(w)).length;
        if (overlap / topicWords.length >= 0.5) return false;
      }
    }

    // Check bigrams against existing topic set
    const words = normTitle.split(/\s+/).filter(w => w.length > 2);
    for (let i = 0; i < words.length - 1; i++) {
      const bigram = words.slice(i, i + 2).join(" ");
      if (bigram.length > 8 && existingTopicSet.has(bigram)) return false;
    }

    return true;
  });
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

  // Step 2: Cross-reference trending topics — find what's NOT covered
  const uncoveredTopics = findUncoveredTrendingTopics(trendingTopics, existingTopicSet, existingTitles);
  const coveredCount = trendingTopics.length - uncoveredTopics.length;
  console.log(`[Analysis] Trending: ${trendingTopics.length} total, ${coveredCount} already covered, ${uncoveredTopics.length} uncovered`);

  // Step 3: Build analysis blocks
  const pageAnalysis = buildPageAnalysis(pageKeywords, wpPosts);
  const orphanKeywords = findOrphanKeywords(keywords, pageKeywords);

  // Step 4: Build trending topics block for prompt — only uncovered ones
  const redditUncovered = uncoveredTopics.filter(t => t.source === "reddit");
  const quoraUncovered = uncoveredTopics.filter(t => t.source === "quora");

  let trendingBlock = "";
  if (redditUncovered.length > 0) {
    trendingBlock += "\n## UNCOVERED REDDIT TOPICS (people are asking about these but site has NO content):\n";
    trendingBlock += redditUncovered.slice(0, 10).map(t => `- ${t.title} (r/${t.subreddit}, score: ${t.score})`).join("\n");
  }
  if (quoraUncovered.length > 0) {
    trendingBlock += "\n\n## UNCOVERED QUORA TOPICS (questions being asked but site has NO answers):\n";
    trendingBlock += quoraUncovered.slice(0, 10).map(t => `- ${t.title}`).join("\n");
  }

  // Step 5: Claude prompt — TWO sections in one call
  const client = new Anthropic({ apiKey });

  const prompt = `You are an expert SEO content strategist. Analyze this site's data and provide TWO types of recommendations.

${pageAnalysis}
${orphanKeywords}
${trendingBlock}

## YOUR TASK — Return TWO sections:

### SECTION 1: "ideas" — GSC/Bing keyword-based recommendations (exactly 10)
Based on the page-keyword data and orphan keywords:
- **OPTIMIZE**: existing page ranks poorly for valuable keywords → suggest improvements
- **NEW**: orphan keywords need a new article

### SECTION 2: "trendingIdeas" — Reddit & Quora opportunities (up to 5)
Based on the UNCOVERED trending topics above:
- These are topics people are actively discussing online but this site has NO content about
- Each idea should be a specific article that answers the trending question/topic
- Cross-reference with GSC keywords where possible — if a trending topic also matches a keyword, it's higher priority

RULES:
1. Prioritize by IMPACT
2. For OPTIMIZE: reference exact page URL and keywords with data
3. For NEW: reference exact orphan keywords
4. For trendingIdeas: reference the exact Reddit/Quora topic
5. Be specific, reference actual numbers

Return ONLY valid JSON:
{
  "ideas": [
    {
      "title": "string",
      "description": "string",
      "relatedKeywords": ["primary", "secondary"],
      "difficulty": "low|medium|high",
      "contentType": "blog|guide|case-study|tool|video",
      "estimatedSearchVolume": "low|medium|high",
      "day": 1,
      "reason": "string with data",
      "action": "optimize|new",
      "existingUrl": "url or empty"
    }
  ],
  "trendingIdeas": [
    {
      "title": "Article title targeting this trending topic",
      "description": "What to cover and why it's timely",
      "sourceTopics": ["exact Reddit/Quora topic title that inspired this"],
      "source": "reddit|quora|both",
      "relatedKeywords": ["keyword if any matches from GSC"],
      "difficulty": "low|medium|high"
    }
  ],
  "summary": "2-3 sentence strategy overview"
}`;

  const message = await client.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 6000,
    messages: [{ role: "user", content: prompt }],
  });

  const text = message.content[0].type === "text" ? message.content[0].text : "";

  let ideas: ContentIdea[] = [];
  let trendingIdeas: TrendingContentIdea[] = [];
  let summary = "";

  try {
    const result = JSON.parse(text);
    ideas = result.ideas || [];
    trendingIdeas = result.trendingIdeas || [];
    summary = result.summary || "";
  } catch {
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const result = JSON.parse(jsonMatch[0]);
      ideas = result.ideas || [];
      trendingIdeas = result.trendingIdeas || [];
      summary = result.summary || "";
    } else {
      throw new Error("Failed to parse Claude response");
    }
  }

  // Step 6: Programmatic dedup on "new" ideas
  if (existingTitles.length > 0) {
    const beforeCount = ideas.length;
    ideas = ideas.filter(idea => {
      if (idea.action === "optimize") return true;
      const isDup = isIdeaDuplicate(idea.title, idea.relatedKeywords || [], existingTopicSet, existingTitles);
      if (isDup) console.log(`[Analysis] FILTERED duplicate: "${idea.title}"`);
      return !isDup;
    });
    if (beforeCount !== ideas.length) {
      console.log(`[Analysis] Dedup: ${beforeCount} → ${ideas.length}`);
    }

    // Also dedup trending ideas
    trendingIdeas = trendingIdeas.filter(idea => {
      const isDup = isIdeaDuplicate(idea.title, idea.relatedKeywords || [], existingTopicSet, existingTitles);
      if (isDup) console.log(`[Analysis] FILTERED trending duplicate: "${idea.title}"`);
      return !isDup;
    });
  }

  ideas = ideas.slice(0, 10).map((idea, i) => ({ ...idea, day: i + 1 }));
  trendingIdeas = trendingIdeas.slice(0, 5);

  return {
    ideas,
    trendingIdeas,
    clusters: [],
    gaps: [],
    summary,
    analyzedAt: new Date().toISOString(),
  };
}
