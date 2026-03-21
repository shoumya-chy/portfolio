import Anthropic from "@anthropic-ai/sdk";
import type { Keyword, TrendingTopic, TopicCandidate, TopicRecommendation, DiscoveryResult, PipelineStats } from "@/lib/types";
import { getApiKey } from "@/lib/config";
import { fetchGSCData, fetchGSCPageKeywords } from "@/lib/api-clients/gsc-client";
import { fetchWordPressData, type WPPost } from "@/lib/api-clients/wordpress-client";
import { fetchPAAAndRelated } from "@/lib/api-clients/dataforseo-client";
import { fetchQuoraTopics } from "@/lib/api-clients/quora-scraper";
import {
  buildCandidatePool,
  deduplicateCandidates,
  filterAgainstPublished,
  scoreCandidates,
} from "./scoring-engine";

/**
 * Run the full content topic discovery pipeline.
 *
 * Flow:
 *   1. Fetch GSC keywords + page mapping
 *   2. Fetch Bing keywords
 *   3. Fetch WordPress posts (exclusion list)
 *   4. Fetch DataForSEO PAA + Related (using top GSC keywords as seeds)
 *   5. Fetch Quora topics
 *   6. Build candidate pool → Dedup → Exclude published → Score
 *   7. Send top 40 to Claude for final clustering and rationale
 *   8. Return recommendations
 */
export async function runDiscoveryPipeline(siteUrl: string): Promise<DiscoveryResult> {
  const stats: PipelineStats = {
    gscKeywords: 0,
    bingKeywords: 0,
    paaQuestions: 0,
    quoraTopics: 0,
    totalCandidates: 0,
    afterDedup: 0,
    afterExclusion: 0,
    finalRecommendations: 0,
    wpPostsChecked: 0,
  };

  console.log(`[Discovery] Starting pipeline for ${siteUrl}`);

  // ── Step 1: Fetch all data sources in parallel ──
  const [gscData, bingData, wpData, quoraData] = await Promise.all([
    fetchGSCData(siteUrl).catch(err => {
      console.log("[Discovery] GSC fetch failed:", err instanceof Error ? err.message : err);
      return null;
    }),
    fetchBingDataSafe(siteUrl),
    fetchWordPressData(siteUrl),
    fetchQuoraTopics().catch(() => [] as TrendingTopic[]),
  ]);

  const gscKeywords: Keyword[] = gscData?.keywords || [];
  const bingKeywords: Keyword[] = bingData?.keywords || [];
  const wpPosts: WPPost[] = wpData?.content?.filter(p => p.type === "post") || [];

  stats.gscKeywords = gscKeywords.length;
  stats.bingKeywords = bingKeywords.length;
  stats.quoraTopics = quoraData.length;
  stats.wpPostsChecked = wpPosts.length;

  console.log(`[Discovery] Data: ${gscKeywords.length} GSC, ${bingKeywords.length} Bing, ${wpPosts.length} WP posts, ${quoraData.length} Quora`);

  // ── Step 2: Fetch DataForSEO PAA using top GSC keywords as seeds ──
  const seedKeywords = gscKeywords
    .filter(k => k.impressions >= 10 && k.position >= 5 && k.position <= 30)
    .sort((a, b) => b.impressions - a.impressions)
    .slice(0, 15)
    .map(k => k.query);

  console.log(`[Discovery] Sending ${seedKeywords.length} seed keywords to DataForSEO`);

  const { paaQuestions, relatedSearches } = await fetchPAAAndRelated(seedKeywords);
  stats.paaQuestions = paaQuestions.length;

  console.log(`[Discovery] DataForSEO: ${paaQuestions.length} PAA, ${relatedSearches.length} related`);

  // ── Step 3: Build candidate pool ──
  const rawCandidates = buildCandidatePool(gscKeywords, bingKeywords, paaQuestions, relatedSearches, quoraData);
  stats.totalCandidates = rawCandidates.length;
  console.log(`[Discovery] Raw candidates: ${rawCandidates.length}`);

  // ── Step 4: Dedup ──
  const deduped = deduplicateCandidates(rawCandidates);
  stats.afterDedup = deduped.length;
  console.log(`[Discovery] After dedup: ${deduped.length}`);

  // ── Step 5: Exclude published posts ──
  const { passed, excluded } = filterAgainstPublished(deduped, wpPosts);
  stats.afterExclusion = passed.length;
  console.log(`[Discovery] After exclusion: ${passed.length} (excluded ${excluded.length})`);
  for (const ex of excluded.slice(0, 10)) {
    console.log(`[Discovery]   Excluded "${ex.topic}" → matched "${ex.matchedPost}"`);
  }

  // ── Step 6: Score ──
  const scored = scoreCandidates(passed);

  // ── Step 7: Claude final analysis ──
  const top40 = scored.slice(0, 40);
  const recommendations = await claudeFinalAnalysis(top40, wpPosts);
  stats.finalRecommendations = recommendations.length;

  console.log(`[Discovery] Final: ${recommendations.length} recommendations`);

  // Build summary
  const summary = `Analyzed ${stats.gscKeywords} GSC keywords, ${stats.bingKeywords} Bing keywords, ${stats.paaQuestions} PAA questions, and ${stats.quoraTopics} Quora topics. Found ${stats.totalCandidates} candidates, deduped to ${stats.afterDedup}, excluded ${stats.afterDedup - stats.afterExclusion} (matched ${stats.wpPostsChecked} published posts), scored and sent top 40 to Claude. Final: ${stats.finalRecommendations} recommendations.`;

  return {
    recommendations,
    stats,
    summary,
    analyzedAt: new Date().toISOString(),
  };
}

