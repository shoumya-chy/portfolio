import Anthropic from "@anthropic-ai/sdk";
import { getApiKey } from "@/lib/config";
import { getCache, setCache } from "@/lib/cache";
import type { WPSiteData } from "@/lib/api-clients/wordpress-client";
import type { SiteNicheProfile } from "@/lib/types";

/**
 * Derive a multi-niche profile for a WordPress site by sending a condensed
 * view of the site's content to Claude Haiku. The profile identifies the
 * core niches, target geography, audience, and a set of ready-to-run
 * Quora search queries tailored to this specific site.
 *
 * Cached 7 days per site — niches are stable, no need to re-run often.
 */
export async function deriveSiteNicheProfile(
  siteUrl: string,
  wpData: WPSiteData | null,
  forceRefresh = false
): Promise<SiteNicheProfile | null> {
  // Check cache unless forced
  if (!forceRefresh) {
    const cached = getCache<SiteNicheProfile>("niches", siteUrl);
    if (cached) {
      console.log(`[Niche] Using cached niche profile for ${siteUrl} (${cached.niches.length} niches)`);
      return cached;
    }
  }

  if (!wpData?.content?.length) {
    console.log(`[Niche] No WP data for ${siteUrl}, cannot derive niches`);
    return null;
  }

  const apiKey = getApiKey("anthropic");
  if (!apiKey) {
    console.log(`[Niche] Anthropic API key missing, cannot derive niches`);
    return null;
  }

  const posts = wpData.content.filter((p) => p.type === "post");
  if (posts.length === 0) {
    console.log(`[Niche] No published posts for ${siteUrl}`);
    return null;
  }

  // Build a concise content summary for Claude
  // Prioritise most recent 60 posts to capture current focus + keep token cost low
  const sortedPosts = [...posts].sort(
    (a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime()
  );
  const sample = sortedPosts.slice(0, 60);

  const titles = sample.map((p) => `- ${p.title}`).join("\n");

  // Collect unique categories and tags
  const catCount: Record<string, number> = {};
  const tagCount: Record<string, number> = {};
  const focusKws: string[] = [];

  for (const p of sample) {
    for (const c of p.categories || []) catCount[c] = (catCount[c] || 0) + 1;
    for (const t of p.tags || []) tagCount[t] = (tagCount[t] || 0) + 1;
    if (p.seo?.focusKeyword) focusKws.push(p.seo.focusKeyword);
  }

  const topCategories = Object.entries(catCount)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 15)
    .map(([c, n]) => `${c} (${n})`)
    .join(", ");

  const topTags = Object.entries(tagCount)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 20)
    .map(([t, n]) => `${t} (${n})`)
    .join(", ");

  const uniqueFocusKws = [...new Set(focusKws)].slice(0, 25).join(", ");

  const siteDescription = wpData.site?.description || "";
  const siteName = wpData.site?.name || siteUrl;

  const prompt = `You are analyzing a WordPress site to build a CONTENT NICHE PROFILE. The site may cover MULTIPLE niches — identify ALL of them, not just one.

## SITE
Name: ${siteName}
URL: ${siteUrl}
Description: ${siteDescription || "(none)"}
Total posts analyzed: ${sample.length}

## CATEGORIES (with post counts)
${topCategories || "(none)"}

## TAGS (with post counts)
${topTags || "(none)"}

## FOCUS KEYWORDS (SEO)
${uniqueFocusKws || "(none)"}

## RECENT POST TITLES (${sample.length} most recent)
${titles}

## YOUR TASK
Analyze the content and return a JSON object with this exact shape:

{
  "niches": ["niche 1", "niche 2", "niche 3"],
  "geography": "Australia" | "US" | "UK" | "India" | null,
  "audience": "short description of the target reader",
  "quoraSearchQueries": ["query 1", "query 2", ...],
  "primaryKeywords": ["keyword 1", "keyword 2", ...]
}

## RULES
1. "niches" — 3 to 7 distinct content themes. If the site only covers one niche, return 1. For multi-niche sites, list each one as a short phrase (e.g. "personal finance for beginners", "Australian ETF investing", "superannuation"). Be specific, not generic.
2. "geography" — ONLY set if you see clear signals (country-specific terms, currency, local brands). Otherwise null.
3. "audience" — one phrase describing the primary reader (e.g. "Australian DIY investors", "new homeowners", "hobby gardeners").
4. "quoraSearchQueries" — 10 to 15 search queries tailored to find HIGH-INTENT Quora questions relevant to this site. Mix question formats, problem statements, and comparison phrases. Make each query 3-7 words. DO NOT include "site:quora.com" — that's added separately. Examples: "how to start ETF investing Australia", "best budget planner for beginners", "superannuation vs property".
5. "primaryKeywords" — 8 to 15 seed keywords that represent the site's core topics — for use as SERP API seeds.

Return ONLY the JSON object, no preamble, no markdown.`;

  try {
    const client = new Anthropic({ apiKey });
    const message = await client.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 1500,
      messages: [{ role: "user", content: prompt }],
    });

    const text = message.content[0].type === "text" ? message.content[0].text : "";

    // Extract JSON (tolerate markdown fencing)
    let jsonStr = text.trim();
    const fenceMatch = jsonStr.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
    if (fenceMatch) jsonStr = fenceMatch[1];
    const objMatch = jsonStr.match(/\{[\s\S]*\}/);
    if (objMatch) jsonStr = objMatch[0];

    const parsed = JSON.parse(jsonStr);

    const profile: SiteNicheProfile = {
      siteUrl,
      niches: Array.isArray(parsed.niches) ? parsed.niches.slice(0, 7) : [],
      geography: typeof parsed.geography === "string" && parsed.geography.length > 0 ? parsed.geography : null,
      audience: typeof parsed.audience === "string" ? parsed.audience : "general readers",
      quoraSearchQueries: Array.isArray(parsed.quoraSearchQueries)
        ? parsed.quoraSearchQueries.slice(0, 15).filter((q: unknown): q is string => typeof q === "string" && q.length > 0)
        : [],
      primaryKeywords: Array.isArray(parsed.primaryKeywords)
        ? parsed.primaryKeywords.slice(0, 15).filter((k: unknown): k is string => typeof k === "string" && k.length > 0)
        : [],
      wpPostsAnalyzed: sample.length,
      analyzedAt: new Date().toISOString(),
    };

    if (profile.niches.length === 0 || profile.quoraSearchQueries.length === 0) {
      console.log(`[Niche] Claude returned empty niches/queries for ${siteUrl}`);
      return null;
    }

    console.log(
      `[Niche] ${siteUrl}: ${profile.niches.length} niches, ${profile.quoraSearchQueries.length} queries, geo=${profile.geography}`
    );
    console.log(`[Niche]   Niches: ${profile.niches.join(" | ")}`);

    setCache("niches", profile, siteUrl);
    return profile;
  } catch (err) {
    console.log(`[Niche] Failed to derive profile for ${siteUrl}:`, err instanceof Error ? err.message : err);
    return null;
  }
}
