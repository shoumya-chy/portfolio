import { fetchGSCData } from "@/lib/api-clients/gsc-client";
import { getBacklinkLog } from "@/lib/outreach/storage";
import type { BacklinkTarget } from "@/lib/outreach/types";
import { getCache, setCache } from "@/lib/cache";

/**
 * Calculates which internal pages should receive backlinks in guest posts.
 *
 * Strategy:
 * 1. Fetch GSC keyword data for the site
 * 2. Score each keyword: impressions * (1 - position/40)
 * 3. Reduce score by 30% per existing backlink
 * 4. Return top 10 targets sorted by score
 */
export async function calculateBacklinkTargets(
  projectId: string,
  siteUrl: string
): Promise<BacklinkTarget[]> {
  const cacheKey = `backlink-targets-${projectId}`;

  // Check cache (uses the built-in TTL system)
  const cached = getCache<BacklinkTarget[]>(cacheKey);
  if (cached) return cached;

  try {
    const gscData = await fetchGSCData(siteUrl);
    const backlinkLog = getBacklinkLog(projectId);

    const targets: BacklinkTarget[] = [];
    const baseUrl = siteUrl.endsWith("/") ? siteUrl : `${siteUrl}/`;

    for (const kw of gscData.keywords) {
      if (kw.impressions <= 50) continue;

      // Score: high impressions + poor ranking = high backlink priority
      const baseScore = kw.impressions * (1 - Math.min(kw.position / 40, 1));

      // Check how many backlinks this URL already received
      const existingCount = backlinkLog[baseUrl] || 0;
      const reductionFactor = Math.pow(0.7, existingCount);
      const finalScore = Math.round(baseScore * reductionFactor * 100) / 100;

      const priority: "high" | "medium" | "low" =
        finalScore > 500 ? "high" : finalScore > 200 ? "medium" : "low";

      targets.push({
        url: baseUrl,
        title: capitalizeQuery(kw.query),
        impressions: kw.impressions,
        clicks: kw.clicks,
        position: kw.position,
        score: finalScore,
        backlinkCount: existingCount,
        priority,
      });
    }

    // Sort by score, deduplicate by title (keep highest), take top 10
    const seen = new Set<string>();
    const result = targets
      .sort((a, b) => b.score - a.score)
      .filter((t) => {
        const key = t.title.toLowerCase();
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      })
      .slice(0, 10);

    // Cache for 24h (cache type determines TTL)
    setCache(cacheKey, result);

    return result;
  } catch (error) {
    console.log("[BacklinkStrategy] Error:", error instanceof Error ? error.message : error);
    return [];
  }
}

function capitalizeQuery(query: string): string {
  return query
    .split(" ")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(" ");
}
