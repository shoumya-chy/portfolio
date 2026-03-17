import { NextResponse } from "next/server";
import { getAuthFromCookies } from "@/lib/auth";
import { getCache, setCache } from "@/lib/cache";
import { fetchSitemap, type SitemapUrl } from "@/lib/api-clients/sitemap-parser";
import { getSites } from "@/lib/config";

export async function POST(req: Request) {
  const isAdmin = await getAuthFromCookies();
  if (!isAdmin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const { siteUrl } = await req.json();
    if (!siteUrl) return NextResponse.json({ error: "siteUrl required" }, { status: 400 });

    const cached = getCache<SitemapUrl[]>("sitemap", siteUrl);
    if (cached) return NextResponse.json({ data: cached, fromCache: true });

    // Find the site's sitemap URL from config
    const sites = getSites();
    const site = sites.find((s) => s.url === siteUrl);
    if (!site?.sitemapUrl) {
      return NextResponse.json({ data: [], fromCache: false, message: "No sitemap URL configured for this site" });
    }

    const data = await fetchSitemap(site.sitemapUrl);
    setCache("sitemap", data, siteUrl);
    return NextResponse.json({ data, fromCache: false });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to fetch sitemap";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
