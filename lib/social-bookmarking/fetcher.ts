/**
 * Sitemap & RSS fetcher.
 * Auto-discovers posts from a site's sitemap.xml or RSS feed.
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
    try {
      const res = await fetch(url, {
        headers: BROWSER_HEADERS,
        signal: AbortSignal.timeout(10000),
      });
      if (res.ok) {
        const text = await res.text();
        if (text.includes("<urlset") || text.includes("<sitemapindex")) {
          result.sitemapUrl = url;
          break;
        }
      }
    } catch { /* continue */ }
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
    try {
      const res = await fetch(url, {
        headers: BROWSER_HEADERS,
        signal: AbortSignal.timeout(10000),
      });
      if (res.ok) {
        const text = await res.text();
        if (text.includes("<rss") || text.includes("<feed") || text.includes("<channel")) {
          result.rssUrl = url;
          break;
        }
      }
    } catch { /* continue */ }
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
 */
export async function fetchFromSitemap(
  sitemapUrl: string,
  siteId: string,
  existingUrls: Set<string>,
): Promise<BookmarkPost[]> {
  const posts: BookmarkPost[] = [];

  try {
    const res = await fetch(sitemapUrl, {
      headers: BROWSER_HEADERS,
      signal: AbortSignal.timeout(15000),
    });
    if (!res.ok) return posts;

    const xml = await res.text();
    const $ = cheerio.load(xml, { xmlMode: true });

    // Check if it's a sitemap index
    const sitemapLocs = $("sitemap > loc");
    if (sitemapLocs.length > 0) {
      // It's a sitemap index — parse child sitemaps (prefer post sitemaps)
      const childUrls: string[] = [];
      sitemapLocs.each((_, el) => {
        const loc = $(el).text().trim();
        if (loc) childUrls.push(loc);
      });

      // Prioritize post sitemaps
      const postSitemaps = childUrls.filter(
        (u) => u.includes("post") || u.includes("blog") || u.includes("article"),
      );
      const toFetch = postSitemaps.length > 0 ? postSitemaps : childUrls.slice(0, 3);

      for (const childUrl of toFetch) {
        const childPosts = await fetchFromSitemap(childUrl, siteId, existingUrls);
        posts.push(...childPosts);
      }
      return posts;
    }

    // Regular sitemap — extract URLs
    $("url").each((_, el) => {
      const loc = $(el).find("loc").text().trim();
      if (!loc || existingUrls.has(loc)) return;

      // Skip non-content pages
      const lower = loc.toLowerCase();
      if (
        lower.endsWith("/") && lower.split("/").filter(Boolean).length <= 3 || // homepage or category
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
        return;
      }

      const lastmod = $(el).find("lastmod").text().trim();

      posts.push({
        id: generateId(),
        siteId,
        url: loc,
        title: extractTitleFromUrl(loc),
        description: "",
        tags: [],
        source: "sitemap",
        discoveredAt: lastmod || new Date().toISOString(),
        submitted: false,
      });
    });
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
    const res = await fetch(rssUrl, {
      headers: BROWSER_HEADERS,
      signal: AbortSignal.timeout(15000),
    });
    if (!res.ok) return posts;

    const xml = await res.text();
    const $ = cheerio.load(xml, { xmlMode: true });

    // RSS 2.0
    $("item").each((_, el) => {
      const link = $(el).find("link").first().text().trim();
      if (!link || existingUrls.has(link)) return;

      const title = $(el).find("title").first().text().trim();
      const desc = $(el).find("description").first().text().trim();
      const pubDate = $(el).find("pubDate").first().text().trim();

      // Extract categories/tags
      const tags: string[] = [];
      $(el).find("category").each((_, cat) => {
        const tag = $(cat).text().trim();
        if (tag) tags.push(tag);
      });

      // Clean HTML from description
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
    return post; // Already has a good title
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

    // Extract tags from meta keywords if no tags
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
