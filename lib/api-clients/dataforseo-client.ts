import { getApiKey } from "@/lib/config";
import { getCache, setCache } from "@/lib/cache";
import type { PAAQuestion, RelatedSearch } from "@/lib/types";

const DATAFORSEO_API = "https://api.dataforseo.com/v3";

/**
 * Fetch People Also Ask questions and Related Searches from DataForSEO.
 * Uses batch posting (all keywords in one request) + single results fetch.
 * Caches results per keyword for 7 days.
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

  // Limit to top 15 keywords (cost + speed control)
  const keywords = seedKeywords.slice(0, 15);

  // Separate cached vs uncached
  const uncachedKeywords: string[] = [];
  for (const keyword of keywords) {
    const cacheKey = `paa-${keyword.replace(/\s+/g, "-").toLowerCase()}`;
    const cached = getCache<{ paa: PAAQuestion[]; related: RelatedSearch[] }>(cacheKey);
    if (cached) {
      allPAA.push(...cached.paa);
      allRelated.push(...cached.related);
    } else {
      uncachedKeywords.push(keyword);
    }
  }

  if (uncachedKeywords.length === 0) {
    console.log(`[DataForSEO] All ${keywords.length} keywords cached`);
    return { paaQuestions: allPAA, relatedSearches: allRelated };
  }

  console.log(`[DataForSEO] ${keywords.length - uncachedKeywords.length} cached, ${uncachedKeywords.length} to fetch`);

  try {
    // Batch post ALL uncached keywords in one API call
    const tasks = uncachedKeywords.map(keyword => ({
      keyword,
      location_code: locationCode,
      language_code: "en",
      device: "desktop",
      depth: 10,
      people_also_ask_click_depth: 2,
      tag: keyword, // Use tag to identify which keyword each result belongs to
    }));

    const postRes = await fetch(`${DATAFORSEO_API}/serp/google/organic/task_post`, {
      method: "POST",
      headers,
      body: JSON.stringify(tasks),
    });

    if (!postRes.ok) {
      const err = await postRes.text();
      console.log(`[DataForSEO] Batch post failed: ${postRes.status} - ${err.substring(0, 200)}`);
      return { paaQuestions: allPAA, relatedSearches: allRelated };
    }

    const postData = await postRes.json();
    const taskIds: { id: string; keyword: string }[] = [];
    for (const task of postData.tasks || []) {
      if (task.id) {
        taskIds.push({ id: task.id, keyword: task.data?.keyword || task.data?.tag || "" });
      }
    }

    console.log(`[DataForSEO] Posted ${taskIds.length} tasks, waiting for results...`);

    // Wait for tasks to complete (poll every 10 seconds, max 60 seconds)
    await new Promise(r => setTimeout(r, 15000)); // Initial wait

    for (let attempt = 0; attempt < 5; attempt++) {
      // Fetch all completed tasks at once
      const getRes = await fetch(`${DATAFORSEO_API}/serp/google/organic/tasks_ready`, { headers });
      if (!getRes.ok) {
        await new Promise(r => setTimeout(r, 10000));
        continue;
      }

      const readyData = await getRes.json();
      const readyIds = new Set((readyData.tasks?.[0]?.result || []).map((r: { id: string }) => r.id));

      const pendingTasks = taskIds.filter(t => !readyIds.has(t.id));
      if (pendingTasks.length > 0 && attempt < 4) {
        console.log(`[DataForSEO] ${taskIds.length - pendingTasks.length}/${taskIds.length} ready, waiting...`);
        await new Promise(r => setTimeout(r, 10000));
        continue;
      }

      // Fetch results for ready tasks
      for (const task of taskIds) {
        if (!readyIds.has(task.id)) continue;

        try {
          const resultRes = await fetch(
            `${DATAFORSEO_API}/serp/google/organic/task_get/advanced/${task.id}`,
            { headers }
          );
          if (!resultRes.ok) continue;

          const resultData = await resultRes.json();
          const items = resultData.tasks?.[0]?.result?.[0]?.items || [];

          const paa: PAAQuestion[] = [];
          const related: RelatedSearch[] = [];

          for (const item of items) {
            if (item.type === "people_also_ask") {
              for (const q of item.items || []) {
                if (q.title) {
                  paa.push({ question: q.title, seedKeyword: task.keyword, fetchedAt: new Date().toISOString() });
                }
                for (const nested of q.items || []) {
                  if (nested.title) {
                    paa.push({ question: nested.title, seedKeyword: task.keyword, fetchedAt: new Date().toISOString() });
                  }
                }
              }
            }
            if (item.type === "related_searches") {
              for (const s of item.items || []) {
                if (s.title) {
                  related.push({ query: s.title, seedKeyword: task.keyword, fetchedAt: new Date().toISOString() });
                }
              }
            }
          }

          // Cache per keyword
          const cacheKey = `paa-${task.keyword.replace(/\s+/g, "-").toLowerCase()}`;
          setCache(cacheKey, { paa, related });

          allPAA.push(...paa);
          allRelated.push(...related);
        } catch (err) {
          console.log(`[DataForSEO] Result fetch error for "${task.keyword}":`, err instanceof Error ? err.message : err);
        }
      }

      break; // Done fetching
    }
  } catch (err) {
    console.log(`[DataForSEO] Error:`, err instanceof Error ? err.message : err);
  }

  console.log(`[DataForSEO] Total: ${allPAA.length} PAA, ${allRelated.length} related`);
  return { paaQuestions: allPAA, relatedSearches: allRelated };
}
