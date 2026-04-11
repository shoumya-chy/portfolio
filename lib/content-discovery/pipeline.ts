import Anthropic from "@anthropic-ai/sdk";
import type { Keyword, TrendingTopic, TopicCandidate, TopicRecommendation, DiscoveryResult, PipelineStats, SiteNicheProfile } from "@/lib/types";
import { getApiKey } from "@/lib/config";
import { fetchGSCData } from "@/lib/api-clients/gsc-client";
import { fetchWordPressData, type WPPost } from "@/lib/api-clients/wordpress-client";
import { fetchPAAAndRelated } from "@/lib/api-clients/dataforseo-client";
import { fetchQuoraForProfile } from "@/lib/api-clients/quora-fetcher";
import { deriveSiteNicheProfile } from "./niche-analyzer";
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
 *   1. Fetch GSC + Bing + WordPress in parallel
 *   2. Derive site niche profile from WP content (via Claude Haiku, cached 7 days)
 *   3. Fetch Quora questions using niche-aware DataForSEO SERP searches
 *   4. Fetch DataForSEO PAA + Related using GSC near-miss keywords + niche keywords as seeds
 *   5. Build candidate pool → Dedup → Exclude published → Score
 *   6. Send top 40 to Claude for final clustering and rationale
 *   7. Return recommendations
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

  // ── Step 1: Fetch core data sources in parallel ──
  const [gscData, bingData, wpData] = await Promise.all([
    fetchGSCData(siteUrl).catch(err => {
      console.log("[Discovery] GSC fetch failed:", err instanceof Error ? err.message : err);
      return null;
    }),
    fetchBingDataSafe(siteUrl),
    fetchWordPressData(siteUrl),
  ]);

  const gscKeywords: Keyword[] = gscData?.keywords || [];
  const bingKeywords: Keyword[] = bingData?.keywords || [];
  const wpPosts: WPPost[] = wpData?.content?.filter(p => p.type === "post") || [];

  stats.gscKeywords = gscKeywords.length;
  stats.bingKeywords = bingKeywords.length;
  stats.wpPostsChecked = wpPosts.length;

  console.log(`[Discovery] Data: ${gscKeywords.length} GSC, ${bingKeywords.length} Bing, ${wpPosts.length} WP posts`);

  // ── Step 2: Derive niche profile (needed for Quora + seed expansion) ──
  let nicheProfile: SiteNicheProfile | null = null;
  try {
    nicheProfile = await deriveSiteNicheProfile(siteUrl, wpData);
  } catch (err) {
    console.log(`[Discovery] Niche profiling failed:`, err instanceof Error ? err.message : err);
  }

  // ── Step 3: Fetch Quora + DataForSEO PAA in parallel ──
  //
  // Seed keywords for PAA = GSC near-misses (position 8-25, impressions ≥ 15)
  // plus niche-profile primary keywords as a fallback for new sites.
  let seedKeywords = gscKeywords
    .filter(k => k.impressions >= 15 && k.position >= 8 && k.position <= 25)
    .sort((a, b) => b.impressions - a.impressions)
    .slice(0, 12)
    .map(k => k.query);

  // Top-up with lower-volume GSC keywords if we have fewer than 10 seeds
  if (seedKeywords.length < 10) {
    const extras = gscKeywords
      .filter(k => k.impressions >= 5 && k.position >= 5 && k.position <= 30)
      .sort((a, b) => b.impressions - a.impressions)
      .slice(0, 12)
      .map(k => k.query)
      .filter(q => !seedKeywords.includes(q));
    seedKeywords = [...seedKeywords, ...extras].slice(0, 12);
  }

  // Final fallback: use niche profile primary keywords for brand-new sites
  // that have no meaningful GSC data yet.
  if (seedKeywords.length < 5 && nicheProfile?.primaryKeywords?.length) {
    const nicheSeeds = nicheProfile.primaryKeywords
      .filter(k => !seedKeywords.includes(k))
      .slice(0, 10 - seedKeywords.length);
    seedKeywords = [...seedKeywords, ...nicheSeeds];
    console.log(`[Discovery] Low GSC seed count — padded with ${nicheSeeds.length} niche-profile keywords`);
  }

  console.log(`[Discovery] Sending ${seedKeywords.length} seed keywords to DataForSEO`);

  const [{ paaQuestions, relatedSearches }, quoraData] = await Promise.all([
    fetchPAAAndRelated(seedKeywords).catch(err => {
      console.log(`[Discovery] PAA fetch failed:`, err instanceof Error ? err.message : err);
      return { paaQuestions: [], relatedSearches: [] };
    }),
    nicheProfile
      ? fetchQuoraForProfile(nicheProfile).catch(err => {
          console.log(`[Discovery] Quora fetch failed:`, err instanceof Error ? err.message : err);
          return [] as TrendingTopic[];
        })
      : Promise.resolve([] as TrendingTopic[]),
  ]);

  stats.paaQuestions = paaQuestions.length;
  stats.quoraTopics = quoraData.length;

  console.log(`[Discovery] DataForSEO: ${paaQuestions.length} PAA, ${relatedSearches.length} related | Quora: ${quoraData.length} relevant`);

  // ── Step 4: Build candidate pool ──
  const rawCandidates = buildCandidatePool(gscKeywords, bingKeywords, paaQuestions, relatedSearches, quoraData);
  stats.totalCandidates = rawCandidates.length;
  console.log(`[Discovery] Raw candidates: ${rawCandidates.length}`);

  // ── Step 5: Dedup ──
  const deduped = deduplicateCandidates(rawCandidates);
  stats.afterDedup = deduped.length;
  console.log(`[Discovery] After dedup: ${deduped.length}`);

  // ── Step 6: Exclude published posts ──
  const { passed, excluded } = filterAgainstPublished(deduped, wpPosts);
  stats.afterExclusion = passed.length;
  console.log(`[Discovery] After exclusion: ${passed.length} (excluded ${excluded.length})`);
  for (const ex of excluded.slice(0, 10)) {
    console.log(`[Discovery]   Excluded "${ex.topic}" → matched "${ex.matchedPost}"`);
  }

  // ── Step 7: Score ──
  const scored = scoreCandidates(passed);

  // ── Step 8: Claude final analysis ──
  const top40 = scored.slice(0, 40);
  const recommendations = await claudeFinalAnalysis(top40, wpPosts, nicheProfile);
  stats.finalRecommendations = recommendations.length;

  console.log(`[Discovery] Final: ${recommendations.length} recommendations`);

  // Build summary
  const nicheNote = nicheProfile
    ? ` Profiled ${nicheProfile.niches.length} niches (${nicheProfile.niches.slice(0, 3).join(", ")}${nicheProfile.niches.length > 3 ? "…" : ""}).`
    : "";
  const summary = `Analyzed ${stats.gscKeywords} GSC keywords, ${stats.bingKeywords} Bing keywords, ${stats.paaQuestions} PAA questions, and ${stats.quoraTopics} Quora topics.${nicheNote} Found ${stats.totalCandidates} candidates, deduped to ${stats.afterDedup}, excluded ${stats.afterDedup - stats.afterExclusion} (matched ${stats.wpPostsChecked} published posts), scored and sent top 40 to Claude. Final: ${stats.finalRecommendations} recommendations.`;

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
 * Claude final pass: cluster, rationale, remove remaining dupes.
 * Now also uses the site's niche profile so Claude can weight
 * multi-niche sites properly and write niche-aware rationales.
 */
