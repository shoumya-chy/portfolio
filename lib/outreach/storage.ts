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
    return JSON.parse(fs.readFileSync(filePath, "utf-8"));
  } catch {
    return {
      totalFound: 0, emailed: 0, replied: 0, agreed: 0,
      contentSent: 0, rejected: 0, noResponse: 0,
      emailsSentThisWeek: 0, weekStart: getWeekStart(),
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
  const emailsSentThisWeek = prospects.filter(
    p => p.lastEmailSentAt && p.lastEmailSentAt >= weekStart
  ).length;

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
    lastRunAt: new Date().toISOString(),
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
