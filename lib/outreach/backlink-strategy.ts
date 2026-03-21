import { fetchGSCData, fetchGSCPageKeywords } from "@/lib/api-clients/gsc-client";
import { fetchWordPressData } from "@/lib/api-clients/wordpress-client";
import { getBacklinkLog } from "@/lib/outreach/storage";
import { getApiKey } from "@/lib/config";
import { getCache, setCache } from "@/lib/cache";
import type { BacklinkTarget } from "@/lib/outreach/types";
import type { PageKeywordMap } from "@/lib/types";

const DATAFORSEO_API = "https://api.dataforseo.com/v3";

/**
 * Phase 0: Build a prioritized backlink target list.
 *
 * Combines WordPress posts + GSC page-keyword data + DataForSEO backlink counts.
 *
 * Priority: position 4-15 (close to top 3 push) × high impressions × low existing backlinks
 */
export async function calculateBacklinkTargets(
  projectId: string,
  siteUrl: string
): Promise<BacklinkTarget[]> {
  const cacheKey = `backlink-targets-${projectId}`;
  const cached = getCache<BacklinkTarget[]>(cacheKey);
  if (cached) return cached;

  try {
    const [wpData, pageKeywords] = await Promise.all([
      fetchWordPressData(siteUrl).catch(() => null),
      fetchGSCPageKeywords(siteUrl).catch(() => [] as PageKeywordMap[]),
    ]);

    const wpPosts = wpData?.content?.filter(p => p.type === "post") || [];
    const backlinkLog = getBacklinkLog(projectId);
    const targets: BacklinkTarget[] = [];

    for (const page of pageKeywords) {
      const wpPost = wpPosts.find(p =>
        page.url.replace(/\/$/, "").toLowerCase() === p.url.replace(/\/$/, "").toLowerCase()
      );
      if (!wpPost) continue;

      const topKeyword = page.keywords[0];
      if (!topKeyword || topKeyword.impressions < 5) continue;

      // Position 4-15 = highest ROI
      const positionMultiplier = topKeyword.position >= 4 && topKeyword.position <= 15
        ? 2.0
        : topKeyword.position > 15 && topKeyword.position <= 30
          ? 1.2
          : topKeyword.position <= 3 ? 0.5 : 0.3;

      const trafficPotential = Math.round(page.totalImpressions * positionMultiplier);
      const existingCount = backlinkLog[page.url] || 0;
      const score = Math.round(trafficPotential * Math.pow(0.7, existingCount));

      const priority: "high" | "medium" | "low" =
        topKeyword.position >= 4 && topKeyword.position <= 15 ? "high" :
        topKeyword.position > 15 && topKeyword.position <= 30 ? "medium" : "low";

      targets.push({
        url: page.url,
        title: wpPost.title,
        impressions: page.totalImpressions,
        clicks: page.totalClicks,
        position: topKeyword.position,
        score,
        backlinkCount: existingCount,
        priority,
        trafficPotential,
        focusKeyword: wpPost.seo?.focusKeyword || topKeyword.query,
        wordCount: wpPost.wordCount,
      });
    }

    const result = targets.sort((a, b) => b.score - a.score).slice(0, 15);

    // Enrich top 5 with DataForSEO backlink counts
    await enrichWithDataForSEO(result);

    console.log(`[BacklinkStrategy] ${result.length} targets from ${wpPosts.length} WP posts, ${pageKeywords.length} GSC pages`);
    setCache(cacheKey, result);
    return result;
  } catch (error) {
    console.log("[BacklinkStrategy] Error:", error instanceof Error ? error.message : error);
    return [];
  }
}

async function enrichWithDataForSEO(targets: BacklinkTarget[]): Promise<void> {
  const login = getApiKey("dataForSeoLogin");
  const password = getApiKey("dataForSeoPassword");
  if (!login || !password || targets.length === 0) return;

  const auth = Buffer.from(`${login}:${password}`).toString("base64");

  for (const target of targets.slice(0, 5)) {
    try {
      const res = await fetch(`${DATAFORSEO_API}/backlinks/summary/live`, {
        method: "POST",
        headers: { Authorization: `Basic ${auth}`, "Content-Type": "application/json" },
        body: JSON.stringify([{ target: target.url }]),
      });
      if (!res.ok) continue;
      const data = await res.json();
      const result = data.tasks?.[0]?.result?.[0];
      if (result) target.backlinkCount = result.backlinks || target.backlinkCount;
    } catch { /* skip */ }
  }
}

/**
 * Match a prospect to the best backlink target post.
 */
export async function matchProspectToTarget(
  projectId: string,
  siteUrl: string,
  prospectNiche: string
): Promise<BacklinkTarget | null> {
  const targets = await calculateBacklinkTargets(projectId, siteUrl);
  if (targets.length === 0) return null;

  if (prospectNiche) {
    const nicheMatch = targets.find(t =>
      t.title.toLowerCase().includes(prospectNiche.toLowerCase()) ||
      (t.focusKeyword && t.focusKeyword.toLowerCase().includes(prospectNiche.toLowerCase()))
    );
    if (nicheMatch) return nicheMatch;
  }

  return targets[0];
}

/**
 * Choose anchor text strategy based on existing backlink profile.
 */
export function chooseAnchorStrategy(
  targetTitle: string,
  focusKeyword: string,
  existingBacklinks: number
): { anchorText: string; strategy: "partial-match" | "natural" | "branded" } {
  if (existingBacklinks < 3) {
    return {
      anchorText: focusKeyword || targetTitle.split(" ").slice(0, 4).join(" ").toLowerCase(),
      strategy: "partial-match",
    };
  }
  if (existingBacklinks < 8) {
    const phrases = [
      `this guide on ${(focusKeyword || targetTitle).toLowerCase()}`,
      `a detailed look at ${(focusKeyword || targetTitle).toLowerCase()}`,
      `comprehensive resource about ${(focusKeyword || targetTitle).toLowerCase()}`,
    ];
    return { anchorText: phrases[Math.floor(Math.random() * phrases.length)], strategy: "natural" };
  }
  return { anchorText: "Shoumya Chowdhury's blog", strategy: "branded" };
}
