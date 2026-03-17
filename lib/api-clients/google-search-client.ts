export interface SearchResult {
  url: string;
  title: string;
  snippet: string;
  domain: string;
}

/**
 * Search for "write for us" pages using Bing Web Search API.
 * Falls back to Google CSE if Bing key is not available.
 */
export async function searchWriteForUs(
  niche: string,
  domainFilters: string[],
  apiKey: string,
  searchEngine: "bing" | "google" = "bing",
  engineId?: string
): Promise<SearchResult[]> {
  if (searchEngine === "google" && engineId) {
    return searchWithGoogle(niche, domainFilters, apiKey, engineId);
  }
  return searchWithBing(niche, domainFilters, apiKey);
}

async function searchWithBing(
  niche: string,
  domainFilters: string[],
  apiKey: string
): Promise<SearchResult[]> {
  const nichePrefix = niche ? `${niche} ` : "";
  const queries = [
    `${nichePrefix}"write for us"`,
    `${nichePrefix}"guest post" guidelines`,
    `${nichePrefix}"submit a guest post"`,
    `${nichePrefix}"become a contributor"`,
  ];

  const results: SearchResult[] = [];
  const seenDomains = new Set<string>();

  for (const query of queries) {
    try {
      const params = new URLSearchParams({
        q: query,
        count: "20",
        responseFilter: "Webpages",
        mkt: "en-US",
      });

      const url = `https://api.bing.microsoft.com/v7.0/search?${params}`;
      console.log(`[BingSearch] Searching: ${query}`);

      const res = await fetch(url, {
        headers: {
          "Ocp-Apim-Subscription-Key": apiKey,
        },
      });

      if (!res.ok) {
        const errorBody = await res.text();
        console.log(`[BingSearch] Query failed: ${res.status} - ${errorBody.substring(0, 200)}`);
        continue;
      }

      const data = await res.json();
      const pages = data.webPages?.value || [];
      console.log(`[BingSearch] Got ${pages.length} results for: ${query}`);

      for (const page of pages) {
        const itemUrl = page.url;
        let domain: string;
        try {
          domain = new URL(itemUrl).hostname.replace("www.", "");
        } catch {
          continue;
        }

        // Check domain extension filter
        if (domainFilters.length > 0) {
          const matchesFilter = domainFilters.some((ext) => {
            const cleanExt = ext.trim().replace(/^\./, "");
            return domain.endsWith(cleanExt);
          });
          if (!matchesFilter) continue;
        }

        if (seenDomains.has(domain)) continue;
        seenDomains.add(domain);

        results.push({
          url: itemUrl,
          title: page.name || "",
          snippet: page.snippet || "",
          domain,
        });
      }
    } catch (err) {
      console.log(`[BingSearch] Error:`, err instanceof Error ? err.message : err);
    }
  }

  console.log(`[BingSearch] Total unique results: ${results.length}`);
  return results;
}

async function searchWithGoogle(
  niche: string,
  domainFilters: string[],
  apiKey: string,
  engineId: string
): Promise<SearchResult[]> {
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
        start: "1",
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

        if (domainFilters.length > 0) {
          const matchesFilter = domainFilters.some((ext) => {
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
