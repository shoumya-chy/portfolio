import type { KeywordData, Keyword, PageKeywordMap } from "@/lib/types";
import { getGscCredentials } from "@/lib/config";

async function getAccessToken(): Promise<string> {
  const credJson = getGscCredentials();
  if (!credJson) throw new Error("GSC credentials not configured. Add them in Settings.");

  const creds = JSON.parse(Buffer.from(credJson, "base64").toString("utf-8"));
  const now = Math.floor(Date.now() / 1000);

  const header = Buffer.from(JSON.stringify({ alg: "RS256", typ: "JWT" })).toString("base64url");
  const payload = Buffer.from(
    JSON.stringify({
      iss: creds.client_email,
      scope: "https://www.googleapis.com/auth/webmasters.readonly",
      aud: "https://oauth2.googleapis.com/token",
      iat: now,
      exp: now + 3600,
    })
  ).toString("base64url");

  const { createSign } = await import("crypto");
  const sign = createSign("RSA-SHA256");
  sign.update(`${header}.${payload}`);
  const signature = sign.sign(creds.private_key, "base64url");

  const jwt = `${header}.${payload}.${signature}`;

  const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${jwt}`,
  });

  const tokenData = await tokenRes.json();
  if (!tokenData.access_token) throw new Error("Failed to get GSC access token");
  return tokenData.access_token;
}

export async function fetchGSCData(siteUrl: string): Promise<KeywordData> {
  if (!siteUrl) throw new Error("Site URL is required");

  const accessToken = await getAccessToken();

  // GSC API uses last 3 days of delay — end date should be 3 days ago for accurate totals
  const endDate = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];
  const startDate = new Date(Date.now() - 31 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];

  // Normalize siteUrl — GSC needs exact match (try with trailing slash)
  const siteUrlVariants = [
    siteUrl,
    siteUrl.endsWith("/") ? siteUrl.slice(0, -1) : siteUrl + "/",
  ];

  let allKeywords: Keyword[] = [];
  let fetchedSiteUrl = siteUrl;

  for (const tryUrl of siteUrlVariants) {
    try {
      // Fetch ALL keywords using pagination (GSC max per request is 25000)
      const keywords: Keyword[] = [];
      let startRow = 0;
      const PAGE_SIZE = 25000;

      while (true) {
        const res = await fetch(
          `https://searchconsole.googleapis.com/webmasters/v3/sites/${encodeURIComponent(tryUrl)}/searchAnalytics/query`,
          {
            method: "POST",
            headers: {
              Authorization: `Bearer ${accessToken}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              startDate,
              endDate,
              dimensions: ["query"],
              rowLimit: PAGE_SIZE,
              startRow,
              type: "web",
            }),
          }
        );

        if (!res.ok) {
          if (tryUrl !== siteUrlVariants[siteUrlVariants.length - 1]) break;
          const err = await res.text();
          throw new Error(`GSC API error: ${res.status} - ${err}`);
        }

        const data = await res.json();
        const rows = data.rows || [];

        if (rows.length === 0) break;

        for (const row of rows) {
          keywords.push({
            query: row.keys[0],
            impressions: row.impressions,
            clicks: row.clicks,
            ctr: Math.round(row.ctr * 10000) / 100,
            position: Math.round(row.position * 10) / 10,
            source: "gsc" as const,
          });
        }

        console.log(`[GSC] Fetched ${keywords.length} keywords so far (batch: ${rows.length})`);

        // If we got fewer rows than PAGE_SIZE, we've fetched everything
        if (rows.length < PAGE_SIZE) break;
        startRow += PAGE_SIZE;
      }

      if (keywords.length > 0) {
        allKeywords = keywords;
        fetchedSiteUrl = tryUrl;
        break;
      }
    } catch (err) {
      // If this variant failed and it's not the last one, try next
      if (tryUrl === siteUrlVariants[siteUrlVariants.length - 1]) {
        throw err;
      }
      console.log(`[GSC] Trying alternative URL format...`);
    }
  }

  const totalImpressions = allKeywords.reduce((s, k) => s + k.impressions, 0);
  const totalClicks = allKeywords.reduce((s, k) => s + k.clicks, 0);
  const avgPosition = allKeywords.length
    ? Math.round((allKeywords.reduce((s, k) => s + k.position, 0) / allKeywords.length) * 10) / 10
    : 0;

  console.log(`[GSC] Final: ${allKeywords.length} keywords, ${totalImpressions} impressions, ${totalClicks} clicks for ${fetchedSiteUrl}`);

  return { keywords: allKeywords, totalImpressions, totalClicks, avgPosition, fetchedAt: new Date().toISOString() };
}

/**
 * Fetch keyword-to-page mapping from GSC.
 * Returns which keywords each page ranks for.
 */
export async function fetchGSCPageKeywords(siteUrl: string): Promise<PageKeywordMap[]> {
  if (!siteUrl) return [];

  const accessToken = await getAccessToken();
  const endDate = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];
  const startDate = new Date(Date.now() - 31 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];

  const siteUrlVariants = [
    siteUrl,
    siteUrl.endsWith("/") ? siteUrl.slice(0, -1) : siteUrl + "/",
  ];

  for (const tryUrl of siteUrlVariants) {
    try {
      const res = await fetch(
        `https://searchconsole.googleapis.com/webmasters/v3/sites/${encodeURIComponent(tryUrl)}/searchAnalytics/query`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            startDate,
            endDate,
            dimensions: ["page", "query"],
            rowLimit: 25000,
            type: "web",
          }),
        }
      );

      if (!res.ok) continue;

      const data = await res.json();
      const rows = data.rows || [];

      // Group by page URL
      const pageMap = new Map<string, PageKeywordMap>();

      for (const row of rows) {
        const pageUrl = row.keys[0];
        const query = row.keys[1];

        if (!pageMap.has(pageUrl)) {
          pageMap.set(pageUrl, {
            url: pageUrl,
            keywords: [],
            totalImpressions: 0,
            totalClicks: 0,
          });
        }

        const page = pageMap.get(pageUrl)!;
        page.keywords.push({
          query,
          impressions: row.impressions,
          clicks: row.clicks,
          position: Math.round(row.position * 10) / 10,
        });
        page.totalImpressions += row.impressions;
        page.totalClicks += row.clicks;
      }

      // Sort keywords within each page by impressions
      for (const page of pageMap.values()) {
        page.keywords.sort((a, b) => b.impressions - a.impressions);
      }

      const result = Array.from(pageMap.values())
        .sort((a, b) => b.totalImpressions - a.totalImpressions);

      console.log(`[GSC] Page-keyword map: ${result.length} pages with keywords`);
      return result;
    } catch {
      continue;
    }
  }

  return [];
}
