// ARCHITECTURE.md §9.1. `getStale` is not in that document's interface: §9.2 requires prices to
// serve last known values *past* TTL when upstream fails, and none of the three documented
// methods can return an expired entry — `get` reports a miss and `getOrSet` propagates the
// fetch failure. Recorded in §17.
export interface Cache {
  get<T>(key: string): T | undefined;
  getStale<T>(key: string): T | undefined;
  set<T>(key: string, value: T, ttlMs: number): void;
  getOrSet<T>(key: string, ttlMs: number, fn: () => Promise<T>): Promise<T>;
}

interface Entry {
  value: unknown;
  expiresAt: number;
}

class MemoryCache implements Cache {
  private readonly entries = new Map<string, Entry>();

  // One cache holds values of many shapes, so the map stores `unknown` and the type parameter
  // is the caller's assertion about what it put in. This is the only `as` in the server.
  get<T>(key: string): T | undefined {
    const entry = this.entries.get(key);

    if (entry === undefined || entry.expiresAt <= Date.now()) {
      return undefined;
    }

    return entry.value as T;
  }

  // Ignores expiry deliberately. An expired entry is stale, not absent, and §9.2 prefers
  // honestly-labelled old prices over an empty section.
  getStale<T>(key: string): T | undefined {
    const entry = this.entries.get(key);

    return entry === undefined ? undefined : (entry.value as T);
  }

  set<T>(key: string, value: T, ttlMs: number): void {
    this.entries.set(key, { value, expiresAt: Date.now() + ttlMs });
  }

  async getOrSet<T>(key: string, ttlMs: number, fn: () => Promise<T>): Promise<T> {
    const hit = this.get<T>(key);

    if (hit !== undefined) {
      return hit;
    }

    const value = await fn();
    this.set(key, value, ttlMs);

    return value;
  }
}

// One instance per process, like lib/prisma.ts. §9.1: the cache is per process by design, which
// is why swapping in Redis for a multi-instance deployment is one new file behind this interface.
export const cache: Cache = new MemoryCache();
