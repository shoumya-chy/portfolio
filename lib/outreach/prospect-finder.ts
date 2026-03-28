import { scrapeProspectMetadata } from "@/lib/api-clients/content-scraper";
import { listProspects, saveProspectsBatch } from "@/lib/outreach/storage";
import { getApiKey } from "@/lib/config";
import { getSites } from "@/lib/config";
import type { OutreachProject, OutreachProspect } from "@/lib/outreach/types";

const DATAFORSEO_API = "https://api.dataforseo.com/v3";

function generateProspectId(): string {
  return Date.now().toString(36) + Math.random().toString(36).substring(2, 8);
}

// ============ DOMAIN QUALITY FILTERS ============

/**
 * Known garbage domains — link farms, aggregators, social media, etc.
 * These will NEVER produce a real backlink.
 */
const BLACKLISTED_DOMAINS = new Set([
  // Social media / platforms
  "facebook.com", "twitter.com", "x.com", "linkedin.com", "instagram.com",
  "youtube.com", "tiktok.com", "pinterest.com", "reddit.com", "quora.com",
  "medium.com", "tumblr.com", "wordpress.com", "blogger.com", "blogspot.com",
  "substack.com", "dev.to", "hashnode.com",
  // Search engines
  "google.com", "bing.com", "yahoo.com", "duckduckgo.com", "baidu.com",
  // Reference / wiki
  "wikipedia.org", "wikihow.com",
  // Aggregator sites that list "write for us" pages
  "alltopeverything.com", "listofwriteforus.com", "guestposttracker.com",
  "submitguestpost.com", "guestpostservice.net", "guestblogging.pro",
  "bloggingpro.com",
  // Freelance marketplaces
  "fiverr.com", "upwork.com", "freelancer.com",
  // Too big / won't respond
  "forbes.com", "huffpost.com", "nytimes.com", "bbc.com", "cnn.com",
  "washingtonpost.com", "theguardian.com",
]);

/**
 * Domain name patterns that indicate link farms / PBNs.
 * If the domain contains any of these, it's likely garbage.
 */
const LINK_FARM_PATTERNS = [
  /^guest.*post/i,       // guestpostsite.com, guestpostingnow.com
  /^submit.*guest/i,     // submitguestpost.net
  /^write.*for.*us/i,    // writeforus.org
  /^free.*guest/i,       // freeguestpost.com
  /guest.*blog.*site/i,  // guestbloggingsites.com
  /^best.*guest/i,       // bestguestpostsite.com
  /^post.*guest/i,       // postguestfree.com
  /^blog.*submit/i,      // blogsubmission.com
  /pbn/i,                // anything with "pbn"
  /link.*farm/i,         // linkfarm anything
  /buy.*link/i,          // buylinksnow.com
  /cheap.*guest/i,       // cheapguestpost.com
  /backlink.*service/i,  // backlinkservice.net
];

/**
 * Check if a domain is obviously garbage (link farm, social media, etc.)
 */
function isDomainBlacklisted(domain: string): boolean {
  const lower = domain.toLowerCase();

  // Exact match blacklist
  if (BLACKLISTED_DOMAINS.has(lower)) return true;

  // Subdomain of blacklisted domain (e.g., blog.medium.com)
  for (const bd of BLACKLISTED_DOMAINS) {
    if (lower.endsWith(`.${bd}`)) return true;
  }

  // Link farm name patterns
  const domainBase = lower.replace(/\.(com|net|org|io|co|info|biz|us|uk|in|blog)$/i, "").replace(/[.-]/g, "");
  for (const pattern of LINK_FARM_PATTERNS) {
    if (pattern.test(domainBase)) return true;
  }

  return false;
}

/**
 * Check if a domain is our own site (don't outreach to ourselves).
 */
function isOwnDomain(domain: string, projectSiteUrl: string): boolean {
  if (!projectSiteUrl) return false;
  try {
    const ownDomain = new URL(projectSiteUrl).hostname.replace("www.", "").toLowerCase();
    return domain.toLowerCase() === ownDomain;
  } catch {
    return false;
  }
}

// ============ PROSPECT QUALITY SCORING ============

/**
 * Score a prospect's quality (0-100). Higher = better outreach target.
 *
 * Factors:
 * - Has email (mandatory — if no email, score = 0)
 * - Domain authority (higher is better, but we cap at 80)
 * - Niche was detected (means the scraper found real content)
 * - Guidelines were found (means they actively accept guest posts)
 * - Has categories (means it's a real blog with structure)
 * - Niche relevance to our project
 */
