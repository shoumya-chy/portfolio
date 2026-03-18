import { getSites } from "@/lib/config";
import { getCache, setCache } from "@/lib/cache";

export interface WPPost {
  id: number;
  type: string;
  title: string;
  slug: string;
  url: string;
  publishedAt: string;
  modifiedAt: string;
  author: string;
  wordCount: number;
  excerpt: string;
  categories: string[];
  tags: string[];
  seo: {
    metaTitle: string;
    metaDescription: string;
    focusKeyword: string;
    seoScore: string;
    readabilityScore: string;
    schema: string;
    plugin: string;
  };
  headings: { level: number; text: string }[];
  featuredImage: string | null;
  internalLinksCount: number;
}

export interface WPSiteData {
  site: {
    name: string;
    url: string;
    description: string;
    totalPosts: number;
    totalPages: number;
    fetchedAt: string;
  };
  content: WPPost[];
}

/**
 * Fetch content data from WordPress via the SEO Bridge plugin
 */
export async function fetchWordPressData(siteUrl: string): Promise<WPSiteData | null> {
  const sites = getSites();
  const site = sites.find(s => s.url === siteUrl);

  if (!site?.wpApiUrl || !site?.wpApiKey) {
    return null;
  }

  // Check cache first (15 min TTL like the WP plugin)
  const cached = getCache<WPSiteData>("wordpress", siteUrl);
  if (cached) {
    console.log(`[WordPress] Using cached data for ${siteUrl}`);
    return cached;
  }

  console.log(`[WordPress] Fetching from ${site.wpApiUrl}`);

  try {
    const res = await fetch(site.wpApiUrl, {
      headers: {
        "X-API-Key": site.wpApiKey,
        Accept: "application/json",
      },
    });

    if (!res.ok) {
      const err = await res.text();
      console.log(`[WordPress] API error: ${res.status} - ${err.substring(0, 200)}`);
      return null;
    }

    const data: WPSiteData = await res.json();
    console.log(`[WordPress] Fetched ${data.content?.length || 0} posts/pages from ${data.site?.name || siteUrl}`);

    // Cache for 15 minutes
    setCache("wordpress", data, siteUrl);

    return data;
  } catch (err) {
    console.log(`[WordPress] Fetch failed:`, err instanceof Error ? err.message : err);
    return null;
  }
}

/**
 * Format WordPress content for Claude analysis prompt.
 * Returns a structured list of existing content with titles, slugs, keywords, word counts.
 */
export function formatWPContentForAnalysis(wpData: WPSiteData): string {
  if (!wpData?.content?.length) return "";

  const posts = wpData.content
    .filter(p => p.type === "post")
    .sort((a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime());

  const lines: string[] = [];

  lines.push(`## EXISTING CONTENT ON THIS WORDPRESS SITE (${posts.length} published posts)\n`);
  lines.push("IMPORTANT: Do NOT suggest any topic that overlaps with these existing articles.\n");

  for (const post of posts) {
    const parts = [`"${post.title}"`];
    parts.push(`slug: /${post.slug}/`);
    if (post.seo.focusKeyword) parts.push(`focus keyword: "${post.seo.focusKeyword}"`);
    parts.push(`${post.wordCount} words`);
    if (post.categories.length) parts.push(`cat: ${post.categories.join(", ")}`);
    lines.push(`- ${parts.join(" | ")}`);
  }

  // Also list thin content (under 500 words) as improvement opportunities
  const thinPosts = posts.filter(p => p.wordCount < 500 && p.wordCount > 0);
  if (thinPosts.length > 0) {
    lines.push(`\n## THIN CONTENT (under 500 words — consider expanding these instead of writing new):`);
    for (const post of thinPosts) {
      lines.push(`- "${post.title}" (${post.wordCount} words) → ${post.url}`);
    }
  }

  // List posts with no focus keyword as SEO improvement opportunities
  const noFocusKw = posts.filter(p => !p.seo.focusKeyword && p.wordCount > 300);
  if (noFocusKw.length > 0) {
    lines.push(`\n## POSTS WITHOUT FOCUS KEYWORD (need SEO optimization):`);
    for (const post of noFocusKw.slice(0, 10)) {
      lines.push(`- "${post.title}" → ${post.url}`);
    }
  }

  return lines.join("\n");
}
