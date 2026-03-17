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

  if (!cseId || !cseApiKey) {
    throw new Error("Google Custom Search configuration missing");
  }

  // searchWriteForUs(niche, domainFilters, apiKey, engineId)
  const searchResults = await searchWriteForUs(
    project.niche,
    project.domainFilters,
    cseApiKey,
    cseId
  );

  // Get existing prospects for dedup
  const existing = listProspects(project.id);
  const existingDomains = new Set(existing.map((p) => p.targetDomain));

  const newProspects: OutreachProspect[] = [];

  for (const result of searchResults) {
    if (existingDomains.has(result.domain)) continue;

    const contactEmail = await safeExtractEmail(result.url);
    if (!contactEmail) continue;

    const prospect: OutreachProspect = {
      id: generateProspectId(),
      projectId: project.id,
      targetUrl: result.url,
      targetDomain: result.domain,
      contactEmail,
      writeForUsPage: result.url,
      state: "found",
      createdAt: new Date().toISOString(),
      outboundEmails: [],
      inboundEmails: [],
    };

    newProspects.push(prospect);
    existingDomains.add(result.domain);
  }

  if (newProspects.length > 0) {
    saveProspectsBatch(project.id, newProspects);
  }

  return newProspects;
}