function scoreProspect(
  scrapeData: { contactEmail: string | null; siteNiche: string; guidelinesSnippet: string; categories: string[] },
  domainAuthority: number,
  ourNiche: string
): number {
  // No email = completely useless, don't even save it
  if (!scrapeData.contactEmail) return 0;

  let score = 0;

  // DA scoring (0-30 points)
  if (domainAuthority >= 60) score += 30;
  else if (domainAuthority >= 40) score += 25;
  else if (domainAuthority >= 30) score += 20;
  else if (domainAuthority >= 20) score += 10;
  else if (domainAuthority > 0) score += 5;
  // DA = 0 means unknown (DuckDuckGo), give benefit of doubt
  else score += 12;

  // Niche detected (0-20 points)
  if (scrapeData.siteNiche) score += 15;
  if (scrapeData.categories.length >= 3) score += 5;

  // Guidelines found (0-15 points) — strong signal they accept guest posts
  if (scrapeData.guidelinesSnippet.length > 50) score += 15;
  else if (scrapeData.guidelinesSnippet.length > 0) score += 8;

  // Niche relevance (0-20 points)
  if (ourNiche && scrapeData.siteNiche) {
    const ourWords = new Set(ourNiche.toLowerCase().split(/\s+/).filter(w => w.length > 3));
    const theirWords = scrapeData.siteNiche.toLowerCase().split(/[\s,&]+/).filter(w => w.length > 3);
    const overlap = theirWords.filter(w => ourWords.has(w)).length;

    if (overlap > 0) score += 20;
    // Even partial relevance: broad categories like "business" or "technology" overlap many niches
    else {
      const broadMatch = isNicheBroadlyRelated(ourNiche, scrapeData.siteNiche);
      if (broadMatch) score += 10;
    }
  } else {
    // Unknown niche — give partial credit
    score += 8;
  }

  // Email quality bonus (0-15 points)
  const emailPrefix = (scrapeData.contactEmail || "").split("@")[0].toLowerCase();
  if (["editor", "editorial", "guest", "content", "submissions", "blog"].some(p => emailPrefix.includes(p))) {
    score += 15; // Dedicated editorial email
  } else if (emailPrefix.match(/^[a-z]+(\.[a-z]+)?$/)) {
    score += 10; // Personal email (firstname or firstname.lastname)
  } else {
    score += 5; // Generic but valid
  }

  return Math.min(score, 100);
}

/**
 * Check if two niches are broadly related even if words don't overlap.
 */
function isNicheBroadlyRelated(niche1: string, niche2: string): boolean {
  const RELATED_GROUPS = [
    ["digital marketing", "seo", "content marketing", "marketing", "social media", "advertising"],
    ["technology", "saas", "software", "programming", "ai", "data science", "cybersecurity", "web development"],
    ["business", "entrepreneurship", "startup", "ecommerce", "finance", "management"],
    ["health", "fitness", "wellness", "nutrition", "medical"],
    ["lifestyle", "personal development", "productivity", "self-help"],
    ["education", "learning", "teaching", "courses"],
    ["design", "ux", "ui", "creative", "graphic design"],
  ];

  const n1 = niche1.toLowerCase();
  const n2 = niche2.toLowerCase();

  for (const group of RELATED_GROUPS) {
    const match1 = group.some(g => n1.includes(g));
    const match2 = group.some(g => n2.includes(g));
    if (match1 && match2) return true;
  }
  return false;
}

// ============ MINIMUM QUALITY THRESHOLD ============

/** Minimum quality score to save a prospect. Below this = not worth the storage or email. */
const MIN_QUALITY_SCORE = 25;

// ============ SCRAPE + FILTER ============

/**
 * Scrape a prospect URL with timeout. Returns rich metadata (niche, guidelines, email).
 */
async function safeScrapeProspect(url: string): Promise<{
  contactEmail: string | null;
  siteNiche: string;
  guidelinesSnippet: string;
  siteTitle: string;
  categories: string[];
}> {
  try {
    return await Promise.race([
      scrapeProspectMetadata(url),
      new Promise<{ contactEmail: null; siteNiche: string; guidelinesSnippet: string; siteTitle: string; categories: string[] }>((resolve) =>
        setTimeout(() => resolve({ contactEmail: null, siteNiche: "", guidelinesSnippet: "", siteTitle: "", categories: [] }), 15000)
      ),
    ]);
  } catch {
    return { contactEmail: null, siteNiche: "", guidelinesSnippet: "", siteTitle: "", categories: [] };
  }
}

interface SerpResult { url: string; domain: string; title: string; domainAuthority?: number; }

