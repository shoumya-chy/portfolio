import fs from "fs";
import path from "path";
import type { OutreachProject, OutreachProspect, OutreachStats, GeneratedGuestPost, OutreachState } from "./types";

const DATA_DIR = path.join(process.cwd(), "data", "outreach");

function ensureDir(dir: string) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function projectDir(projectId: string): string {
  const dir = path.join(DATA_DIR, projectId);
  ensureDir(dir);
  return dir;
}

// ============ Projects ============

export function listProjects(): OutreachProject[] {
  ensureDir(DATA_DIR);
  try {
    const dirs = fs.readdirSync(DATA_DIR, { withFileTypes: true }).filter(d => d.isDirectory());
    const projects: OutreachProject[] = [];
    for (const d of dirs) {
      const p = getProject(d.name);
      if (p) projects.push(p);
    }
    return projects;
  } catch {
    return [];
  }
}

export function getProject(projectId: string): OutreachProject | null {
  const filePath = path.join(projectDir(projectId), "project.json");
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf-8"));
  } catch {
    return null;
  }
}

export function saveProject(project: OutreachProject): void {
  const filePath = path.join(projectDir(project.id), "project.json");
  fs.writeFileSync(filePath, JSON.stringify(project, null, 2), "utf-8");
}

export function deleteProject(projectId: string): void {
  const dir = path.join(DATA_DIR, projectId);
  try {
    fs.rmSync(dir, { recursive: true, force: true });
  } catch { /* ignore */ }
}

// ============ Prospects ============

export function listProspects(projectId: string, stateFilter?: OutreachState): OutreachProspect[] {
  const filePath = path.join(projectDir(projectId), "prospects.json");
  try {
    const all: OutreachProspect[] = JSON.parse(fs.readFileSync(filePath, "utf-8"));
    return stateFilter ? all.filter(p => p.state === stateFilter) : all;
  } catch {
    return [];
  }
}

export function getProspect(projectId: string, prospectId: string): OutreachProspect | null {
  const all = listProspects(projectId);
  return all.find(p => p.id === prospectId) || null;
}

export function saveProspect(prospect: OutreachProspect): void {
  const filePath = path.join(projectDir(prospect.projectId), "prospects.json");
  const all = listProspects(prospect.projectId);
  const idx = all.findIndex(p => p.id === prospect.id);
  if (idx >= 0) all[idx] = prospect;
  else all.push(prospect);
  fs.writeFileSync(filePath, JSON.stringify(all, null, 2), "utf-8");
}

export function saveProspectsBatch(projectId: string, prospects: OutreachProspect[]): void {
  const filePath = path.join(projectDir(projectId), "prospects.json");
  const existing = listProspects(projectId);
  const existingIds = new Set(existing.map(p => p.id));
  const newOnes = prospects.filter(p => !existingIds.has(p.id));
  const merged = [...existing, ...newOnes];
  fs.writeFileSync(filePath, JSON.stringify(merged, null, 2), "utf-8");
}

// ============ Stats ============

export function getStats(projectId: string): OutreachStats {
  const filePath = path.join(projectDir(projectId), "stats.json");
  try {
    const stats = JSON.parse(fs.readFileSync(filePath, "utf-8"));
    // Ensure new fields exist
    if (!stats.todayDate) stats.todayDate = getTodayDate();
    if (stats.emailsSentToday === undefined) stats.emailsSentToday = 0;
    if (stats.pendingWithEmail === undefined) stats.pendingWithEmail = 0;
    return stats;
  } catch {
    return {
      totalFound: 0, emailed: 0, replied: 0, agreed: 0,
      contentSent: 0, rejected: 0, noResponse: 0,
      emailsSentThisWeek: 0, weekStart: getWeekStart(),
      emailsSentToday: 0, todayDate: getTodayDate(),
      pendingWithEmail: 0,
      lastRunAt: new Date().toISOString(),
    };
  }
}

export function saveStats(projectId: string, stats: OutreachStats): void {
  const filePath = path.join(projectDir(projectId), "stats.json");
  fs.writeFileSync(filePath, JSON.stringify(stats, null, 2), "utf-8");
}

