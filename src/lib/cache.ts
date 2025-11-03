/**
 * Cache utility with TTL (Time-To-Live) support
 * Provides in-memory caching for posts, users, and other data
 */

interface CacheEntry<T> {
  data: T;
  timestamp: number;
  ttl: number; // Time to live in milliseconds
}

class CacheManager {
  private cache: Map<string, CacheEntry<any>> = new Map();

  /**
   * Set a value in the cache with a TTL
   * @param key - Unique cache key
   * @param data - Data to cache
   * @param ttl - Time to live in milliseconds (default: 5 minutes)
   */
  set<T>(key: string, data: T, ttl: number = 5 * 60 * 1000): void {
    this.cache.set(key, {
      data,
      timestamp: Date.now(),
      ttl,
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
  feed: 2 * 60 * 1000,        // 2 minutes for feed (frequently updated)
  userPosts: 3 * 60 * 1000,   // 3 minutes for user posts
  userProfile: 5 * 60 * 1000, // 5 minutes for user profiles
  post: 5 * 60 * 1000,        // 5 minutes for individual posts
};
