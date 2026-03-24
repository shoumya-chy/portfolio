/**
 * Smart Topic Selector for Guest Post Outreach.
 *
 * Uses Claude to pick the best 2-3 guest post topics based on:
 * 1. The prospect site's niche and categories
 * 2. Our backlink needs (GSC + Bing data showing which pages need ranking boosts)
 *
 * All SEO data comes from cache — no API calls to GSC/Bing.
 */

import Anthropic from "@anthropic-ai/sdk";
import { getApiKey } from "@/lib/config";
import { buildKeywordProfile, getPagesNeedingBacklinks, getCachedWordPressData } from "@/lib/outreach/seo-data";
import type { BacklinkTarget } from "@/lib/outreach/types";

export interface TopicSuggestion {
  topic: string;
  angle: string;              // The unique angle/hook for the topic
  targetPage: string;         // URL of our page that would get the backlink
  targetKeyword: string;      // The keyword we want to rank for
  whyRelevant: string;        // Why this topic fits the prospect's site
}

/**
 * Select the best guest post topics for a specific prospect.
 *
 * @param prospectDomain - The prospect's website domain
 * @param prospectNiche - The prospect site's detected niche/category
 * @param prospectGuidelines - Any submission guidelines we found
 * @param siteUrl - Our site URL
 * @param ourNiche - Our site's niche
 * @param backlinkTargets - Pre-calculated backlink targets (from backlink-strategy)
 */
export async function selectTopicsForProspect(
  prospectDomain: string,
  prospectNiche: string,
  prospectGuidelines: string,
  siteUrl: string,
  ourNiche: string,
  backlinkTargets: BacklinkTarget[]
): Promise<TopicSuggestion[]> {
  const apiKey = getApiKey("anthropic");
  if (!apiKey) throw new Error("Anthropic API key not configured");

  // Gather our SEO intelligence from cache
  const keywordProfile = buildKeywordProfile(siteUrl);
  const pagesNeedingLinks = getPagesNeedingBacklinks(siteUrl);
  const wpData = getCachedWordPressData(siteUrl);

  // Build context about our existing content
  const existingPosts = wpData?.content
    ?.filter(p => p.type === "post")
    ?.slice(0, 30)
    ?.map(p => `- "${p.title}" [keyword: ${p.seo?.focusKeyword || "n/a"}] (${p.categories.join(", ")})`)
    ?.join("\n") || "No WordPress data available";

  // Build our backlink needs summary
  const backlinkNeeds = (backlinkTargets.length > 0 ? backlinkTargets : pagesNeedingLinks)
    .slice(0, 10)
    .map(t => {
      if ("score" in t) {
        const bt = t as BacklinkTarget;
        return `- "${bt.title}" → keyword: "${bt.focusKeyword}" (position: ${bt.position}, impressions: ${bt.impressions}, priority: ${bt.priority})`;
      }
      return `- "${t.title}" → keyword: "${("focusKeyword" in t) ? t.focusKeyword : ""}" (position: ${t.position}, impressions: ${t.impressions})`;
    })
    .join("\n") || "No backlink targets available";

  // Build keyword intelligence
  const weakKeywordsSummary = keywordProfile.weakKeywords
    .slice(0, 15)
    .map(k => `"${k.query}" (pos: ${k.position.toFixed(1)}, imp: ${k.impressions})`)
    .join(", ") || "No keyword data";

  const strongKeywordsSummary = keywordProfile.strongKeywords
    .slice(0, 10)
    .map(k => `"${k.query}" (pos: ${k.position.toFixed(1)})`)
    .join(", ") || "No strong keywords";

  const topCategories = keywordProfile.topCategories.slice(0, 15).join(", ") || "Unknown";

  const client = new Anthropic({ apiKey });

  const message = await client.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 1500,
    messages: [{
      role: "user",
      content: `You are an expert SEO strategist. Pick 2-3 guest post topics that I should pitch to a specific prospect site.

=== PROSPECT SITE ===
Domain: ${prospectDomain}
Niche/Category: ${prospectNiche || "General/Unknown"}
Submission Guidelines: ${prospectGuidelines || "None found"}

=== OUR SITE (${siteUrl}) ===
Niche: ${ourNiche}
Top content categories: ${topCategories}

Our existing posts:
${existingPosts}

=== OUR BACKLINK NEEDS (pages that need ranking boosts) ===
${backlinkNeeds}

=== OUR KEYWORD INTELLIGENCE ===
Keywords we're close to ranking for (position 4-30, need backlinks):
${weakKeywordsSummary}

Keywords we already dominate (our authority areas):
${strongKeywordsSummary}

=== YOUR TASK ===
Select 2-3 topics that:
1. MATCH the prospect site's niche — their readers must care about this topic
2. HELP our SEO — each topic should naturally allow us to link back to one of our pages that needs a ranking boost
3. Are SPECIFIC and ACTIONABLE — not vague like "digital marketing tips" but specific like "How to Use Schema Markup to Boost Local SEO Rankings"
4. Show EXPERTISE — demonstrate we know the subject deeply
5. Are NOT duplicates of our existing posts — they should be fresh angles that complement our content

For each topic, specify:
- Which of our pages would get the backlink
- Which keyword we're targeting
- Why this topic fits the prospect's audience

Return ONLY valid JSON array:
[
  {
    "topic": "Specific Article Title",
    "angle": "The unique hook or angle that makes this interesting",
    "targetPage": "URL of our page that benefits from this backlink",
    "targetKeyword": "The keyword we want to boost",
    "whyRelevant": "One sentence on why this fits their audience"
  }
]`,
    }],
  });

  const text = message.content[0].type === "text" ? message.content[0].text : "";

  try {
    const parsed = JSON.parse(text);
    if (Array.isArray(parsed)) return parsed as TopicSuggestion[];
  } catch {
    const match = text.match(/\[[\s\S]*\]/);
    if (match) {
      try {
        return JSON.parse(match[0]) as TopicSuggestion[];
      } catch { /* fall through */ }
    }
  }

  // Fallback: generate generic topics based on our niche
  console.log("[TopicSelector] Failed to parse Claude response, using fallback topics");
  const fallbackTarget = backlinkTargets[0] || pagesNeedingLinks[0];
  return [{
    topic: `Expert Guide: ${ourNiche} Best Practices for ${new Date().getFullYear()}`,
    angle: "Comprehensive overview with actionable tips",
    targetPage: fallbackTarget?.url || siteUrl,
    targetKeyword: ("focusKeyword" in (fallbackTarget || {})) ? (fallbackTarget as BacklinkTarget).focusKeyword || ourNiche : ourNiche,
    whyRelevant: `Relevant to ${prospectNiche || "their"} audience interested in ${ourNiche}`,
  }];
}
