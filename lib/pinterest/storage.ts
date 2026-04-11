import fs from "fs";
import path from "path";
import type { PinterestSite, PinnedPost, PinterestJob } from "./types";

const DATA_DIR = path.join(process.cwd(), "data", "pinterest");

function ensureDir(dir: string) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

// ============ Sites ============

function sitesPath(): string {
  ensureDir(DATA_DIR);
  return path.join(DATA_DIR, "sites.json");
}

export function listSites(): PinterestSite[] {
  try {
    return JSON.parse(fs.readFileSync(sitesPath(), "utf-8"));
  } catch {
    return [];
  }
}

export function getSite(siteId: string): PinterestSite | null {
  return listSites().find(s => s.id === siteId) || null;
}

export function saveSite(site: PinterestSite): void {
  const all = listSites();
  const idx = all.findIndex(s => s.id === site.id);
  if (idx >= 0) all[idx] = site;
  else all.push(site);
  fs.writeFileSync(sitesPath(), JSON.stringify(all, null, 2), "utf-8");
}

export function deleteSite(siteId: string): boolean {
  const all = listSites();
  const filtered = all.filter(s => s.id !== siteId);
  if (filtered.length === all.length) return false;
  fs.writeFileSync(sitesPath(), JSON.stringify(filtered, null, 2), "utf-8");
  return true;
}

// ============ Pinned Log ============

function pinnedPath(siteId: string): string {
  const dir = path.join(DATA_DIR, siteId);
  ensureDir(dir);
  return path.join(dir, "pinned_log.json");
}

export function getPinnedLog(siteId: string): PinnedPost[] {
  try {
    return JSON.parse(fs.readFileSync(pinnedPath(siteId), "utf-8"));
  } catch {
    return [];
  }
}

export function addPinnedPost(siteId: string, post: PinnedPost): void {
  const log = getPinnedLog(siteId);
  log.push(post);
  fs.writeFileSync(pinnedPath(siteId), JSON.stringify(log, null, 2), "utf-8");
}

export function isPinned(siteId: string, postUrl: string): boolean {
  const log = getPinnedLog(siteId);
  return log.some(p => p.postUrl === postUrl && p.status === "pinned");
}

// ============ Job Status ============

function jobPath(siteId: string): string {
  const dir = path.join(DATA_DIR, "_jobs");
  ensureDir(dir);
  return path.join(dir, `${siteId}.json`);
}

export function getJob(siteId: string): PinterestJob | null {
  try {
    return JSON.parse(fs.readFileSync(jobPath(siteId), "utf-8"));
  } catch {
    return null;
  }
}

export function isJobRunning(siteId: string): boolean {
  const job = getJob(siteId);
  return job?.status === "running";
}

export function startJob(siteId: string): PinterestJob | null {
  if (isJobRunning(siteId)) return null;
  const job: PinterestJob = {
    jobId: `pin-${Date.now().toString(36)}`,
    siteId,
    status: "running",
    startedAt: new Date().toISOString(),
    message: "Starting Pinterest pipeline...",
    current: 0,
    total: 0,
    log: [],
  };
  fs.writeFileSync(jobPath(siteId), JSON.stringify(job, null, 2), "utf-8");
  return job;
}

export function updateJob(siteId: string, update: Partial<PinterestJob>): void {
  const existing = getJob(siteId);
  if (!existing) return;
  const updated = { ...existing, ...update };
  fs.writeFileSync(jobPath(siteId), JSON.stringify(updated, null, 2), "utf-8");
}

export function logJob(siteId: string, message: string, current?: number, total?: number): void {
  const job = getJob(siteId);
  if (!job) return;
  const log = [...job.log, `[${new Date().toISOString()}] ${message}`];
  if (log.length > 100) log.splice(0, log.length - 100);
  const upd: Partial<PinterestJob> = { log, message };
  if (current !== undefined) upd.current = current;
  if (total !== undefined) upd.total = total;
  updateJob(siteId, upd);
}

export function completeJob(siteId: string, result: PinterestJob["result"], message: string): void {
  updateJob(siteId, { status: "completed", completedAt: new Date().toISOString(), message, result });
}

export function failJob(siteId: string, error: string): void {
  updateJob(siteId, { status: "failed", completedAt: new Date().toISOString(), message: `Failed: ${error}`, error });
}