export function recalculateStats(projectId: string): OutreachStats {
  const prospects = listProspects(projectId);
  const weekStart = getWeekStart();
  const todayDate = getTodayDate();
  const emailsSentThisWeek = prospects.filter(
    p => p.lastEmailSentAt && p.lastEmailSentAt >= weekStart
  ).length;
  const emailsSentToday = prospects.filter(
    p => p.lastEmailSentAt && p.lastEmailSentAt.startsWith(todayDate)
  ).length;
  const pendingWithEmail = prospects.filter(
    p => p.state === "found" && p.contactEmail
  ).length;

  const oldStats = getStats(projectId);
  const stats: OutreachStats = {
    totalFound: prospects.length,
    emailed: prospects.filter(p => ["emailed", "replied", "agreed", "content_sent"].includes(p.state)).length,
    replied: prospects.filter(p => ["replied", "agreed", "content_sent"].includes(p.state)).length,
    agreed: prospects.filter(p => ["agreed", "content_sent"].includes(p.state)).length,
    contentSent: prospects.filter(p => p.state === "content_sent").length,
    rejected: prospects.filter(p => p.state === "rejected").length,
    noResponse: prospects.filter(p => p.state === "no_response").length,
    emailsSentThisWeek,
    weekStart,
    emailsSentToday,
    todayDate,
    pendingWithEmail,
    lastRunAt: new Date().toISOString(),
    lastDailyRunAt: oldStats.lastDailyRunAt,
  };
  saveStats(projectId, stats);
  return stats;
}

// ============ Generated Content ============

export function saveGeneratedContent(projectId: string, prospectId: string, content: GeneratedGuestPost): void {
  const dir = path.join(projectDir(projectId), "content");
  ensureDir(dir);
  fs.writeFileSync(path.join(dir, `${prospectId}.json`), JSON.stringify(content, null, 2), "utf-8");
}

export function getGeneratedContent(projectId: string, prospectId: string): GeneratedGuestPost | null {
  try {
    const filePath = path.join(projectDir(projectId), "content", `${prospectId}.json`);
    return JSON.parse(fs.readFileSync(filePath, "utf-8"));
  } catch {
    return null;
  }
}

// ============ Backlink Tracking ============

export function getBacklinkLog(projectId: string): Record<string, number> {
  const filePath = path.join(projectDir(projectId), "backlink-log.json");
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf-8"));
  } catch {
    return {};
  }
}

export function logBacklink(projectId: string, url: string): void {
  const log = getBacklinkLog(projectId);
  log[url] = (log[url] || 0) + 1;
  const filePath = path.join(projectDir(projectId), "backlink-log.json");
  ensureDir(path.dirname(filePath));
  fs.writeFileSync(filePath, JSON.stringify(log, null, 2), "utf-8");
}

// ============ Cleanup ============

/**
 * Purge useless prospects from storage:
 * - No email (can never be contacted)
 * - Rejected (said no — don't keep them)
 * - No response after all follow-ups exhausted
 *
 * Returns count of removed prospects.
 */
export function purgeDeadProspects(projectId: string): number {
  const filePath = path.join(projectDir(projectId), "prospects.json");
  const all = listProspects(projectId);
  const before = all.length;

  const kept = all.filter(p => {
    // Remove: no email and never emailed
    if (!p.contactEmail && p.state === "found") return false;
    // Remove: rejected
    if (p.state === "rejected") return false;
    // Keep everything else (emailed, replied, agreed, content_sent, no_response with email)
    return true;
  });

  if (kept.length < before) {
    fs.writeFileSync(filePath, JSON.stringify(kept, null, 2), "utf-8");
  }

  return before - kept.length;
}

/**
 * Remove a single prospect by ID.
 */
export function removeProspect(projectId: string, prospectId: string): boolean {
  const filePath = path.join(projectDir(projectId), "prospects.json");
  const all = listProspects(projectId);
  const filtered = all.filter(p => p.id !== prospectId);
  if (filtered.length === all.length) return false;
  fs.writeFileSync(filePath, JSON.stringify(filtered, null, 2), "utf-8");
  return true;
}

// ============ Helpers ============

function getWeekStart(): string {
  const now = new Date();
  const monday = new Date(now);
  const day = monday.getDay();
  const diff = monday.getDate() - day + (day === 0 ? -6 : 1);
  monday.setDate(diff);
  monday.setHours(0, 0, 0, 0);
  return monday.toISOString();
}

function getTodayDate(): string {
  return new Date().toISOString().split("T")[0]; // "2026-03-25"
}

export { getTodayDate };
