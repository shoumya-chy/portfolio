import fs from "fs";
import path from "path";

const CACHE_DIR = path.join(process.cwd(), "data", "cache");

const TTL: Record<string, number> = {
  gsc: 24 * 60 * 60 * 1000,
  bing: 24 * 60 * 60 * 1000,
  reddit: 12 * 60 * 60 * 1000,
  quora: 12 * 60 * 60 * 1000,
  analysis: 7 * 24 * 60 * 60 * 1000,
  sitemap: 24 * 60 * 60 * 1000,
};

function ensureDir(dir: string) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

// Sanitize siteUrl into a safe folder name
function siteKey(siteUrl: string): string {
  return siteUrl.replace(/https?:\/\//, "").replace(/[^a-zA-Z0-9.-]/g, "_");
}

function buildPath(type: string, siteUrl?: string): string {
  if (siteUrl) {
    const dir = path.join(CACHE_DIR, siteKey(siteUrl));
    ensureDir(dir);
    return path.join(dir, `${type}.json`);
  }
  ensureDir(CACHE_DIR);
  return path.join(CACHE_DIR, `${type}.json`);
}

function getTTL(type: string): number {
  return TTL[type] || 24 * 60 * 60 * 1000;
}

export function getCache<T>(type: string, siteUrl?: string): T | null {
  const filePath = buildPath(type, siteUrl);
  try {
    if (!fs.existsSync(filePath)) return null;
    const raw = fs.readFileSync(filePath, "utf-8");
    const entry = JSON.parse(raw) as { data: T; expiresAt: number };
    if (Date.now() > entry.expiresAt) {
      fs.unlinkSync(filePath);
      return null;
    }
    return entry.data;
  } catch {
    return null;
  }
}

export function setCache<T>(type: string, data: T, siteUrl?: string): void {
  const filePath = buildPath(type, siteUrl);
  const entry = { data, expiresAt: Date.now() + getTTL(type) };
  try {
    fs.writeFileSync(filePath, JSON.stringify(entry), "utf-8");
  } catch {
    // Silent fail
  }
}

// Force read even if expired (for dashboard to show last known data)
export function getCacheRaw<T>(type: string, siteUrl?: string): { data: T; expiresAt: number } | null {
  const filePath = buildPath(type, siteUrl);
  try {
    if (!fs.existsSync(filePath)) return null;
    const raw = fs.readFileSync(filePath, "utf-8");
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function clearCache(type?: string, siteUrl?: string): void {
  if (type) {
    const filePath = buildPath(type, siteUrl);
    try { fs.unlinkSync(filePath); } catch { /* ignore */ }
  } else {
    try { fs.rmSync(CACHE_DIR, { recursive: true, force: true }); } catch { /* ignore */ }
  }
}

export function getCacheStatus(): Record<string, { cached: boolean; expiresAt: string | null; expired: boolean }> {
  const status: Record<string, { cached: boolean; expiresAt: string | null; expired: boolean }> = {};
  try {
    const entries = fs.readdirSync(CACHE_DIR, { recursive: true }) as string[];
    for (const entry of entries) {
      if (!entry.endsWith(".json")) continue;
      const filePath = path.join(CACHE_DIR, entry);
      try {
        const raw = JSON.parse(fs.readFileSync(filePath, "utf-8"));
        const isValid = Date.now() < raw.expiresAt;
        status[entry.replace(".json", "")] = {
          cached: true,
          expiresAt: new Date(raw.expiresAt).toISOString(),
          expired: !isValid,
        };
      } catch { /* skip */ }
    }
  } catch { /* empty */ }
  return status;
}
