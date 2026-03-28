import { NextResponse } from "next/server";
import { getAuthFromCookies } from "@/lib/auth";
import { getSite, listPosts, savePost, savePosts, deletePost } from "@/lib/social-bookmarking/storage";
import { discoverFeeds, fetchFromSitemap, fetchFromRSS, enrichPostTitle } from "@/lib/social-bookmarking/fetcher";
import type { BookmarkPost } from "@/lib/social-bookmarking/types";

export async function GET(req: Request) {
  const isAdmin = await getAuthFromCookies();
  if (!isAdmin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const siteId = searchParams.get("siteId");
  return NextResponse.json({ posts: listPosts(siteId || undefined) });
}

/** POST — Fetch posts from sitemap/RSS */
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

  // Auto-discover feeds if not set
  let sitemapUrl = site.sitemapUrl;
  let rssUrl = site.rssUrl;

  if (!sitemapUrl && !rssUrl) {
    const feeds = await discoverFeeds(site.url);
    sitemapUrl = feeds.sitemapUrl;
    rssUrl = feeds.rssUrl;

    // Save discovered URLs back to site
    if (sitemapUrl || rssUrl) {
      site.sitemapUrl = sitemapUrl || site.sitemapUrl;
      site.rssUrl = rssUrl || site.rssUrl;
      const { saveSite } = await import("@/lib/social-bookmarking/storage");
      saveSite(site);
    }
  }

  // Fetch from RSS first (has titles + descriptions)
  if (rssUrl) {
    const rssPosts = await fetchFromRSS(rssUrl, siteId, existingUrls);
    for (const p of rssPosts) existingUrls.add(p.url);
    newPosts.push(...rssPosts);
  }

  // Then from sitemap (more comprehensive but less metadata)
  if (sitemapUrl) {
    const sitemapPosts = await fetchFromSitemap(sitemapUrl, siteId, existingUrls);
    newPosts.push(...sitemapPosts);
  }

  if (newPosts.length === 0) {
    return NextResponse.json({
      posts: existingPosts,
      newCount: 0,
      message: sitemapUrl || rssUrl
        ? "No new posts found"
        : "Could not discover sitemap or RSS feed. Add URLs manually or configure sitemap/RSS in site settings.",
    });
  }

  // Enrich titles for sitemap-discovered posts (first 20 to avoid rate limiting)
  const toEnrich = newPosts.filter((p) => p.source === "sitemap").slice(0, 20);
  for (let i = 0; i < toEnrich.length; i++) {
    const idx = newPosts.findIndex((p) => p.id === toEnrich[i].id);
    if (idx >= 0) {
      newPosts[idx] = await enrichPostTitle(newPosts[idx]);
    }
    // Small delay
    if (i < toEnrich.length - 1) {
      await new Promise((r) => setTimeout(r, 500));
    }
  }

  // Save all posts
  const allPosts = [...existingPosts, ...newPosts];
  savePosts(allPosts);

  return NextResponse.json({
    posts: allPosts,
    newCount: newPosts.length,
    sitemapUrl,
    rssUrl,
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
    id: `post_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
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
