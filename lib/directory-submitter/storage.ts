import fs from "fs";
import path from "path";
import type {
  SiteToSubmit,
  SubmissionRecord,
  SubmissionJob,
  DirectorySubmitterStats,
} from "./types";
import directories from "./directories";

const DATA_DIR = path.join(process.cwd(), "data", "directory-submitter");

function ensureDir(dir: string) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

// ============ Sites ============

function sitesFile(): string {
  ensureDir(DATA_DIR);
  return path.join(DATA_DIR, "sites.json");
}

export function listSites(): SiteToSubmit[] {
  try {
    return JSON.parse(fs.readFileSync(sitesFile(), "utf-8"));
  } catch {
    return [];
  }
}

export function getSite(siteId: string): SiteToSubmit | null {
  return listSites().find((s) => s.id === siteId) || null;
}

export function saveSite(site: SiteToSubmit): void {
  const all = listSites();
  const idx = all.findIndex((s) => s.id === site.id);
  if (idx >= 0) all[idx] = site;
  else all.push(site);
  fs.writeFileSync(sitesFile(), JSON.stringify(all, null, 2), "utf-8");
}

export function deleteSite(siteId: string): boolean {
  const all = listSites();
  const filtered = all.filter((s) => s.id !== siteId);
  if (filtered.length === all.length) return false;
  fs.writeFileSync(sitesFile(), JSON.stringify(filtered, null, 2), "utf-8");
  // Also remove submissions for this site
  const subFile = submissionsFile();
  try {
    const subs: SubmissionRecord[] = JSON.parse(fs.readFileSync(subFile, "utf-8"));
    const kept = subs.filter((s) => s.siteId !== siteId);
    fs.writeFileSync(subFile, JSON.stringify(kept, null, 2), "utf-8");
  } catch { /* no submissions file yet */ }
  return true;
}

// ============ Submissions ============

function submissionsFile(): string {
  ensureDir(DATA_DIR);
  return path.join(DATA_DIR, "submissions.json");
}

export function listSubmissions(siteId?: string): SubmissionRecord[] {
  try {
    const all: SubmissionRecord[] = JSON.parse(fs.readFileSync(submissionsFile(), "utf-8"));
    return siteId ? all.filter((s) => s.siteId === siteId) : all;
  } catch {
    return [];
  }
}

export function getSubmission(submissionId: string): SubmissionRecord | null {
  return listSubmissions().find((s) => s.id === submissionId) || null;
}

export function saveSubmission(record: SubmissionRecord): void {
  const all = listSubmissions();
  const idx = all.findIndex((s) => s.id === record.id);
  if (idx >= 0) all[idx] = record;
  else all.push(record);
  fs.writeFileSync(submissionsFile(), JSON.stringify(all, null, 2), "utf-8");
}

export function saveSubmissionsBatch(records: SubmissionRecord[]): void {
  const existing = listSubmissions();
  const existingIds = new Set(existing.map((s) => s.id));
  for (const r of records) {
    if (existingIds.has(r.id)) {
      const idx = existing.findIndex((s) => s.id === r.id);
      existing[idx] = r;
    } else {
      existing.push(r);
    }
  }
  fs.writeFileSync(submissionsFile(), JSON.stringify(existing, null, 2), "utf-8");
}

// ============ Job State ============

function jobFile(): string {
  ensureDir(DATA_DIR);
  return path.join(DATA_DIR, "current-job.json");
}

export function getJob(): SubmissionJob | null {
  try {
    return JSON.parse(fs.readFileSync(jobFile(), "utf-8"));
  } catch {
    return null;
  }
}

export function saveJob(job: SubmissionJob): void {
  fs.writeFileSync(jobFile(), JSON.stringify(job, null, 2), "utf-8");
}

export function clearJob(): void {
  try {
    fs.unlinkSync(jobFile());
  } catch { /* ignore */ }
}

// ============ Stats ============

export function getStats(siteId?: string): DirectorySubmitterStats {
  const sites = listSites();
  const subs = listSubmissions(siteId);

  return {
    totalSites: sites.length,
    totalDirectories: directories.length,
    totalSubmissions: subs.length,
    submitted: subs.filter((s) => s.status === "submitted").length,
    confirmed: subs.filter((s) => s.status === "confirmed").length,
    failed: subs.filter((s) => s.status === "failed").length,
    pending: subs.filter((s) => s.status === "pending").length,
    skipped: subs.filter((s) => s.status === "skipped").length,
    lastSubmissionAt: subs
      .filter((s) => s.attemptedAt)
      .sort((a, b) => (b.attemptedAt! > a.attemptedAt! ? 1 : -1))[0]?.attemptedAt,
  };
}
