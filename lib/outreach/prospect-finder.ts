import { extractContactEmail } from "@/lib/api-clients/content-scraper";
import { listProspects, saveProspectsBatch } from "@/lib/outreach/storage";
import { getApiKey } from "@/lib/config";
import type { OutreachProject, OutreachProspect } from "@/lib/outreach/types";

const DATAFORSEO_API = "https://api.dataforseo.com/v3";

function generateProspectId(): string {
  return Date.now().toString(36) + Math.random().toString(36).substring(2, 8);
}

async function safeExtractEmail(url: string): Promise<string | null> {
  try {
    return await Promise.race([
      extractContactEmail(url),
      new Promise<null>((resolve) => setTimeout(() => resolve(null), 10000)),
    ]);
  } catch { return null; }
}

interface SerpResult { url: string; domain: string; title: string; domainAuthority?: number; }

/**
 * Phase 1: Find guest post opportunities.
 * DataForSEO SERP API (primary, DA filtered) → DuckDuckGo (fallback).
 */
export async function findNewProspects(
  project: OutreachProject
): Promise<{ prospects: OutreachProspect[]; searchResultCount: number; debug: string[] }> {
  const debug: string[] = [];
  const niche = project.niche || "";
  debug.push(`Niche: "${niche || "(multi-niche)"}"`);

  let searchResults: SerpResult[] = [];
  const dfLogin = getApiKey("dataForSeoLogin");
  const dfPassword = getApiKey("dataForSeoPassword");

  if (dfLogin && dfPassword) {
    debug.push("Using DataForSEO SERP");
    searchResults = await searchWithDataForSEO(niche, dfLogin, dfPassword);
  }
  if (searchResults.length === 0) {
    debug.push("Using DuckDuckGo fallback");
    searchResults = await searchWithDuckDuckGo(niche);
  }

  debug.push(`${searchResults.length} sites found`);
  if (searchResults.length === 0) return { prospects: [], searchResultCount: 0, debug };

  const existing = listProspects(project.id);
  const existingDomains = new Set(existing.map(p => p.targetDomain));
  const newProspects: OutreachProspect[] = [];
  let skipped = 0, emailFound = 0;

  for (const result of searchResults) {
    if (existingDomains.has(result.domain)) { skipped++; continue; }
    const contactEmail = await safeExtractEmail(result.url);
    if (contactEmail) emailFound++;

    newProspects.push({
      id: generateProspectId(), projectId: project.id,
      targetUrl: result.url, targetDomain: result.domain,
      contactEmail: contactEmail || "", writeForUsPage: result.url,
      state: "found", createdAt: new Date().toISOString(),
      outboundEmails: [], inboundEmails: [],
      domainAuthority: result.domainAuthority || 0, siteNiche: niche,
    });
    existingDomains.add(result.domain);
  }

  newProspects.sort((a, b) => (b.domainAuthority || 0) - (a.domainAuthority || 0));
  debug.push(`${skipped} dupes, ${emailFound} emails, ${newProspects.length} new`);

  if (newProspects.length > 0) saveProspectsBatch(project.id, newProspects);
  return { prospects: newProspects, searchResultCount: searchResults.length, debug };
}

async function searchWithDataForSEO(niche: string, login: string, password: string): Promise<SerpResult[]> {
  const auth = Buffer.from(`${login}:${password}`).toString("base64");
  const headers = { Authorization: `Basic ${auth}`, "Content-Type": "application/json" };
  const n = niche ? `${niche} ` : "";
  const tasks = [
    `${n}"write for us"`, `${n}"guest post guidelines"`,
    `${n}"submit a guest post"`, `${n}"become a contributor"`, `inurl:write-for-us ${n}`,
  ].map(keyword => ({ keyword, location_code: 2036, language_code: "en", device: "desktop", depth: 20 }));

  const results: SerpResult[] = [];
  const seen = new Set<string>();

  try {
    const postRes = await fetch(`${DATAFORSEO_API}/serp/google/organic/task_post`, {
      method: "POST", headers, body: JSON.stringify(tasks),
    });
    if (!postRes.ok) return [];
    const postData = await postRes.json();
    const taskIds = (postData.tasks || []).filter((t: { id?: string }) => t.id).map((t: { id: string }) => t.id);
    if (taskIds.length === 0) return [];

    await new Promise(r => setTimeout(r, 15000));

    for (const taskId of taskIds) {
      try {
        const getRes = await fetch(`${DATAFORSEO_API}/serp/google/organic/task_get/advanced/${taskId}`, { headers });
        if (!getRes.ok) continue;
        const items = (await getRes.json()).tasks?.[0]?.result?.[0]?.items || [];
        for (const item of items) {
          if (item.type !== "organic" || !item.url) continue;
          let domain: string;
          try { domain = new URL(item.url).hostname.replace("www.", ""); } catch { continue; }
          if (seen.has(domain)) continue;
          seen.add(domain);
          const da = item.rank_group ? Math.min(Math.round(100 - (item.rank_group / 100)), 100) : 0;
          if (da > 0 && da < 25) continue;
          results.push({ url: item.url, domain, title: item.title || "", domainAuthority: da });
        }
      } catch { /* skip */ }
    }
  } catch (err) { console.log("[ProspectFinder] DataForSEO:", err instanceof Error ? err.message : err); }
  console.log(`[ProspectFinder] DataForSEO: ${results.length} results`);
  return results;
}

async function searchWithDuckDuckGo(niche: string): Promise<SerpResult[]> {
  const n = niche ? `${niche} ` : "";
  const queries = [`${n}"write for us"`, `${n}"guest post" guidelines`, `${n}"submit a guest post"`, `${n}"become a contributor"`];
  const results: SerpResult[] = [];
  const seen = new Set<string>();
  const skip = ["duckduckgo.com","google.com","facebook.com","twitter.com","youtube.com","reddit.com","wikipedia.org"];

  for (const query of queries) {
    try {
      const res = await fetch(`https://html.duckduckgo.com/html/?${new URLSearchParams({ q: query })}`, {
        headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36", Accept: "text/html" },
      });
      if (!res.ok) continue;
      const html = await res.text();
      const linkRegex = /<a[^>]+class="result__a"[^>]+href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi;
      let match;
      while ((match = linkRegex.exec(html)) !== null) {
        let href = match[1];
        const title = match[2].replace(/<[^>]+>/g, "").trim();
        if (href.includes("uddg=")) { try { const u = new URL(href, "https://duckduckgo.com").searchParams.get("uddg"); if (u) href = u; } catch {} }
        href = decodeURIComponent(href);
        if (!href.startsWith("http")) continue;
        let domain: string;
        try { domain = new URL(href).hostname.replace("www.", ""); } catch { continue; }
        if (skip.some(s => domain.includes(s)) || seen.has(domain)) continue;
        seen.add(domain);
        results.push({ url: href, domain, title, domainAuthority: 0 });
      }
      await new Promise(r => setTimeout(r, 1500));
    } catch {}
  }
  return results;
}
