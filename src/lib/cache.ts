/**
 * Cache utility with TTL (Time-To-Live) support and LRU eviction
 * Provides in-memory caching for posts, users, and other data
 */

interface CacheEntry<T> {
  data: T;
  timestamp: number;
  ttl: number; // Time to live in milliseconds
  lastAccessed: number; // For LRU tracking
}

class CacheManager {
  private cache: Map<string, CacheEntry<any>> = new Map();
  private maxEntries: number = 200; // Maximum cache entries (prevents memory issues)
  private maxMemoryBytes: number = 50 * 1024 * 1024; // 50MB max cache size

  /**
   * Estimate memory size of data (rough approximation)
   */
  private estimateSize(data: any): number {
    try {
      return JSON.stringify(data).length * 2; // Rough estimate: 2 bytes per char
    } catch {
      return 1000; // Default estimate if stringify fails
    }
  }

  /**
   * Get current total cache size estimate
   */
  private getTotalSize(): number {
    let total = 0;
    for (const entry of this.cache.values()) {
      total += this.estimateSize(entry.data);
    }
    return total;
  }

  /**
   * Evict least recently used entries until cache is within limits
   */
  private evictLRU(): void {
    // Only evict if we're over the max entries limit
    if (this.cache.size <= this.maxEntries) {
      const totalSize = this.getTotalSize();
      // Also check memory limit
      if (totalSize <= this.maxMemoryBytes) {
        return;
      }
    }

    // Sort entries by lastAccessed (oldest first)
    const entries = Array.from(this.cache.entries());
    entries.sort((a, b) => a[1].lastAccessed - b[1].lastAccessed);

    // Remove oldest 20% of entries
    const toRemove = Math.ceil(entries.length * 0.2);
    for (let i = 0; i < toRemove && entries[i]; i++) {
      this.cache.delete(entries[i][0]);
    }

    console.log(`[Cache] LRU eviction: removed ${toRemove} entries, ${this.cache.size} remaining`);
  }

  /**
   * Set a value in the cache with a TTL
   * @param key - Unique cache key
   * @param data - Data to cache
   * @param ttl - Time to live in milliseconds (default: 5 minutes)
   */
  set<T>(key: string, data: T, ttl: number = 5 * 60 * 1000): void {
    // Evict old entries if cache is too large
    if (this.cache.size >= this.maxEntries) {
      this.evictLRU();
    }

    const now = Date.now();
    this.cache.set(key, {
      data,
      timestamp: now,
      ttl,
      lastAccessed: now,
    });
  }

  /**
   * Get a value from the cache
   * @param key - Cache key
   * @returns Cached data or null if not found or expired
   */
  get<T>(key: string): T | null {
    const entry = this.cache.get(key);

    if (!entry) {
      return null;
    }

    const now = Date.now();
    const age = now - entry.timestamp;

    // Check if cache entry has expired
    if (age > entry.ttl) {
      this.cache.delete(key);
      return null;
    }

    // Update last accessed time for LRU tracking
    entry.lastAccessed = now;

    return entry.data as T;
  }

  /**
   * Get stale data from cache (ignores TTL expiration)
   * Useful for stale-while-revalidate pattern where you want to show
   * old data immediately while fetching fresh data in the background
   * @param key - Cache key
   * @returns Cached data or null if not found (regardless of expiration)
   */
  getStale<T>(key: string): T | null {
    const entry = this.cache.get(key);

    if (!entry) {
      return null;
    }

    // Update last accessed time for LRU tracking
    entry.lastAccessed = Date.now();

    return entry.data as T;
  }

  /**
   * Check if a key exists and is not expired
   * @param key - Cache key
   * @returns true if key exists and is valid
   */
  has(key: string): boolean {
    return this.get(key) !== null;
  }

  /**
   * Remove a specific key from cache
   * @param key - Cache key
   */
  invalidate(key: string): void {
    this.cache.delete(key);
  }

  /**
   * Remove all keys matching a pattern
   * @param pattern - Pattern to match (supports wildcards like "posts:*")
   */
  invalidatePattern(pattern: string): void {
    const regex = new RegExp('^' + pattern.replace(/\*/g, '.*') + '$');
    const keysToDelete: string[] = [];

    for (const key of this.cache.keys()) {
      if (regex.test(key)) {
        keysToDelete.push(key);
      }
    }

    keysToDelete.forEach(key => this.cache.delete(key));
  }

  /**
   * Clear all cache entries
   */
  clear(): void {
    this.cache.clear();
  }

  /**
   * Clean up expired entries
   */
  cleanup(): void {
    const now = Date.now();
    const keysToDelete: string[] = [];

    for (const [key, entry] of this.cache.entries()) {
      const age = now - entry.timestamp;
      if (age > entry.ttl) {
        keysToDelete.push(key);
      }
    }

    keysToDelete.forEach(key => this.cache.delete(key));
  }

  /**
   * Get cache statistics
   */
  getStats() {
    return {
      size: this.cache.size,
      keys: Array.from(this.cache.keys()),
    };
  }
}

// Export singleton instance
export const cache = new CacheManager();

// Run cleanup every 5 minutes
setInterval(() => {
  cache.cleanup();
}, 5 * 60 * 1000);

// Cache key generators
export const CacheKeys = {
  feed: (page: number = 0) => `feed:${page}`,
  userPosts: (identifier: string, page: number = 0) => `user-posts:${identifier}:${page}`,
  userProfile: (identifier: string) => `user-profile:${identifier}`,
  post: (id: string) => `post:${id}`,
};

// Default TTL values (in milliseconds)
export const CacheTTL = {
  feed: 2 * 60 * 1000,         // 2 minutes for feed (frequently updated)
  userPosts: 15 * 60 * 1000,   // 15 minutes for user posts
  userProfile: 15 * 60 * 1000, // 15 minutes for user profiles
  post: 5 * 60 * 1000,         // 5 minutes for individual posts
};
