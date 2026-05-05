// Tiny generic LRU with TTL. Used only for very hot, very small data
// (currently just `cat:all`). Correctness must never depend on it: a stale
// LRU entry must be droppable via the pub/sub `cache:invalidate` channel.

interface Entry<V> {
  value: V;
  expiresAt: number;
}

export class TTLCache<V> {
  private readonly map = new Map<string, Entry<V>>();
  constructor(private readonly maxSize: number) {}

  get(key: string): V | undefined {
    const e = this.map.get(key);
    if (!e) return undefined;
    if (e.expiresAt < Date.now()) {
      this.map.delete(key);
      return undefined;
    }
    // Bump recency: re-insert.
    this.map.delete(key);
    this.map.set(key, e);
    return e.value;
  }

  set(key: string, value: V, ttlMs: number): void {
    if (this.map.has(key)) this.map.delete(key);
    this.map.set(key, { value, expiresAt: Date.now() + ttlMs });
    if (this.map.size > this.maxSize) {
      const oldest = this.map.keys().next().value;
      if (oldest !== undefined) this.map.delete(oldest);
    }
  }

  del(key: string): void {
    this.map.delete(key);
  }

  clear(): void {
    this.map.clear();
  }
}
