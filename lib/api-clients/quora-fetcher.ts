import Anthropic from "@anthropic-ai/sdk";
import { getApiKey } from "@/lib/config";
import { getCache, setCache } from "@/lib/cache";
import type { TrendingTopic, SiteNicheProfile } from "@/lib/types";

const DATAFORSEO_API = "https://api.dataforseo.com/v3";

// Map friendly geography names to DataForSEO location codes
// https://docs.dataforseo.com/v3/serp/google/locations/
const LOCATION_CODES: Record<string, number> = {
  Australia: 2036,
  "United States": 2840,
  US: 2840,
  "United Kingdom": 2826,
  UK: 2826,
  Canada: 2124,
  India: 2356,
  "New Zealand": 2554,
  Singapore: 2702,
};

function locationCodeFor(geography: string | null): number {
  if (!geography) return 2840; // Default to US (largest Quora audience)
  return LOCATION_CODES[geography] ?? 2840;
}

/**
 * Fetch Quora questions relevant to a site's niche profile.
 *
 * Strategy:
 *   1. For each of the site's pre-computed search queries, run a Google SERP
 *      search for `site:quora.com <query>` via DataForSEO Live endpoint.
 *      Google properly respects the `site:` operator (DuckDuckGo doesn't).
 *   2. Collect all Quora URLs from organic results.
 *   3. Deduplicate.
 *   4. Let Claude Haiku re-rank for relevance to the site's niches.
 *
 * Results are cached for 3 days per siteUrl.
 */