/**
 * Process a single search result: scrape, score, and build prospect.
 * Returns null if prospect doesn't meet quality standards.
 */
async function processSearchResult(
  result: SerpResult,
  projectId: string,
  projectNiche: string,
  siteUrl: string
): Promise<{ prospect: OutreachProspect; score: number } | null> {
  // Skip blacklisted domains
  if (isDomainBlacklisted(result.domain)) return null;

  // Skip our own domain
  if (isOwnDomain(result.domain, siteUrl)) return null;

  // Scrape the site
  const scrapeData = await safeScrapeProspect(result.url);

  // No email = skip entirely. Don't even save it.
  if (!scrapeData.contactEmail) return null;

  // Score the prospect
  const score = scoreProspect(scrapeData, result.domainAuthority || 0, projectNiche);

  // Below quality threshold = skip
  if (score < MIN_QUALITY_SCORE) return null;

  const prospect: OutreachProspect = {
    id: generateProspectId(),
    projectId,
    targetUrl: result.url,
    targetDomain: result.domain,
    contactEmail: scrapeData.contactEmail,
    writeForUsPage: result.url,
    pageTitle: scrapeData.siteTitle || result.title,
    state: "found",
    createdAt: new Date().toISOString(),
    outboundEmails: [],
    inboundEmails: [],
    domainAuthority: result.domainAuthority || 0,
    siteNiche: scrapeData.siteNiche || projectNiche,
    guidelinesSnippet: scrapeData.guidelinesSnippet || "",
  };

  return { prospect, score };
}

// ============ MAIN FIND FUNCTIONS ============

/**
 * Find guest post opportunities (standard — ~20-50 results per call).
 * Only saves prospects that:
 * - Have a valid contact email
 * - Pass quality scoring (DA, niche relevance, editorial signals)
 * - Are not link farms or blacklisted domains
 */
export async function findNewProspects(
  project: OutreachProject
): Promise<{ prospects: OutreachProspect[]; searchResultCount: number; debug: string[] }> {
  const debug: string[] = [];
  const niche = project.niche || "";
  debug.push(`Niche: "${niche || "(multi-niche)"}"`);

  // Get our site URL for filtering
  const sites = getSites();
  const site = sites.find(s => s.id === project.siteId);
  const siteUrl = site?.url || "";

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

  debug.push(`${searchResults.length} raw search results`);
  if (searchResults.length === 0) return { prospects: [], searchResultCount: 0, debug };

  const existing = listProspects(project.id);
  const existingDomains = new Set(existing.map(p => p.targetDomain));
  const scored: { prospect: OutreachProspect; score: number }[] = [];
  let skippedDupe = 0, skippedBlacklist = 0, skippedNoEmail = 0, skippedLowQuality = 0;

  for (const result of searchResults) {
    if (existingDomains.has(result.domain)) { skippedDupe++; continue; }
    if (isDomainBlacklisted(result.domain)) { skippedBlacklist++; continue; }
    if (isOwnDomain(result.domain, siteUrl)) { skippedBlacklist++; continue; }

    const processed = await processSearchResult(result, project.id, niche, siteUrl);
    if (!processed) {
      skippedNoEmail++;
      continue;
    }
    if (processed.score < MIN_QUALITY_SCORE) {
      skippedLowQuality++;
      continue;
    }

    scored.push(processed);
    existingDomains.add(result.domain);
  }

  // Sort by quality score (best prospects first)
  scored.sort((a, b) => b.score - a.score);
  const newProspects = scored.map(s => s.prospect);

  debug.push(`Quality filter: ${skippedDupe} dupes, ${skippedBlacklist} blacklisted, ${skippedNoEmail} no-email, ${skippedLowQuality} low-quality`);
  debug.push(`${newProspects.length} quality prospects saved (all have email + quality score >= ${MIN_QUALITY_SCORE})`);

  if (newProspects.length > 0) saveProspectsBatch(project.id, newProspects);
  return { prospects: newProspects, searchResultCount: searchResults.length, debug };
}

/**
 * Bulk find: run many keyword variations to find 500+ prospects at once.
 * Same quality standards — only saves prospects with email + good score.
 */
