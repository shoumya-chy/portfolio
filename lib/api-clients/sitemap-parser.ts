export interface SitemapUrl {
  loc: string;
  lastmod?: string;
}

export async function fetchSitemap(sitemapUrl: string): Promise<SitemapUrl[]> {
  if (!sitemapUrl) return [];

  const res = await fetch(sitemapUrl, {
    headers: { "User-Agent": "ShoumyaPortfolio/1.0" },
  });

  if (!res.ok) throw new Error(`Sitemap fetch failed: ${res.status}`);
  const xml = await res.text();

  const urls: SitemapUrl[] = [];

  // Check if this is a sitemap index (contains other sitemaps)
  const sitemapIndexMatches = xml.matchAll(/<sitemap>\s*<loc>([^<]+)<\/loc>/g);
  const childSitemaps: string[] = [];
  for (const m of sitemapIndexMatches) {
    childSitemaps.push(m[1].trim());
  }

  if (childSitemaps.length > 0) {
    // Fetch first 3 child sitemaps to avoid too many requests
    for (const childUrl of childSitemaps.slice(0, 3)) {
      try {
        const childRes = await fetch(childUrl, {
          headers: { "User-Agent": "ShoumyaPortfolio/1.0" },
        });
        if (!childRes.ok) continue;
        const childXml = await childRes.text();
        urls.push(...parseUrlsFromXml(childXml));
      } catch {
        // Skip failed child sitemaps
      }
    }
  } else {
    urls.push(...parseUrlsFromXml(xml));
  }

  return urls;
}

function parseUrlsFromXml(xml: string): SitemapUrl[] {
  const urls: SitemapUrl[] = [];
  const urlMatches = xml.matchAll(/<url>\s*<loc>([^<]+)<\/loc>(?:\s*<lastmod>([^<]+)<\/lastmod>)?/g);

  for (const match of urlMatches) {
    urls.push({
      loc: match[1].trim(),
      lastmod: match[2]?.trim(),
    });
  }

  return urls;
}
