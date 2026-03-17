export interface SearchResult {
  url: string;
  title: string;
  snippet: string;
  domain: string;
}

/**
 * Search for "write for us" pages.
 * Uses direct web scraping (no API key needed), with Google CSE as fallback.
 */
export async function searchWriteForUs(
  niche: string,
  domainFilters: string[],
  options?: { googleApiKey?: string; googleEngineId?: string }
): Promise<SearchResult[]> {
  // Try Google CSE first if configured
  if (options?.googleApiKey && options?.googleEngineId) {
    console.log("[Search] Trying Google CSE...");
    const googleResults = await searchWithGoogle(
      niche,
      domainFilters,
      options.googleApiKey,
      options.googleEngineId
    );
    if (googleResults.length > 0) return googleResults;
    console.log("[Search] Google CSE returned 0 results, falling back to DuckDuckGo scraping...");
  }

  // Fallback: scrape DuckDuckGo HTML (no API key needed)
  return searchWithScraping(niche, domainFilters);
}

/**
 * Scrape DuckDuckGo HTML search results — no API key needed.
 */
async function searchWithScraping(
  niche: string,
  domainFilters: string[]
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
  const errors: string[] = [];

  for (const query of queries) {
    try {
      console.log(`[Search] DuckDuckGo scraping: ${query}`);

      // DuckDuckGo HTML endpoint (no JS needed)
      const params = new URLSearchParams({ q: query });
      const url = `https://html.duckduckgo.com/html/?${params}`;

      const res = await fetch(url, {
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
          Accept: "text/html,application/xhtml+xml",
          "Accept-Language": "en-US,en;q=0.9",
        },
      });

      if (!res.ok) {
        const msg = `DuckDuckGo returned ${res.status}`;
        console.log(`[Search] ${msg}`);
        errors.push(msg);
        continue;
      }

      const html = await res.text();

      // Parse DuckDuckGo HTML results
      // Results are in <a class="result__a" href="...">title</a>
      // and snippets in <a class="result__snippet" ...>snippet</a>
      const linkRegex = /<a[^>]+class="result__a"[^>]+href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi;
      const snippetRegex = /<a[^>]+class="result__snippet"[^>]*>([\s\S]*?)<\/a>/gi;

      const links: { url: string; title: string }[] = [];
      let match;

      while ((match = linkRegex.exec(html)) !== null) {
        let href = match[1];
        const title = match[2].replace(/<[^>]+>/g, "").trim();

        // DuckDuckGo wraps URLs in a redirect, extract real URL
        if (href.includes("uddg=")) {
          try {
            const uddg = new URL(href, "https://duckduckgo.com").searchParams.get("uddg");
            if (uddg) href = uddg;
          } catch {
            // use as-is
          }
        }

        if (href.startsWith("http")) {
          links.push({ url: decodeURIComponent(href), title });
        }
      }

      // Extract snippets
      const snippets: string[] = [];
      while ((match = snippetRegex.exec(html)) !== null) {
        snippets.push(match[1].replace(/<[^>]+>/g, "").trim());
      }

      console.log(`[Search] Got ${links.length} results for: ${query}`);

      for (let i = 0; i < links.length; i++) {
        const link = links[i];
        let domain: string;
        try {
          domain = new URL(link.url).hostname.replace("www.", "");
        } catch {
          continue;
        }

        // Skip search engines, social media, and non-useful domains
        const skipDomains = [
          "duckduckgo.com", "google.com", "bing.com", "yahoo.com",
          "facebook.com", "twitter.com", "x.com", "linkedin.com",
          "youtube.com", "reddit.com", "quora.com", "pinterest.com",
          "wikipedia.org", "amazon.com",
        ];
        if (skipDomains.some((sd) => domain.includes(sd))) continue;

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
          url: link.url,
          title: link.title,
          snippet: snippets[i] || "",
          domain,
        });
      }

      // Small delay between queries to be polite
      await new Promise((resolve) => setTimeout(resolve, 1500));
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.log(`[Search] Error:`, msg);
      errors.push(msg);
    }
  }

  if (results.length === 0 && errors.length > 0) {
    console.log(`[Search] All queries failed. Errors: ${errors.join("; ")}`);
  }

  console.log(`[Search] Total unique results: ${results.length}`);
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