export async function bulkFindProspects(
  project: OutreachProject,
  onProgress?: (msg: string) => void
): Promise<{ total: number; withEmail: number; debug: string[] }> {
  const debug: string[] = [];
  const niche = project.niche || "";
  const dfLogin = getApiKey("dataForSeoLogin");
  const dfPassword = getApiKey("dataForSeoPassword");

  const sites = getSites();
  const site = sites.find(s => s.id === project.siteId);
  const siteUrl = site?.url || "";

  const existing = listProspects(project.id);
  const existingDomains = new Set(existing.map(p => p.targetDomain));
  const allNewProspects: OutreachProspect[] = [];
  let totalSearchResults = 0;
  let totalSkipped = 0;

  // Generate many keyword variations for broad search
  const searchPhrases = generateBulkSearchPhrases(niche);
  debug.push(`Generated ${searchPhrases.length} search queries for niche "${niche}"`);
  onProgress?.(`Starting bulk search with ${searchPhrases.length} queries...`);

  if (dfLogin && dfPassword) {
    debug.push("Using DataForSEO bulk search");

    const BATCH_SIZE = 5;
    for (let i = 0; i < searchPhrases.length; i += BATCH_SIZE) {
      const batch = searchPhrases.slice(i, i + BATCH_SIZE);
      try {
        const results = await searchWithDataForSEOBulk(batch, dfLogin, dfPassword, existingDomains);
        totalSearchResults += results.length;
        onProgress?.(`Batch ${Math.floor(i / BATCH_SIZE) + 1}: ${results.length} raw results (${allNewProspects.length} quality prospects so far)`);

        for (const result of results) {
          if (existingDomains.has(result.domain)) continue;

          const processed = await processSearchResult(result, project.id, niche, siteUrl);
          if (!processed) { totalSkipped++; continue; }

          allNewProspects.push(processed.prospect);
          existingDomains.add(result.domain);
        }

        // Save after each batch to avoid losing progress
        if (allNewProspects.length > 0) {
          saveProspectsBatch(project.id, allNewProspects);
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        debug.push(`Batch ${i / BATCH_SIZE + 1} error: ${msg}`);
      }

      if (i + BATCH_SIZE < searchPhrases.length) {
        await new Promise(r => setTimeout(r, 5000));
      }
    }
  } else {
    debug.push("Using DuckDuckGo bulk search (slower, no DA data)");
    const ddgQueries = searchPhrases.slice(0, 20);

    for (let i = 0; i < ddgQueries.length; i++) {
      try {
        const results = await searchWithDuckDuckGoSingle(ddgQueries[i], existingDomains);
        totalSearchResults += results.length;
        onProgress?.(`Query ${i + 1}/${ddgQueries.length}: ${results.length} raw results`);

        for (const result of results) {
          if (existingDomains.has(result.domain)) continue;

          const processed = await processSearchResult(result, project.id, niche, siteUrl);
          if (!processed) { totalSkipped++; continue; }

          allNewProspects.push(processed.prospect);
          existingDomains.add(result.domain);
        }
      } catch { /* skip */ }

      await new Promise(r => setTimeout(r, 2000));
    }

    if (allNewProspects.length > 0) {
      saveProspectsBatch(project.id, allNewProspects);
    }
  }

  // Sort by quality
  allNewProspects.sort((a, b) => (b.domainAuthority || 0) - (a.domainAuthority || 0));

  debug.push(`Raw results: ${totalSearchResults}. Skipped: ${totalSkipped} (no email / blacklisted / low quality)`);
  debug.push(`Quality prospects saved: ${allNewProspects.length} (all have email)`);
  onProgress?.(`Bulk search complete: ${allNewProspects.length} quality prospects (${totalSkipped} filtered out)`);

  return { total: allNewProspects.length, withEmail: allNewProspects.length, debug };
}

// ============ SEARCH QUERY GENERATION ============

function generateBulkSearchPhrases(niche: string): string[] {
  const n = niche ? `${niche} ` : "";
  const phrases: string[] = [];

  const corePatterns = [
    `"write for us"`, `"guest post guidelines"`, `"submit a guest post"`,
    `"become a contributor"`, `"guest post"`, `"contribute an article"`,
    `"accepting guest posts"`, `"guest author"`, `"guest blogging"`,
    `"write for us" guidelines`, `"submit content"`, `"guest post opportunity"`,
    `"contributor guidelines"`, `"editorial guidelines"`, `"guest writer"`,
    `"we accept guest posts"`, `"guest post submission"`, `"freelance contributor"`,
    `"open to guest posts"`, `"guest posting opportunities"`,
  ];

  for (const pattern of corePatterns) {
    phrases.push(`${n}${pattern}`);
  }

  // URL-based search patterns (using quoted URL slugs instead of Google's inurl: operator)
  const urlPatterns = [
    "write-for-us", "guest-post", "contribute", "submit-guest-post",
    "guest-post-guidelines", "become-a-contributor",
  ];
  for (const pattern of urlPatterns) {
    phrases.push(`${n}"${pattern}"`);
  }

  // Additional query variations
  phrases.push(`${n}site accepting guest posts`);
  phrases.push(`${n}submit article guest blog`);
  phrases.push(`${n}looking for guest writers`);

  if (niche) {
    const nicheWords = niche.split(/\s+/);
    if (nicheWords.length > 1) {
      for (const word of nicheWords) {
        if (word.length > 3) {
          phrases.push(`${word} "write for us"`);
          phrases.push(`${word} "guest post"`);
        }
      }
    }
  }

  return phrases;
}

// ============ DataForSEO Search Functions ============

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

          // Use DataForSEO's rank_info if available, otherwise estimate from position
          const da = item.rank_absolute
            ? estimateDAFromRank(item.rank_absolute)
            : item.rank_group
              ? estimateDAFromRank(item.rank_group)
              : 0;

          results.push({ url: item.url, domain, title: item.title || "", domainAuthority: da });
        }
      } catch { /* skip */ }
    }
  } catch (err) { console.log("[ProspectFinder] DataForSEO:", err instanceof Error ? err.message : err); }
  console.log(`[ProspectFinder] DataForSEO: ${results.length} results`);
  return results;
}

