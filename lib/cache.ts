interface CacheEntry<T> {
  data: T;
  expiresAt: number;
}

const store = new Map<string, CacheEntry<unknown>>();

const TTL: Record<string, number> = {
  gsc: 24 * 60 * 60 * 1000,
  bing: 24 * 60 * 60 * 1000,
  reddit: 12 * 60 * 60 * 1000,
  analysis: 7 * 24 * 60 * 60 * 1000,
};

// Site-scoped cache key: "gsc:https://knowworldnow.com"
function buildKey(type: string, siteUrl?: string): string {
  return siteUrl ? `${type}:${siteUrl}` : type;
}

function getTTL(type: string): number {
  return TTL[type] || 24 * 60 * 60 * 1000;
}

export function getCache<T>(type: string, siteUrl?: string): T | null {
  const key = buildKey(type, siteUrl);
  const entry = store.get(key) as CacheEntry<T> | undefined;
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    store.delete(key);
    return null;
  }
  return entry.data;
}

export function setCache<T>(type: string, data: T, siteUrl?: string): void {
  const key = buildKey(type, siteUrl);
  store.set(key, {
    data,
    expiresAt: Date.now() + getTTL(type),
  });
}

export function clearCache(type?: string, siteUrl?: string): void {
  if (type) {
    const key = buildKey(type, siteUrl);
    store.delete(key);
  } else {
    store.clear();
  }
}

export function getCacheStatus(): Record<string, { cached: boolean; expiresAt: string | null }> {
  const status: Record<string, { cached: boolean; expiresAt: string | null }> = {};
  for (const [key, entry] of store.entries()) {
    const isValid = Date.now() < entry.expiresAt;
    status[key] = {
      cached: isValid,
      expiresAt: isValid ? new Date(entry.expiresAt).toISOString() : null,
    };
  }
  return status;
}
