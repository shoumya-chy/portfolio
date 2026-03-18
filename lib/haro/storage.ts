import fs from "fs";
import path from "path";
import type { HaroConfig, JournalistQuery, HaroStats, QueryStatus } from "./types";

const DATA_DIR = path.join(process.cwd(), "data", "haro");

function ensureDir(dir: string) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

// ============ Config ============

export function getHaroConfig(): HaroConfig | null {
  ensureDir(DATA_DIR);
  const filePath = path.join(DATA_DIR, "config.json");
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf-8"));
  } catch {
    return null;
  }
}

export function saveHaroConfig(config: HaroConfig): void {
  ensureDir(DATA_DIR);
  const filePath = path.join(DATA_DIR, "config.json");
  fs.writeFileSync(filePath, JSON.stringify(config, null, 2), "utf-8");
}

// ============ Queries ============

export function listQueries(statusFilter?: QueryStatus): JournalistQuery[] {
  ensureDir(DATA_DIR);
  const filePath = path.join(DATA_DIR, "queries.json");
  try {
    const all: JournalistQuery[] = JSON.parse(fs.readFileSync(filePath, "utf-8"));
    return statusFilter ? all.filter((q) => q.status === statusFilter) : all;
  } catch {
    return [];
  }
}

export function getQuery(queryId: string): JournalistQuery | null {
  const all = listQueries();
  return all.find((q) => q.id === queryId) || null;
}

export function saveQuery(query: JournalistQuery): void {
  ensureDir(DATA_DIR);
  const filePath = path.join(DATA_DIR, "queries.json");
  const all = listQueries();
  const idx = all.findIndex((q) => q.id === query.id);
  if (idx >= 0) all[idx] = query;
  else all.push(query);
  fs.writeFileSync(filePath, JSON.stringify(all, null, 2), "utf-8");
}

export function saveQueriesBatch(queries: JournalistQuery[]): void {
  ensureDir(DATA_DIR);
  const filePath = path.join(DATA_DIR, "queries.json");
  const existing = listQueries();
  const existingIds = new Set(existing.map((q) => q.id));
  const newOnes = queries.filter((q) => !existingIds.has(q.id));
  const merged = [...existing, ...newOnes];
  fs.writeFileSync(filePath, JSON.stringify(merged, null, 2), "utf-8");
}

// ============ Seen Message IDs (dedup) ============

function getSeenMessageIds(): Set<string> {
  const filePath = path.join(DATA_DIR, "seen-messages.json");
  try {
    const arr: string[] = JSON.parse(fs.readFileSync(filePath, "utf-8"));
    return new Set(arr);
  } catch {
    return new Set();
  }
}

export function isMessageSeen(messageId: string): boolean {
  return getSeenMessageIds().has(messageId);
}

export function markMessageSeen(messageId: string): void {
  ensureDir(DATA_DIR);
  const seen = getSeenMessageIds();
  seen.add(messageId);
  // Keep only last 5000 message IDs
  const arr = Array.from(seen).slice(-5000);
  const filePath = path.join(DATA_DIR, "seen-messages.json");
  fs.writeFileSync(filePath, JSON.stringify(arr), "utf-8");
}

// ============ Stats ============

export function getHaroStats(): HaroStats {
  const queries = listQueries();
  const today = new Date().toISOString().split("T")[0];

  return {
    totalQueries: queries.length,
    responded: queries.filter((q) => q.status === "responded").length,
    skipped: queries.filter((q) => q.status === "skipped").length,
    failed: queries.filter((q) => q.status === "failed").length,
    todayQueries: queries.filter((q) => q.createdAt.startsWith(today)).length,
    todayResponded: queries.filter((q) => q.status === "responded" && q.responseSentAt?.startsWith(today)).length,
    lastCheckAt: queries.length > 0
      ? queries.sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0].createdAt
      : "",
  };
}