/**
 * Safe Bing data fetch (Bing uses a different key/endpoint)
 */
async function fetchBingDataSafe(siteUrl: string) {
  try {
    const { fetchBingData } = await import("@/lib/api-clients/bing-client");
    return await fetchBingData(siteUrl);
  } catch {
    return null;
  }
}

/**
 * Claude final pass: cluster, rationale, remove remaining dupes
 */
async function claudeFinalAnalysis(
  candidates: TopicCandidate[],
  wpPosts: WPPost[]
): Promise<TopicRecommendation[]> {
  const apiKey = getApiKey("anthropic");
  if (!apiKey) throw new Error("Anthropic API key not configured.");

  const client = new Anthropic({ apiKey });

  // Build existing posts reference (concise)
  const existingTitles = wpPosts.slice(0, 100).map(p => `- ${p.title}`).join("\n");

  // Build candidate list with scores and sources
  const candidateList = candidates.map((c, i) =>
    `${i + 1}. "${c.topic}" | score: ${c.score} | sources: ${c.sources.join(",")} | GSC: ${c.gscImpressions} imp pos ${c.gscPosition}`
  ).join("\n");

  const prompt = `You are an SEO content strategist. I have a scored list of 40 content topic candidates. Your job is to finalize them.

## EXISTING PUBLISHED POSTS (do NOT include any topic that duplicates these):
${existingTitles}

## SCORED CANDIDATES (ranked by algorithmic score):
${candidateList}

## YOUR TASK:
1. Remove any remaining duplicates or near-duplicates you spot (both among candidates AND against published posts)
2. Group remaining candidates into content clusters (e.g., "How-to Guides", "Comparison", "Local/Australia-specific", "Tools & Resources", "Beginner Guides")
3. For each topic, write a one-sentence rationale explaining why it's a good content opportunity
4. Keep the top 20 maximum

Return ONLY a JSON array — no markdown, no preamble:
[
  {
    "topic": "exact topic string from the candidates",
    "cluster": "cluster name",
    "rationale": "one sentence why this is valuable",
    "score": number from the candidate data,
    "source": "primary source: gsc | paa | bing | quora | related"
  }
]`;

  const message = await client.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 3000,
    messages: [{ role: "user", content: prompt }],
  });

  const text = message.content[0].type === "text" ? message.content[0].text : "";

  try {
    const parsed = JSON.parse(text);
    if (Array.isArray(parsed)) return parsed;
    if (parsed.recommendations) return parsed.recommendations;
    return [];
  } catch {
    // Try to extract array from text
    const match = text.match(/\[[\s\S]*\]/);
    if (match) return JSON.parse(match[0]);

    const objMatch = text.match(/\{[\s\S]*\}/);
    if (objMatch) {
      const obj = JSON.parse(objMatch[0]);
      if (Array.isArray(obj)) return obj;
    }

    console.log("[Discovery] Failed to parse Claude response");
    // Fallback: return candidates without Claude clustering
    return candidates.slice(0, 20).map(c => ({
      topic: c.topic,
      cluster: "Uncategorized",
      rationale: `Score ${c.score} from ${c.sources.join(", ")}`,
      score: c.score,
      source: c.sources[0],
    }));
  }
}
