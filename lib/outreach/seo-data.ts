/**
 * Shared SEO data layer for the outreach system.
 *
 * Reads from the cache that the daily cron already populates.
 * NEVER makes API calls — if cache is empty/expired, uses getCacheRaw() for stale data.
 * This ensures outreach never re-fetches GSC/Bing/WordPress data.
 */

import { getCache, getCacheRaw } from "@/lib/cache";
import type { KeywordData, PageKeywordMap } from "@/lib/types";
import type { WPSiteData } from "@/lib/api-clients/wordpress-client";
import type { BacklinkTarget } from "@/lib/outreach/types";

/**
 * Get GSC keyword data from cache (populated by daily cron).
 * Returns null only if data has never been fetched.
 */
export function getCachedGSCData(siteUrl: string): KeywordData | null {
  // Try fresh cache first
  const fresh = getCache<KeywordData>("gsc", siteUrl);
  if (fresh) return fresh;

  // Fall back to stale cache (better than nothing)
  const stale = getCacheRaw<KeywordData>("gsc", siteUrl);
  if (stale) {
    console.log("[SEO-Data] Using stale GSC data (last fetched by daily cron)");
    return stale.data;
  }

  return null;
}

/**
 * Get Bing keyword data from cache (populated by daily cron).
 */
export function getCachedBingData(siteUrl: string): KeywordData | null {
  const fresh = getCache<KeywordData>("bing", siteUrl);
  if (fresh) return fresh;

  const stale = getCacheRaw<KeywordData>("bing", siteUrl);
  if (stale) {
    console.log("[SEO-Data] Using stale Bing data (last fetched by daily cron)");
    return stale.data;
  }

  return null;
}

/**
 * Get GSC page-keyword mapping from cache (populated by daily cron).
 */
export function getCachedGSCPages(siteUrl: string): PageKeywordMap[] | null {
  const fresh = getCache<PageKeywordMap[]>("gsc-pages", siteUrl);
  if (fresh) return fresh;

  const stale = getCacheRaw<PageKeywordMap[]>("gsc-pages", siteUrl);
  if (stale) {
    console.log("[SEO-Data] Using stale GSC-pages data");
    return stale.data;
  }

  return null;
}

/**
 * Get WordPress data from cache.
 */
export function getCachedWordPressData(siteUrl: string): WPSiteData | null {
  const fresh = getCache<WPSiteData>("wordpress", siteUrl);
  if (fresh) return fresh;

  const stale = getCacheRaw<WPSiteData>("wordpress", siteUrl);
  if (stale) {
    console.log("[SEO-Data] Using stale WordPress data");
    return stale.data;
  }

  return null;
}

/**
 * Get backlink targets from cache (populated by backlink-strategy).
 */
export function getCachedBacklinkTargets(projectId: string): BacklinkTarget[] | null {
  return getCache<BacklinkTarget[]>(`backlink-targets-${projectId}`);
}

/**
 * Build a combined keyword profile from GSC + Bing data.
 * This gives us a picture of what keywords we rank for and where we need help.
 */
export function buildKeywordProfile(siteUrl: string): {
  weakKeywords: { query: string; impressions: number; position: number; source: string }[];
  strongKeywords: { query: string; impressions: number; position: number; source: string }[];
  topCategories: string[];
} {
  const gscData = getCachedGSCData(siteUrl);
  const bingData = getCachedBingData(siteUrl);

  const allKeywords: { query: string; impressions: number; position: number; source: string }[] = [];

  if (gscData) {
    for (const kw of gscData.keywords) {
      allKeywords.push({ query: kw.query, impressions: kw.impressions, position: kw.position, source: "gsc" });
    }
  }
  if (bingData) {
    for (const kw of bingData.keywords) {
      // Avoid duplicates if already in GSC
      if (!allKeywords.find(k => k.query.toLowerCase() === kw.query.toLowerCase())) {
        allKeywords.push({ query: kw.query, impressions: kw.impressions, position: kw.position, source: "bing" });
      }
    }
  }

  // Sort by impressions descending
  allKeywords.sort((a, b) => b.impressions - a.impressions);

  // Weak: position 4-30 with decent impressions (our best opportunity for backlinks)
  const weakKeywords = allKeywords
    .filter(k => k.position >= 4 && k.position <= 30 && k.impressions >= 10)
    .slice(0, 50);

  // Strong: position 1-3 (our authority areas)
  const strongKeywords = allKeywords
    .filter(k => k.position <= 3 && k.impressions >= 20)
    .slice(0, 30);

  // Extract top category themes from keywords
  const wordFreq = new Map<string, number>();
  for (const kw of allKeywords.slice(0, 200)) {
    const words = kw.query.toLowerCase().split(/\s+/).filter(w => w.length > 3);
    for (const word of words) {
      // Skip common filler words
      if (["what", "does", "that", "this", "with", "from", "have", "been", "will", "your", "about", "more", "most", "best", "like", "just", "than", "them", "they", "when", "which", "would", "could", "should"].includes(word)) continue;
      wordFreq.set(word, (wordFreq.get(word) || 0) + kw.impressions);
    }
  }

  const topCategories = Array.from(wordFreq.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 20)
    .map(([word]) => word);

  return { weakKeywords, strongKeywords, topCategories };
}

/**
 * Get pages that need backlinks the most based on cached SEO data.
 * Returns pages with position 4-15 (close to page 1) and high impressions.
 */
export function getPagesNeedingBacklinks(siteUrl: string): {
  url: string;
  title: string;
  focusKeyword: string;
  position: number;
  impressions: number;
}[] {
  const pages = getCachedGSCPages(siteUrl);
  const wpData = getCachedWordPressData(siteUrl);

  if (!pages || pages.length === 0) return [];

  const wpPosts = wpData?.content?.filter(p => p.type === "post") || [];
  const results: { url: string; title: string; focusKeyword: string; position: number; impressions: number }[] = [];

  for (const page of pages) {
    const wpPost = wpPosts.find(p =>
      page.url.replace(/\/$/, "").toLowerCase() === p.url.replace(/\/$/, "").toLowerCase()
    );
    if (!wpPost) continue;

    const topKw = page.keywords[0];
    if (!topKw || topKw.impressions < 5) continue;

    // Focus on position 4-30 — these benefit most from backlinks
    if (topKw.position >= 4 && topKw.position <= 30) {
      results.push({
        url: page.url,
        title: wpPost.title,
        focusKeyword: wpPost.seo?.focusKeyword || topKw.query,
        position: topKw.position,
        impressions: page.totalImpressions,
      });
    }
  }

  return results.sort((a, b) => {
    // Prioritize position 4-15 over 16-30
    const posScoreA = a.position <= 15 ? 2 : 1;
    const posScoreB = b.position <= 15 ? 2 : 1;
    if (posScoreA !== posScoreB) return posScoreB - posScoreA;
    return b.impressions - a.impressions;
  }).slice(0, 20);
}
