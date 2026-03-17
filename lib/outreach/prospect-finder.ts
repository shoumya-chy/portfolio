import { searchWriteForUs } from "@/lib/api-clients/google-search-client";
import { extractContactEmail } from "@/lib/api-clients/content-scraper";
import { listProspects, saveProspectsBatch } from "@/lib/outreach/storage";
import type { OutreachProject, OutreachProspect } from "@/lib/outreach/types";
import { getApiKey, getGoogleCSEId, getGoogleCSEApiKey } from "@/lib/config";

function generateProspectId(): string {
  return Date.now().toString(36) + Math.random().toString(36).substring(2, 8);
}

async function safeExtractEmail(url: string): Promise<string | null> {
  try {
    return await Promise.race([
      extractContactEmail(url),
      new Promise<null>((resolve) => setTimeout(() => resolve(null), 10000)),
    ]);
  } catch {
    return null;
  }
}

/**
 * Finds new "write for us" prospects.
 * Uses Bing Web Search API (primary) or Google CSE (fallback).
 */
export async function findNewProspects(
  project: OutreachProject
): Promise<OutreachProspect[]> {
  // Try Bing first (searches the entire web), then fall back to Google CSE
  const bingKey = getApiKey("bing");
  const cseId = getGoogleCSEId();
  const cseApiKey = getGoogleCSEApiKey();

  let searchResults;

  if (bingKey) {
    console.log(`[ProspectFinder] Using Bing Web Search API`);
    console.log(`[ProspectFinder] Project niche: "${project.niche}", domain filters: ${JSON.stringify(project.domainFilters)}`);
    searchResults = await searchWriteForUs(
      project.niche,
      project.domainFilters,
      bingKey,
      "bing"
    );
  } else if (cseId && cseApiKey) {
    console.log(`[ProspectFinder] Using Google CSE (Bing key not configured)`);
    console.log(`[ProspectFinder] Project niche: "${project.niche}", domain filters: ${JSON.stringify(project.domainFilters)}`);
    searchResults = await searchWriteForUs(
      project.niche,
      project.domainFilters,
      cseApiKey,
      "google",
      cseId
    );
  } else {
    throw new Error(
      "No search API configured. Add your Bing API key in Settings, or configure Google CSE ID and API Key under Guest Post Outreach."
    );
  }

  console.log(`[ProspectFinder] Search returned ${searchResults.length} results`);

  if (searchResults.length === 0) {
    return [];
  }

  // Get existing prospects for dedup
  const existing = listProspects(project.id);
  const existingDomains = new Set(existing.map((p) => p.targetDomain));

  const newProspects: OutreachProspect[] = [];
  let skippedDuplicate = 0;
  let emailFound = 0;
  let emailNotFound = 0;

  for (const result of searchResults) {
    if (existingDomains.has(result.domain)) {
      skippedDuplicate++;
      continue;
    }

    // Try to extract email but save prospect either way
    const contactEmail = await safeExtractEmail(result.url);
    if (contactEmail) {
      emailFound++;
    } else {
      emailNotFound++;
    }

    const prospect: OutreachProspect = {
      id: generateProspectId(),
      projectId: project.id,
      targetUrl: result.url,
      targetDomain: result.domain,
      contactEmail: contactEmail || "",
      writeForUsPage: result.url,
      state: "found",
      createdAt: new Date().toISOString(),
      outboundEmails: [],
      inboundEmails: [],
    };

    newProspects.push(prospect);
    existingDomains.add(result.domain);
  }

  console.log(`[ProspectFinder] Results: ${newProspects.length} new, ${skippedDuplicate} duplicates, ${emailFound} with email, ${emailNotFound} without email`);

  if (newProspects.length > 0) {
    saveProspectsBatch(project.id, newProspects);
  }

  return newProspects;
}
