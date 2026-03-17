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
 * Finds new "write for us" prospects via Google Custom Search
 */
export async function findNewProspects(
  project: OutreachProject
): Promise<OutreachProspect[]> {
  const cseId = getGoogleCSEId();
  const cseApiKey = getGoogleCSEApiKey();

  console.log(`[ProspectFinder] CSE ID: ${cseId ? "set" : "MISSING"}, API Key: ${cseApiKey ? "set" : "MISSING"}`);
  console.log(`[ProspectFinder] Project niche: "${project.niche}", domain filters: ${JSON.stringify(project.domainFilters)}`);

  if (!cseId || !cseApiKey) {
    throw new Error(
      "Google Custom Search configuration missing. Go to Settings and enter your CSE ID and API Key under Guest Post Outreach."
    );
  }

  // searchWriteForUs(niche, domainFilters, apiKey, engineId)
  const searchResults = await searchWriteForUs(
    project.niche,
    project.domainFilters,
    cseApiKey,
    cseId
  );

  console.log(`[ProspectFinder] Google CSE returned ${searchResults.length} results`);

  if (searchResults.length === 0) {
    console.log(`[ProspectFinder] No search results. Check if your CSE is configured to "Search the entire web" or has relevant sites added.`);
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