export async function fetchQuoraForProfile(
  profile: SiteNicheProfile
): Promise<TrendingTopic[]> {
  // Cache check
  const cached = getCache<TrendingTopic[]>("quora-niche", profile.siteUrl);
  if (cached && cached.length > 0) {
    console.log(`[Quora] Using cached results for ${profile.siteUrl} (${cached.length} topics)`);
    return cached;
  }

  const login = getApiKey("dataForSeoLogin");
  const password = getApiKey("dataForSeoPassword");

  if (!login || !password) {
    console.log(`[Quora] DataForSEO credentials missing, cannot fetch Quora`);
    return [];
  }

  if (profile.quoraSearchQueries.length === 0) {
    console.log(`[Quora] No search queries in profile for ${profile.siteUrl}`);
    return [];
  }

  const auth = Buffer.from(`${login}:${password}`).toString("base64");
  const headers = {
    Authorization: `Basic ${auth}`,
    "Content-Type": "application/json",
  };

  // Cap to top 10 queries to control DataForSEO cost (~$0.002 per live SERP call)
  const queries = profile.quoraSearchQueries.slice(0, 10);
  const locationCode = locationCodeFor(profile.geography);

  console.log(
    `[Quora] Fetching ${queries.length} SERP queries via DataForSEO for ${profile.siteUrl} (location ${locationCode})`
  );

  // Build batch payload — DataForSEO allows up to 100 tasks per batch in live mode
  const tasks = queries.map((q) => ({
    keyword: `site:quora.com ${q}`,
    location_code: locationCode,
    language_code: "en",
    device: "desktop",
    depth: 20, // Top 20 results per query
    tag: q, // Identify which query each result came from
  }));

  const rawTopics: TrendingTopic[] = [];

  try {
    const res = await fetch(
      `${DATAFORSEO_API}/serp/google/organic/live/advanced`,
      {
        method: "POST",
        headers,
        body: JSON.stringify(tasks),
      }
    );

    if (!res.ok) {
      const err = await res.text();
      console.log(`[Quora] DataForSEO live call failed: ${res.status} - ${err.substring(0, 200)}`);
      return [];
    }

    const data = await res.json();

    for (const task of data.tasks || []) {
      if (task.status_code !== 20000) continue;
      const seedQuery = task.data?.tag || task.data?.keyword || "";

      // Each task has one result in "result" array
      const items = task.result?.[0]?.items || [];

      for (const item of items) {
        if (item.type !== "organic") continue;
        if (!item.url || !item.title) continue;

        const url = String(item.url);
        const title = String(item.title);

        // Only keep quora.com URLs
        if (!url.includes("quora.com")) continue;

        // Skip profile/topic pages — we want questions
        if (/\/profile\//i.test(url) || /\/topic\//i.test(url)) continue;

        // Clean up title — strip " - Quora" suffix and common cruft
        const cleanTitle = title
          .replace(/\s*[-–|]\s*Quora\s*$/i, "")
          .replace(/^\d+\s+[Aa]nswers?\s*[-–|]\s*/, "")
          .trim();

        if (cleanTitle.length < 10) continue;

        rawTopics.push({
          title: cleanTitle,
          url,
          score: 0,
          source: "quora",
          fetchedAt: new Date().toISOString(),
          matchedNiche: seedQuery,
        });
      }
    }

    console.log(`[Quora] Raw SERP yielded ${rawTopics.length} Quora questions`);
  } catch (err) {
    console.log(`[Quora] DataForSEO fetch error:`, err instanceof Error ? err.message : err);
    return [];
  }

  // Deduplicate by URL and title
  const seenUrls = new Set<string>();
  const seenTitles = new Set<string>();
  const deduped: TrendingTopic[] = [];
  for (const t of rawTopics) {
    const titleKey = t.title.toLowerCase().slice(0, 60);
    if (seenUrls.has(t.url) || seenTitles.has(titleKey)) continue;
    seenUrls.add(t.url);
    seenTitles.add(titleKey);
    deduped.push(t);
  }

  console.log(`[Quora] After dedup: ${deduped.length} unique questions`);

  // Claude relevance re-ranking — keeps the top ~30 most relevant to the site niches
  const relevant = await filterQuoraByRelevance(deduped, profile);

  console.log(`[Quora] After Claude relevance filter: ${relevant.length} kept`);

  // Cache for 3 days
  setCache("quora-niche", relevant, profile.siteUrl);

  return relevant;
}

/**
 * Send the raw Quora questions to Claude Haiku with the site's niche profile
 * and ask it to return only the questions that are directly relevant.
 * Much cheaper and more reliable than keyword filtering.
 */
async function filterQuoraByRelevance(
  topics: TrendingTopic[],
  profile: SiteNicheProfile
): Promise<TrendingTopic[]> {
  if (topics.length === 0) return [];

  const apiKey = getApiKey("anthropic");
  if (!apiKey) {
    console.log(`[Quora] No Anthropic key, skipping relevance filter`);
    return topics.slice(0, 30);
  }

  // Cap input to 120 topics to stay well under Haiku's context/cost budget
  const input = topics.slice(0, 120);
  const topicList = input
    .map((t, i) => `${i + 1}. ${t.title}`)
    .join("\n");

  const prompt = `You are filtering Quora questions for relevance to a specific website.

## SITE NICHES
${profile.niches.map((n) => `- ${n}`).join("\n")}

## TARGET AUDIENCE
${profile.audience}

${profile.geography ? `## GEOGRAPHY\n${profile.geography}\n` : ""}

## QUESTIONS (${input.length} raw results from Quora)
${topicList}

## TASK
Return ONLY the questions that are directly relevant to the site's niches and audience. A question is relevant if someone reading this site would care about the answer.

EXCLUDE:
- Questions that are only tangentially related
- Questions about unrelated niches
- Spammy or low-quality questions
- Personal questions that can't be answered as blog content
- Questions already obviously saturated with top-3 Google results

KEEP:
- Questions that represent a content gap
- Questions with clear informational intent
- Questions the site could turn into a blog post

Return ONLY a JSON array of objects. No preamble, no markdown fences:
[
  { "index": 5, "relevance": 85, "niche": "personal finance for beginners" },
  { "index": 12, "relevance": 72, "niche": "superannuation" }
]

- "index" is the 1-based number from the list above.
- "relevance" is 0-100.
- "niche" is the matching niche from the site niches list above (exact phrase).
- Return at most 40 items.
- Sort by relevance descending.
- Only include items with relevance >= 55.`;

  try {
    const client = new Anthropic({ apiKey });
    const message = await client.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 2500,
      messages: [{ role: "user", content: prompt }],
    });

    const text = message.content[0].type === "text" ? message.content[0].text : "";
    let jsonStr = text.trim();
    const fenceMatch = jsonStr.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
    if (fenceMatch) jsonStr = fenceMatch[1];
    const arrMatch = jsonStr.match(/\[[\s\S]*\]/);
    if (arrMatch) jsonStr = arrMatch[0];

    const picks = JSON.parse(jsonStr) as Array<{
      index: number;
      relevance: number;
      niche: string;
    }>;

    if (!Array.isArray(picks)) return topics.slice(0, 30);

    const kept: TrendingTopic[] = [];
    for (const pick of picks) {
      const idx = pick.index - 1;
      if (idx < 0 || idx >= input.length) continue;
      const topic = input[idx];
      kept.push({
        ...topic,
        score: pick.relevance,
        relevanceScore: pick.relevance,
        matchedNiche: pick.niche || topic.matchedNiche,
      });
    }

    return kept;
  } catch (err) {
    console.log(`[Quora] Relevance filter failed, returning raw top 30:`, err instanceof Error ? err.message : err);
    return topics.slice(0, 30);
  }
}
