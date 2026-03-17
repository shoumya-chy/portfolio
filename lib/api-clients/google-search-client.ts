export interface SearchResult {
  url: string;
  title: string;
  snippet: string;
  domain: string;
}

export async function searchWriteForUs(
  niche: string,
  domainFilters: string[],
  apiKey: string,
  engineId: string,
  startIndex: number = 1
): Promise<SearchResult[]> {
  // If niche is empty, the site is multi-niche — search broadly
  const nichePrefix = niche ? `"${niche}" ` : "";
  const queries = [
    `${nichePrefix}"write for us"`,
    `${nichePrefix}"guest post"`,
    `${nichePrefix}"contribute"`,
    `${nichePrefix}"submit a guest post"`,
  ];

  const results: SearchResult[] = [];
  const seenDomains = new Set<string>();

  for (const query of queries) {
    try {
      const params = new URLSearchParams({
        key: apiKey,
        cx: engineId,
        q: query,
        start: String(startIndex),
        num: "10",
      });

      const res = await fetch(`https://www.googleapis.com/customsearch/v1?${params}`);
      if (!res.ok) {
        console.log(`[GoogleCSE] Query failed: ${res.status}`);
        continue;
      }

      const data = await res.json();
      const items = data.items || [];

      for (const item of items) {
        const url = item.link;
        const domain = new URL(url).hostname.replace("www.", "");

        // Check domain extension filter
        if (domainFilters.length > 0) {
          const matchesFilter = domainFilters.some(ext => domain.endsWith(ext.replace(".", "")));
          if (!matchesFilter) continue;
        }

        if (seenDomains.has(domain)) continue;
        seenDomains.add(domain);

        results.push({
          url,
          title: item.title || "",
          snippet: item.snippet || "",
          domain,
        });
      }
    } catch (err) {
      console.log(`[GoogleCSE] Error:`, err instanceof Error ? err.message : err);
    }
  }

  return results;
}
