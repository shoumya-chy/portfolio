import { NextResponse } from "next/server";
import { getAuthFromCookies } from "@/lib/auth";
import { getSite, listPosts, savePost, savePosts, deletePost, saveSite } from "@/lib/social-bookmarking/storage";
import { discoverFeeds, fetchFromSitemap, fetchFromRSS, enrichPostTitle } from "@/lib/social-bookmarking/fetcher";
import { fetchWordPressData } from "@/lib/api-clients/wordpress-client";
import { getSites } from "@/lib/config";
import type { BookmarkPost } from "@/lib/social-bookmarking/types";

function generateId(): string {
  return `post_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

export async function GET(req: Request) {
  const isAdmin = await getAuthFromCookies();
  if (!isAdmin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const siteId = searchParams.get("siteId");
  return NextResponse.json({ posts: listPosts(siteId || undefined) });
}

/** POST — Fetch posts. Tries WordPress API first, then sitemap/RSS */
export async function POST(req: Request) {
  const isAdmin = await getAuthFromCookies();
  if (!isAdmin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { siteId } = await req.json();
  if (!siteId) return NextResponse.json({ error: "siteId required" }, { status: 400 });

  const site = getSite(siteId);
  if (!site) return NextResponse.json({ error: "Site not found" }, { status: 404 });

  const existingPosts = listPosts(siteId);
  const existingUrls = new Set(existingPosts.map((p) => p.url));

  let newPosts: BookmarkPost[] = [];
  let source = "";

  // ===== Strategy 1: WordPress SEO Bridge API (best data quality) =====
  const configSites = getSites();
  // Match by URL — strip trailing slashes for comparison
  const normalizeUrl = (u: string) => u.replace(/\/+$/, "").toLowerCase();
  const wpSite = configSites.find(
    (s) => normalizeUrl(s.url) === normalizeUrl(site.url),
  );

  if (wpSite?.wpApiUrl && wpSite?.wpApiKey) {
    try {
      const wpData = await fetchWordPressData(wpSite.url);
      if (wpData?.content?.length) {
        source = "wordpress";
        for (const wp of wpData.content) {
          if (wp.type !== "post") continue; // Only blog posts, not pages
          if (existingUrls.has(wp.url)) continue;

          newPosts.push({
            id: generateId(),
            siteId,
            url: wp.url,
            title: wp.title,
            description: wp.excerpt?.replace(/<[^>]+>/g, "").substring(0, 300) || wp.seo?.metaDescription || "",
            tags: [
              ...(wp.tags || []),
              ...(wp.categories || []),
              ...(wp.seo?.focusKeyword ? [wp.seo.focusKeyword] : []),
            ].slice(0, 10),
            source: "rss", // Use "rss" since it has full metadata like RSS
            discoveredAt: wp.publishedAt || new Date().toISOString(),
            submitted: false,
          });
        }
      }
    } catch (err) {
      console.log("[Social-Bookmarking] WordPress fetch failed:", err instanceof Error ? err.message : err);
      // Fall through to sitemap/RSS
    }
  }

  // ===== Strategy 2: Sitemap / RSS (fallback) =====
  if (newPosts.length === 0) {
    let sitemapUrl = site.sitemapUrl;
    let rssUrl = site.rssUrl;

    if (!sitemapUrl && !rssUrl) {
      const feeds = await discoverFeeds(site.url);
      sitemapUrl = feeds.sitemapUrl;
      rssUrl = feeds.rssUrl;

      if (sitemapUrl || rssUrl) {
        site.sitemapUrl = sitemapUrl || site.sitemapUrl;
        site.rssUrl = rssUrl || site.rssUrl;
        saveSite(site);
      }
    }

    // RSS first (better metadata)
    if (rssUrl) {
      const rssPosts = await fetchFromRSS(rssUrl, siteId, existingUrls);
      for (const p of rssPosts) existingUrls.add(p.url);
      newPosts.push(...rssPosts);
      if (newPosts.length > 0) source = "rss";
    }

    // Then sitemap
    if (sitemapUrl) {
      const sitemapPosts = await fetchFromSitemap(sitemapUrl, siteId, existingUrls);
      newPosts.push(...sitemapPosts);
      if (!source && newPosts.length > 0) source = "sitemap";
    }

    // Enrich titles for sitemap posts
    if (source === "sitemap") {
      const toEnrich = newPosts.filter((p) => p.source === "sitemap").slice(0, 30);
      for (let i = 0; i < toEnrich.length; i++) {
        const idx = newPosts.findIndex((p) => p.id === toEnrich[i].id);
        if (idx >= 0) {
          newPosts[idx] = await enrichPostTitle(newPosts[idx]);
        }
        if (i < toEnrich.length - 1) await new Promise((r) => setTimeout(r, 300));
      }
    }
  }

  if (newPosts.length === 0) {
    return NextResponse.json({
      posts: existingPosts,
      newCount: 0,
      message: "No new posts found. Check that your site URL matches the config, or add a sitemap/RSS URL.",
    });
  }

  const allPosts = [...existingPosts, ...newPosts];
  savePosts(allPosts);

  return NextResponse.json({
    posts: allPosts,
    newCount: newPosts.length,
    source,
  });
}

/** PUT — Add a manual post */
export async function PUT(req: Request) {
  const isAdmin = await getAuthFromCookies();
  if (!isAdmin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  if (!body.siteId || !body.url || !body.title) {
    return NextResponse.json({ error: "siteId, url, and title required" }, { status: 400 });
  }

  const post: BookmarkPost = {
    id: generateId(),
    siteId: body.siteId,
    url: body.url,
    title: body.title,
    description: body.description || "",
    tags: body.tags || [],
    source: "manual",
    discoveredAt: new Date().toISOString(),
    submitted: false,
  };

  savePost(post);
  return NextResponse.json({ post });
}

export async function DELETE(req: Request) {
  const isAdmin = await getAuthFromCookies();
  if (!isAdmin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });

  deletePost(id);
  return NextResponse.json({ success: true });
}
