import { NextRequest, NextResponse } from "next/server";
import { getSites } from "@/lib/config";
import { setCache } from "@/lib/cache";
import { fetchGSCData, fetchGSCPageKeywords } from "@/lib/api-clients/gsc-client";
import { fetchBingData } from "@/lib/api-clients/bing-client";
import { fetchRedditTopics } from "@/lib/api-clients/reddit-scraper";
import { fetchQuoraTopics } from "@/lib/api-clients/quora-scraper";
import { fetchSitemap } from "@/lib/api-clients/sitemap-parser";

const CRON_SECRET = process.env.CRON_SECRET || "dev-cron-secret";

export async function GET(req: NextRequest) {
  // Verify cron secret
  const secret = req.nextUrl.searchParams.get("secret");
  if (secret !== CRON_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const sites = getSites();
  const results: Record<string, { gsc?: string; gscPages?: string; bing?: string; reddit?: string; quora?: string; sitemap?: string }> = {};

  // Fetch Reddit & Quora (not site-specific)
  let redditStatus = "skipped";
  let quoraStatus = "skipped";

  try {
    const redditData = await fetchRedditTopics();
    setCache("reddit", redditData);
    redditStatus = `ok (${redditData.length} topics)`;
  } catch (err) {
    redditStatus = `error: ${err instanceof Error ? err.message : "unknown"}`;
  }

  try {
    const quoraData = await fetchQuoraTopics();
    setCache("quora", quoraData);
    quoraStatus = `ok (${quoraData.length} topics)`;
  } catch (err) {
    quoraStatus = `error: ${err instanceof Error ? err.message : "unknown"}`;
  }

  // Fetch GSC, Bing, and sitemap per site
  for (const site of sites) {
    results[site.name] = {};

    // GSC
    try {
      const gscData = await fetchGSCData(site.url);
      setCache("gsc", gscData, site.url);
      results[site.name].gsc = `ok (${gscData.keywords.length} keywords)`;
    } catch (err) {
      results[site.name].gsc = `error: ${err instanceof Error ? err.message : "unknown"}`;
    }

    // GSC Page-Keyword mapping (used by outreach backlink strategy)
    try {
      const gscPages = await fetchGSCPageKeywords(site.url);
      setCache("gsc-pages", gscPages, site.url);
      results[site.name].gscPages = `ok (${gscPages.length} pages)`;
    } catch (err) {
      results[site.name].gscPages = `error: ${err instanceof Error ? err.message : "unknown"}`;
    }

    // Bing
    try {
      const bingData = await fetchBingData(site.url);
      setCache("bing", bingData, site.url);
      results[site.name].bing = `ok (${bingData.keywords.length} keywords)`;
    } catch (err) {
      results[site.name].bing = `error: ${err instanceof Error ? err.message : "unknown"}`;
    }

    // Sitemap
    if (site.sitemapUrl) {
      try {
        const sitemapData = await fetchSitemap(site.sitemapUrl);
        setCache("sitemap", sitemapData, site.url);
        results[site.name].sitemap = `ok (${sitemapData.length} urls)`;
      } catch (err) {
        results[site.name].sitemap = `error: ${err instanceof Error ? err.message : "unknown"}`;
      }
    }
  }

  const summary = {
    ran: new Date().toISOString(),
    reddit: redditStatus,
    quora: quoraStatus,
    sites: results,
  };

  console.log("[CRON:DAILY]", JSON.stringify(summary));
  return NextResponse.json(summary);
}
