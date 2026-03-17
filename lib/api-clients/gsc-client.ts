import type { KeywordData, Keyword } from "@/lib/types";

const GSC_API_BASE = "https://searchconsole.googleapis.com/webmasters/v3";

async function getAccessToken(): Promise<string> {
  const credJson = process.env.GSC_CREDENTIALS_JSON;
  if (!credJson) throw new Error("GSC_CREDENTIALS_JSON not configured");

  const creds = JSON.parse(Buffer.from(credJson, "base64").toString("utf-8"));
  const now = Math.floor(Date.now() / 1000);

  // Build JWT for service account
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

export async function fetchGSCData(): Promise<KeywordData> {
  const siteUrl = process.env.GSC_SITE_URL;
  if (!siteUrl) throw new Error("GSC_SITE_URL not configured");

  const accessToken = await getAccessToken();
  const endDate = new Date().toISOString().split("T")[0];
  const startDate = new Date(Date.now() - 28 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];

  const res = await fetch(
    `https://searchconsole.googleapis.com/webmasters/v3/sites/${encodeURIComponent(siteUrl)}/searchAnalytics/query`,
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
        rowLimit: 500,
        type: "web",
      }),
    }
  );

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`GSC API error: ${res.status} - ${err}`);
  }

  const data = await res.json();
  const rows = data.rows || [];

  const keywords: Keyword[] = rows.map((row: { keys: string[]; impressions: number; clicks: number; ctr: number; position: number }) => ({
    query: row.keys[0],
    impressions: row.impressions,
    clicks: row.clicks,
    ctr: Math.round(row.ctr * 10000) / 100,
    position: Math.round(row.position * 10) / 10,
    source: "gsc" as const,
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
