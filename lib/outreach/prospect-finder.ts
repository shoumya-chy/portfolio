import { searchWriteForUs } from "@/lib/api-clients/google-search-client";
import { extractContactEmail } from "@/lib/api-clients/content-scraper";
import { listProspects, saveProspectsBatch } from "@/lib/outreach/storage";
import type { OutreachProject, OutreachProspect } from "@/lib/outreach/types";
import { getGoogleCSEId, getGoogleCSEApiKey } from "@/lib/config";

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
 * Uses DuckDuckGo scraping (no API key needed) as primary.
 * Falls back to Google CSE if configured.
 */
export async function findNewProspects(
  project: OutreachProject
): Promise<{ prospects: OutreachProspect[]; searchResultCount: number; debug: string[] }> {
  const cseId = getGoogleCSEId();
  const cseApiKey = getGoogleCSEApiKey();
  const debug: string[] = [];

  debug.push(`Niche: "${project.niche || "(multi-niche)"}"`);
  debug.push(`Domain filters: ${project.domainFilters.length > 0 ? project.domainFilters.join(", ") : "(none)"}`);

  if (cseId && cseApiKey) {
    debug.push("Google CSE configured — will try first, then DuckDuckGo");
  } else {
    debug.push("No Google CSE — using DuckDuckGo scraping");
  }

  const searchResults = await searchWriteForUs(
    project.niche,
    project.domainFilters,
    cseId && cseApiKey ? { googleApiKey: cseApiKey, googleEngineId: cseId } : undefined
  );

  debug.push(`Search returned ${searchResults.length} unique sites`);

  if (searchResults.length === 0) {
    return { prospects: [], searchResultCount: 0, debug };
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

  debug.push(`${skippedDuplicate} duplicates skipped`);
  debug.push(`${emailFound} with email, ${emailNotFound} without email`);
  debug.push(`${newProspects.length} new prospects saved`);

  console.log(`[ProspectFinder] ${debug.join(" | ")}`);

  if (newProspects.length > 0) {
    saveProspectsBatch(project.id, newProspects);
  }

  return { prospects: newProspects, searchResultCount: searchResults.length, debug };
}
