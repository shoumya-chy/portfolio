interface CacheEntry<T> {
  data: T;
  expiresAt: number;
}

const store = new Map<string, CacheEntry<unknown>>();

const TTL = {
  gsc: 24 * 60 * 60 * 1000,       // 24 hours
  bing: 24 * 60 * 60 * 1000,      // 24 hours
  reddit: 12 * 60 * 60 * 1000,    // 12 hours
  analysis: 7 * 24 * 60 * 60 * 1000, // 7 days
};

export type CacheKey = keyof typeof TTL;

export function getCache<T>(key: CacheKey): T | null {
  const entry = store.get(key) as CacheEntry<T> | undefined;
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    store.delete(key);
    return null;
  }
  return entry.data;
}

export function setCache<T>(key: CacheKey, data: T): void {
  store.set(key, {
    data,
    expiresAt: Date.now() + TTL[key],
  });
}

export function clearCache(key?: CacheKey): void {
  if (key) {
    store.delete(key);
  } else {
    store.clear();
  }
}

export function getCacheStatus(): Record<string, { cached: boolean; expiresAt: string | null }> {
  const status: Record<string, { cached: boolean; expiresAt: string | null }> = {};
  for (const key of Object.keys(TTL) as CacheKey[]) {
    const entry = store.get(key);
    const isValid = entry && Date.now() < entry.expiresAt;
    status[key] = {
      cached: !!isValid,
      expiresAt: isValid ? new Date(entry!.expiresAt).toISOString() : null,
    };
  }
  return status;
}