async function claudeFinalAnalysis(
  candidates: TopicCandidate[],
  wpPosts: WPPost[],
  nicheProfile: SiteNicheProfile | null
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

  const nicheBlock = nicheProfile
    ? `
## SITE NICHE PROFILE
- Niches: ${nicheProfile.niches.join(" | ")}
- Audience: ${nicheProfile.audience}
${nicheProfile.geography ? `- Geography: ${nicheProfile.geography}` : ""}

Use these niches when clustering and when writing rationales. For MULTI-NICHE sites, try to balance coverage so the final picks span the site's core niches — don't return 20 recommendations all about one niche.
`
    : "";

  const prompt = `You are an SEO content strategist. I have a scored list of 40 content topic candidates. Your job is to finalize them.
${nicheBlock}
## EXISTING PUBLISHED POSTS (do NOT include any topic that duplicates these):
${existingTitles}

## SCORED CANDIDATES (ranked by algorithmic score):
${candidateList}

## YOUR TASK:
1. Remove any remaining duplicates or near-duplicates you spot (both among candidates AND against published posts)
2. Group remaining candidates into content clusters. Use niche-specific cluster names when the site has multiple niches (e.g. "Investing — Beginner Guides", "Budgeting — Tools", "Superannuation — Q&A"). Otherwise use generic clusters like "How-to Guides", "Comparison", "Tools & Resources", "Beginner Guides".
3. For each topic, write a one-sentence rationale explaining why it's a good content opportunity for THIS site's audience.
4. For each topic, write a "suggestedTitle" — a catchy, SEO-ready blog post title (60-65 chars max). Do NOT return the raw search query as the title.
5. Keep the top 20 maximum. For multi-niche sites, try to balance across niches.

Return ONLY a JSON array — no markdown, no preamble:
[
  {
    "topic": "exact topic string from the candidates",
    "suggestedTitle": "catchy blog post title",
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
