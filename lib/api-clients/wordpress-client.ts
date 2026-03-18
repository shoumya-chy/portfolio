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

  // Check cache first
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

    setCache("wordpress", data, siteUrl);
    return data;
  } catch (err) {
    console.log(`[WordPress] Fetch failed:`, err instanceof Error ? err.message : err);
    return null;
  }
}

/**
 * Build a concise existing topics list for the Claude prompt.
 * Only titles and focus keywords — no bloat.
 */
export function formatExistingTopicsForPrompt(wpData: WPSiteData): string {
  if (!wpData?.content?.length) return "";

  const posts = wpData.content.filter(p => p.type === "post");

  const lines: string[] = [];
  for (const post of posts) {
    const kw = post.seo.focusKeyword ? ` [keyword: ${post.seo.focusKeyword}]` : "";
    lines.push(`- ${post.title}${kw}`);
  }

  return lines.join("\n");
}

/**
 * Build a set of normalized topics/keywords from existing WordPress content.
 * Used for programmatic dedup AFTER Claude generates ideas.
 */
export function buildExistingTopicSet(wpData: WPSiteData): Set<string> {
  const topics = new Set<string>();

  for (const post of wpData.content) {
    if (post.type !== "post") continue;

    // Add normalized title words (3+ chars)
    const titleWords = normalize(post.title).split(/\s+/).filter(w => w.length > 2);

    // Add full normalized title
    topics.add(normalize(post.title));

    // Add normalized slug
    topics.add(normalize(post.slug.replace(/-/g, " ")));

    // Add focus keyword
    if (post.seo.focusKeyword) {
      topics.add(normalize(post.seo.focusKeyword));
    }

    // Add 2-3 word phrases from title
    for (let i = 0; i < titleWords.length - 1; i++) {
      topics.add(titleWords.slice(i, i + 2).join(" "));
      if (i < titleWords.length - 2) {
        topics.add(titleWords.slice(i, i + 3).join(" "));
      }
    }
  }

  return topics;
}

/**
 * Check if a content idea overlaps with existing content.
 * Returns true if the idea is a DUPLICATE.
 */
export function isIdeaDuplicate(
  ideaTitle: string,
  ideaKeywords: string[],
  existingTopics: Set<string>,
  existingTitles: string[]
): boolean {
  const normTitle = normalize(ideaTitle);

  // Direct title match
  for (const existing of existingTitles) {
    const normExisting = normalize(existing);
    // Check if titles are very similar (one contains the other)
    if (normTitle.includes(normExisting) || normExisting.includes(normTitle)) {
      return true;
    }
    // Check word overlap — if 60%+ words match, it's a duplicate
    const titleWords = new Set(normTitle.split(/\s+/).filter(w => w.length > 2));
    const existingWords = normExisting.split(/\s+/).filter(w => w.length > 2);
    if (existingWords.length > 0 && titleWords.size > 0) {
      const overlap = existingWords.filter(w => titleWords.has(w)).length;
      const overlapRatio = overlap / Math.min(titleWords.size, existingWords.length);
      if (overlapRatio >= 0.6) return true;
    }
  }

  // Check if primary keyword matches existing topics
  for (const kw of ideaKeywords) {
    if (existingTopics.has(normalize(kw))) return true;
  }

  // Check 2-3 word phrases from idea title against existing topics
  const words = normTitle.split(/\s+/).filter(w => w.length > 2);
  for (let i = 0; i < words.length - 1; i++) {
    const bigram = words.slice(i, i + 2).join(" ");
    const trigram = words.slice(i, i + 3).join(" ");
    if (existingTopics.has(bigram) || existingTopics.has(trigram)) {
      // Only flag as duplicate if the matching phrase is specific enough
      if (bigram.length > 8) return true;
    }
  }

  return false;
}

function normalize(str: string): string {
  return str
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}
