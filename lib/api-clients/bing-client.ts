import type { KeywordData, Keyword } from "@/lib/types";

export async function fetchBingData(): Promise<KeywordData> {
  const apiKey = process.env.BING_API_KEY;
  const siteUrl = process.env.BING_SITE_URL || process.env.GSC_SITE_URL;
  if (!apiKey || !siteUrl) throw new Error("Bing credentials not configured");

  const endDate = new Date().toISOString().split("T")[0];
  const startDate = new Date(Date.now() - 28 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];

  const url = `https://ssl.bing.com/webmaster/api.svc/json/GetQueryStats?apikey=${encodeURIComponent(apiKey)}&siteUrl=${encodeURIComponent(siteUrl)}&query=&start=${startDate}&end=${endDate}`;

  const res = await fetch(url);
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Bing API error: ${res.status} - ${err}`);
  }

  const data = await res.json();
  const rows = data.d || data || [];

  const keywordMap = new Map<string, Keyword>();
  for (const row of rows) {
    const q = row.Query || row.query || "";
    if (!q) continue;
    const existing = keywordMap.get(q);
    if (existing) {
      existing.impressions += row.Impressions || 0;
      existing.clicks += row.Clicks || 0;
    } else {
      keywordMap.set(q, {
        query: q,
        impressions: row.Impressions || 0,
        clicks: row.Clicks || 0,
        ctr: 0,
        position: row.AvgPosition || row.Position || 0,
        source: "bing",
      });
    }
  }

  const keywords = Array.from(keywordMap.values()).map((k) => ({
    ...k,
    ctr: k.impressions > 0 ? Math.round((k.clicks / k.impressions) * 10000) / 100 : 0,
  }));

  const totalImpressions = keywords.reduce((s, k) => s + k.impressions, 0);
  const totalClicks = keywords.reduce((s, k) => s + k.clicks, 0);
  const avgPosition = keywords.length ? Math.round((keywords.reduce((s, k) => s + k.position, 0) / keywords.length) * 10) / 10 : 0;

  return {
    keywords,
    totalImpressions,
    totalClicks,
    avgPosition,
    fetchedAt: new Date().toISOString(),
  };
}
