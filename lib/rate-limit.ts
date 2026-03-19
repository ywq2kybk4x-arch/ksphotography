type Entry = {
  count: number;
  resetAt: number;
};

const store = new Map<string, Entry>();

export function enforceRateLimit(key: string, limit: number, windowSeconds: number): boolean {
  const now = Date.now();
  const existing = store.get(key);
  if (!existing || existing.resetAt < now) {
    store.set(key, { count: 1, resetAt: now + windowSeconds * 1000 });
    return true;
  }

  if (existing.count >= limit) {
    return false;
  }

  existing.count += 1;
  return true;
}

