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
    `${nichePrefix}"contribute" "guest"`,
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

      const url = `https://www.googleapis.com/customsearch/v1?${params}`;
      console.log(`[GoogleCSE] Searching: ${query}`);

      const res = await fetch(url);

      if (!res.ok) {
        const errorBody = await res.text();
        console.log(`[GoogleCSE] Query failed: ${res.status} - ${errorBody.substring(0, 200)}`);
        continue;
      }

      const data = await res.json();
      const items = data.items || [];
      console.log(`[GoogleCSE] Got ${items.length} results for: ${query}`);

      for (const item of items) {
        const itemUrl = item.link;
        let domain: string;
        try {
          domain = new URL(itemUrl).hostname.replace("www.", "");
        } catch {
          continue;
        }

        // Check domain extension filter
        if (domainFilters.length > 0) {
          const matchesFilter = domainFilters.some(ext => {
            const cleanExt = ext.trim().replace(/^\./, "");
            return domain.endsWith(cleanExt);
          });
          if (!matchesFilter) continue;
        }

        if (seenDomains.has(domain)) continue;
        seenDomains.add(domain);

        results.push({
          url: itemUrl,
          title: item.title || "",
          snippet: item.snippet || "",
          domain,
        });
      }
    } catch (err) {
      console.log(`[GoogleCSE] Error:`, err instanceof Error ? err.message : err);
    }
  }

  console.log(`[GoogleCSE] Total unique results: ${results.length}`);
  return results;
}
