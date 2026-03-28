/**
 * Sitemap & RSS fetcher.
 * Auto-discovers posts from a site's sitemap.xml or RSS feed.
 *
 * Key design decisions:
 * - Don't reject on HTTP status codes — some servers (e.g. WordPress with
 *   certain SEO plugins) return 404 status but still serve valid XML.
 * - Use regex-based extraction as fallback when Cheerio xmlMode
 *   struggles with namespaced XML.
 */

import * as cheerio from "cheerio";
import type { BookmarkPost } from "./types";

const BROWSER_HEADERS: Record<string, string> = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
  Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
  "Accept-Language": "en-US,en;q=0.9",
};

function generateId(): string {
  return `post_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

/**
 * Fetch a URL and return the body text regardless of HTTP status,
 * as long as the body looks like XML.
 */
async function fetchXml(url: string, timeoutMs = 15000): Promise<string | null> {
  try {
    const res = await fetch(url, {
      headers: BROWSER_HEADERS,
      signal: AbortSignal.timeout(timeoutMs),
    });
    const text = await res.text();
    // Accept if it looks like XML, regardless of status code
    if (text.includes("<?xml") || text.includes("<urlset") || text.includes("<sitemapindex") ||
        text.includes("<rss") || text.includes("<feed") || text.includes("<channel")) {
      return text;
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Extract <loc> values from sitemap XML using regex.
 * Works reliably regardless of XML namespaces.
 */
function extractLocs(xml: string): string[] {
  const locs: string[] = [];
  const regex = /<loc>\s*(.*?)\s*<\/loc>/gi;
  let match;
  while ((match = regex.exec(xml)) !== null) {
    const url = match[1].trim();
    if (url) locs.push(url);
  }
  return locs;
}

/**
 * Extract <url> blocks with <loc> and optional <lastmod>.
 */
function extractUrlEntries(xml: string): Array<{ loc: string; lastmod?: string }> {
  const entries: Array<{ loc: string; lastmod?: string }> = [];
  const urlBlockRegex = /<url>([\s\S]*?)<\/url>/gi;
  let block;
  while ((block = urlBlockRegex.exec(xml)) !== null) {
    const content = block[1];
    const locMatch = content.match(/<loc>\s*(.*?)\s*<\/loc>/i);
    if (!locMatch) continue;
    const loc = locMatch[1].trim();
    const lastmodMatch = content.match(/<lastmod>\s*(.*?)\s*<\/lastmod>/i);
    entries.push({ loc, lastmod: lastmodMatch?.[1]?.trim() });
  }
  return entries;
}

/**
 * Extract child sitemap URLs from a sitemap index.
 */
function extractSitemapLocs(xml: string): string[] {
  const locs: string[] = [];
  const sitemapBlockRegex = /<sitemap>([\s\S]*?)<\/sitemap>/gi;
  let block;
  while ((block = sitemapBlockRegex.exec(xml)) !== null) {
    const locMatch = block[1].match(/<loc>\s*(.*?)\s*<\/loc>/i);
    if (locMatch) locs.push(locMatch[1].trim());
  }
  return locs;
}

/**
 * Discover the sitemap and RSS feed URLs from a site.
 */
export async function discoverFeeds(siteUrl: string): Promise<{ sitemapUrl?: string; rssUrl?: string }> {
  const result: { sitemapUrl?: string; rssUrl?: string } = {};
  const baseUrl = siteUrl.replace(/\/+$/, "");

  // Try common sitemap locations
  const sitemapCandidates = [
    `${baseUrl}/sitemap.xml`,
    `${baseUrl}/sitemap_index.xml`,
    `${baseUrl}/post-sitemap.xml`,
    `${baseUrl}/wp-sitemap-posts-post-1.xml`,
  ];

  for (const url of sitemapCandidates) {
    const xml = await fetchXml(url, 10000);
    if (xml && (xml.includes("<urlset") || xml.includes("<sitemapindex"))) {
      result.sitemapUrl = url;
      break;
    }
  }

  // Try common RSS feed locations
  const rssCandidates = [
    `${baseUrl}/feed`,
    `${baseUrl}/rss`,
    `${baseUrl}/feed.xml`,
    `${baseUrl}/rss.xml`,
    `${baseUrl}/atom.xml`,
    `${baseUrl}/blog/feed`,
  ];

  for (const url of rssCandidates) {
    const xml = await fetchXml(url, 10000);
    if (xml && (xml.includes("<rss") || xml.includes("<feed") || xml.includes("<channel"))) {
      result.rssUrl = url;
      break;
    }
  }

  // Also try parsing the homepage for feed links
  if (!result.rssUrl) {
    try {
      const res = await fetch(baseUrl, {
        headers: BROWSER_HEADERS,
        signal: AbortSignal.timeout(10000),
      });
      if (res.ok) {
        const html = await res.text();
        const $ = cheerio.load(html);
        const feedLink = $('link[type="application/rss+xml"], link[type="application/atom+xml"]').first();
        if (feedLink.length) {
          let href = feedLink.attr("href") || "";
          if (href && !href.startsWith("http")) {
            href = href.startsWith("/") ? `${baseUrl}${href}` : `${baseUrl}/${href}`;
          }
          if (href) result.rssUrl = href;
        }
      }
    } catch { /* ignore */ }
  }

  return result;
}

/**
 * Parse posts from a sitemap XML.
 * Handles both sitemap index and regular sitemaps.
 * Uses regex extraction to handle namespaced XML reliably.
 */
export async function fetchFromSitemap(
  sitemapUrl: string,
  siteId: string,
  existingUrls: Set<string>,
): Promise<BookmarkPost[]> {
  const posts: BookmarkPost[] = [];

  try {
    const xml = await fetchXml(sitemapUrl);
    if (!xml) return posts;

    // Check if it's a sitemap index
    if (xml.includes("<sitemapindex")) {
      const childUrls = extractSitemapLocs(xml);

      // Prioritize post/blog/article sitemaps
      const postSitemaps = childUrls.filter(
        (u) => u.includes("post") || u.includes("blog") || u.includes("article"),
      );
      const toFetch = postSitemaps.length > 0 ? postSitemaps : childUrls.slice(0, 5);

      for (const childUrl of toFetch) {
        const childPosts = await fetchFromSitemap(childUrl, siteId, existingUrls);
        posts.push(...childPosts);
      }
      return posts;
    }

    // Regular sitemap — extract URL entries using regex
    const entries = extractUrlEntries(xml);

    for (const entry of entries) {
      if (!entry.loc || existingUrls.has(entry.loc)) continue;

      // Skip non-content pages
      const lower = entry.loc.toLowerCase();
      if (
        (lower.endsWith("/") && lower.split("/").filter(Boolean).length <= 3) ||
        lower.includes("/tag/") ||
        lower.includes("/category/") ||
        lower.includes("/author/") ||
        lower.includes("/page/") ||
        lower.includes("/wp-content/") ||
        lower.includes("/wp-admin/") ||
        lower.endsWith(".xml") ||
        lower.endsWith(".jpg") ||
        lower.endsWith(".png")
      ) {
        continue;
      }

      posts.push({
        id: generateId(),
        siteId,
        url: entry.loc,
        title: extractTitleFromUrl(entry.loc),
        description: "",
        tags: [],
        source: "sitemap",
        discoveredAt: entry.lastmod || new Date().toISOString(),
        submitted: false,
      });
    }
  } catch { /* ignore fetch errors */ }

  return posts;
}

/**
 * Parse posts from an RSS/Atom feed.
 */
export async function fetchFromRSS(
  rssUrl: string,
  siteId: string,
  existingUrls: Set<string>,
): Promise<BookmarkPost[]> {
  const posts: BookmarkPost[] = [];

  try {
    const xml = await fetchXml(rssUrl);
    if (!xml) return posts;

    const $ = cheerio.load(xml, { xmlMode: true });

    // RSS 2.0
    $("item").each((_, el) => {
      const link = $(el).find("link").first().text().trim();
      if (!link || existingUrls.has(link)) return;

      const title = $(el).find("title").first().text().trim();
      const desc = $(el).find("description").first().text().trim();
      const pubDate = $(el).find("pubDate").first().text().trim();

      const tags: string[] = [];
      $(el).find("category").each((_, cat) => {
        const tag = $(cat).text().trim();
        if (tag) tags.push(tag);
      });

      const cleanDesc = desc.replace(/<[^>]+>/g, "").substring(0, 300);

      posts.push({
        id: generateId(),
        siteId,
        url: link,
        title: title || extractTitleFromUrl(link),
        description: cleanDesc,
        tags: tags.slice(0, 10),
        source: "rss",
        discoveredAt: pubDate ? new Date(pubDate).toISOString() : new Date().toISOString(),
        submitted: false,
      });
    });

    // Atom
    if (posts.length === 0) {
      $("entry").each((_, el) => {
        const linkEl = $(el).find('link[rel="alternate"], link').first();
        const link = linkEl.attr("href") || linkEl.text().trim();
        if (!link || existingUrls.has(link)) return;

        const title = $(el).find("title").first().text().trim();
        const summary = $(el).find("summary, content").first().text().trim();
        const published = $(el).find("published, updated").first().text().trim();

        const tags: string[] = [];
        $(el).find("category").each((_, cat) => {
          const term = $(cat).attr("term") || $(cat).text().trim();
          if (term) tags.push(term);
        });

        const cleanSummary = summary.replace(/<[^>]+>/g, "").substring(0, 300);

        posts.push({
          id: generateId(),
          siteId,
          url: link,
          title: title || extractTitleFromUrl(link),
          description: cleanSummary,
          tags: tags.slice(0, 10),
          source: "rss",
          discoveredAt: published || new Date().toISOString(),
          submitted: false,
        });
      });
    }
  } catch { /* ignore fetch errors */ }

  return posts;
}

/**
 * Fetch page titles for posts that only have URL-derived titles.
 */
export async function enrichPostTitle(post: BookmarkPost): Promise<BookmarkPost> {
  if (post.title && !post.title.includes("-") && post.title.length > 5) {
    return post;
  }

  try {
    const res = await fetch(post.url, {
      headers: BROWSER_HEADERS,
      signal: AbortSignal.timeout(10000),
    });
    if (!res.ok) return post;

    const html = await res.text();
    const $ = cheerio.load(html);

    const title =
      $("title").first().text().trim() ||
      $('meta[property="og:title"]').attr("content")?.trim() ||
      $('meta[name="twitter:title"]').attr("content")?.trim() ||
      post.title;

    const description =
      post.description ||
      $('meta[name="description"]').attr("content")?.trim() ||
      $('meta[property="og:description"]').attr("content")?.trim() ||
      "";

    let tags = post.tags;
    if (tags.length === 0) {
      const keywords = $('meta[name="keywords"]').attr("content")?.trim();
      if (keywords) {
        tags = keywords.split(",").map((k) => k.trim()).filter(Boolean).slice(0, 10);
      }
    }

    return { ...post, title: title.split("|")[0].split(" - ")[0].trim(), description, tags };
  } catch {
    return post;
  }
}

function extractTitleFromUrl(url: string): string {
  try {
    const pathname = new URL(url).pathname;
    const slug = pathname.split("/").filter(Boolean).pop() || "";
    return slug
      .replace(/[-_]/g, " ")
      .replace(/\.(html|htm|php|asp)$/i, "")
      .replace(/\b\w/g, (c) => c.toUpperCase())
      .trim() || url;
  } catch {
    return url;
  }
}
