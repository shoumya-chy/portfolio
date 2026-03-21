import { getApiKey } from "@/lib/config";
import { getCache, setCache } from "@/lib/cache";
import type { PAAQuestion, RelatedSearch } from "@/lib/types";

const DATAFORSEO_API = "https://api.dataforseo.com/v3";

interface DataForSEOTask {
  id: string;
  keyword: string;
}

/**
 * Fetch People Also Ask questions and Related Searches from DataForSEO.
 * Uses Standard Queue (POST task → GET results) for cost efficiency.
 * Caches results for 7 days per seed keyword.
 */
export async function fetchPAAAndRelated(
  seedKeywords: string[],
  locationCode: number = 2036 // Australia
): Promise<{ paaQuestions: PAAQuestion[]; relatedSearches: RelatedSearch[] }> {
  const login = getApiKey("dataForSeoLogin");
  const password = getApiKey("dataForSeoPassword");

  if (!login || !password) {
    console.log("[DataForSEO] Credentials not configured, skipping");
    return { paaQuestions: [], relatedSearches: [] };
  }

  const auth = Buffer.from(`${login}:${password}`).toString("base64");
  const headers = {
    Authorization: `Basic ${auth}`,
    "Content-Type": "application/json",
  };

  const allPAA: PAAQuestion[] = [];
  const allRelated: RelatedSearch[] = [];

  // Process top 30 seed keywords (cost control)
  const keywords = seedKeywords.slice(0, 30);

  for (const keyword of keywords) {
    // Check cache first (7 day TTL)
    const cacheKey = `paa-${keyword.replace(/\s+/g, "-").toLowerCase()}`;
    const cached = getCache<{ paa: PAAQuestion[]; related: RelatedSearch[] }>(cacheKey);
    if (cached) {
      allPAA.push(...cached.paa);
      allRelated.push(...cached.related);
      continue;
    }

    try {
      // Post task to Standard Queue
      const postRes = await fetch(`${DATAFORSEO_API}/serp/google/organic/task_post`, {
        method: "POST",
        headers,
        body: JSON.stringify([{
          keyword,
          location_code: locationCode,
          language_code: "en",
          device: "desktop",
          depth: 10,
          people_also_ask_click_depth: 3,
        }]),
      });

      if (!postRes.ok) {
        console.log(`[DataForSEO] Task post failed for "${keyword}": ${postRes.status}`);
        continue;
      }

      const postData = await postRes.json();
      const taskId = postData.tasks?.[0]?.id;
      if (!taskId) continue;

      // Wait for task to complete (poll every 5 seconds, max 30 seconds)
      let resultData = null;
      for (let attempt = 0; attempt < 6; attempt++) {
        await new Promise(r => setTimeout(r, 5000));

        const getRes = await fetch(`${DATAFORSEO_API}/serp/google/organic/task_get/advanced/${taskId}`, {
          headers,
        });

        if (!getRes.ok) continue;
        const getData = await getRes.json();

        if (getData.tasks?.[0]?.status_code === 20000) {
          resultData = getData.tasks[0].result?.[0];
          break;
        }
      }

      if (!resultData) {
        console.log(`[DataForSEO] Task timed out for "${keyword}"`);
        continue;
      }

      // Extract PAA questions
      const paa: PAAQuestion[] = [];
      const items = resultData.items || [];
      for (const item of items) {
        if (item.type === "people_also_ask") {
          const questions = item.items || [];
          for (const q of questions) {
            if (q.title) {
              paa.push({
                question: q.title,
                seedKeyword: keyword,
                fetchedAt: new Date().toISOString(),
              });
            }
            // Nested PAA (click depth)
            if (q.items) {
              for (const nested of q.items) {
                if (nested.title) {
                  paa.push({
                    question: nested.title,
                    seedKeyword: keyword,
                    fetchedAt: new Date().toISOString(),
                  });
                }
              }
            }
          }
        }
      }

      // Extract Related Searches
      const related: RelatedSearch[] = [];
      for (const item of items) {
        if (item.type === "related_searches") {
          const searches = item.items || [];
          for (const s of searches) {
            if (s.title) {
              related.push({
                query: s.title,
                seedKeyword: keyword,
                fetchedAt: new Date().toISOString(),
              });
            }
          }
        }
      }

      console.log(`[DataForSEO] "${keyword}": ${paa.length} PAA, ${related.length} related`);

      // Cache for 7 days
      setCache(cacheKey, { paa, related });

      allPAA.push(...paa);
      allRelated.push(...related);
    } catch (err) {
      console.log(`[DataForSEO] Error for "${keyword}":`, err instanceof Error ? err.message : err);
    }
  }

  console.log(`[DataForSEO] Total: ${allPAA.length} PAA questions, ${allRelated.length} related searches`);
  return { paaQuestions: allPAA, relatedSearches: allRelated };
}