async function searchWithDataForSEOBulk(
  queries: string[], login: string, password: string, skipDomains: Set<string>
): Promise<SerpResult[]> {
  const auth = Buffer.from(`${login}:${password}`).toString("base64");
  const headers = { Authorization: `Basic ${auth}`, "Content-Type": "application/json" };
  const tasks = queries.map(keyword => ({
    keyword, location_code: 2036, language_code: "en", device: "desktop", depth: 50,
  }));

  const results: SerpResult[] = [];
  const seen = new Set<string>(skipDomains);

  const postRes = await fetch(`${DATAFORSEO_API}/serp/google/organic/task_post`, {
    method: "POST", headers, body: JSON.stringify(tasks),
  });
  if (!postRes.ok) return [];
  const postData = await postRes.json();
  const taskIds = (postData.tasks || []).filter((t: { id?: string }) => t.id).map((t: { id: string }) => t.id);
  if (taskIds.length === 0) return [];

  await new Promise(r => setTimeout(r, 20000));

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

        const da = item.rank_absolute
          ? estimateDAFromRank(item.rank_absolute)
          : item.rank_group
            ? estimateDAFromRank(item.rank_group)
            : 0;

        results.push({ url: item.url, domain, title: item.title || "", domainAuthority: da });
      }
    } catch { /* skip */ }
  }

  console.log(`[ProspectFinder] Bulk batch: ${results.length} new results from ${queries.length} queries`);
  return results;
}

/**
 * Estimate domain authority from DataForSEO ranking position.
 *
 * Logic: top-ranking pages for competitive keywords like "write for us"
 * tend to have higher authority. Position 1-5 = likely DA 50+,
 * Position 6-20 = DA 30-50, Position 21-50 = DA 20-40.
 *
 * This is an estimate. Real DA comes from Moz/Ahrefs/DataForSEO backlinks API.
 */
function estimateDAFromRank(rank: number): number {
  if (rank <= 3) return 60;
  if (rank <= 5) return 50;
  if (rank <= 10) return 45;
  if (rank <= 20) return 35;
  if (rank <= 30) return 30;
  if (rank <= 50) return 25;
  return 20;
}

// ============ DuckDuckGo Search Functions ============

async function searchWithDuckDuckGo(niche: string): Promise<SerpResult[]> {
  const n = niche ? `${niche} ` : "";
  const queries = [`${n}"write for us"`, `${n}"guest post" guidelines`, `${n}"submit a guest post"`, `${n}"become a contributor"`];
  const results: SerpResult[] = [];
  const seen = new Set<string>();

  for (const query of queries) {
    const batchResults = await searchWithDuckDuckGoSingle(query, seen);
    results.push(...batchResults);
    await new Promise(r => setTimeout(r, 1500));
  }
  return results;
}

async function searchWithDuckDuckGoSingle(query: string, skipDomains: Set<string>): Promise<SerpResult[]> {
  const results: SerpResult[] = [];

  try {
    const res = await fetch(`https://html.duckduckgo.com/html/?${new URLSearchParams({ q: query })}`, {
      headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36", Accept: "text/html" },
    });
    if (!res.ok) return [];
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
      if (skipDomains.has(domain)) continue;
      skipDomains.add(domain);
      // DuckDuckGo doesn't give DA, so we leave it as 0 (unknown)
      results.push({ url: href, domain, title, domainAuthority: 0 });
    }
  } catch {}

  return results;
}
