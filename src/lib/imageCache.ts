import { Image } from 'react-native';

/**
 * In-memory cache for image dimensions to prevent repeated network lookups.
 * This significantly reduces S3 requests for the same image URL.
 */
class ImageDimensionCache {
  private cache: Map<string, { width: number; height: number; aspectRatio: number }> = new Map();
  private maxEntries = 500; // Limit cache size to prevent memory issues

  /**
   * Get cached dimensions for an image URL.
   * Returns null if not cached.
   */
  get(url: string): { width: number; height: number; aspectRatio: number } | null {
    return this.cache.get(url) || null;
  }

  /**
   * Fetch and cache image dimensions.
   * Returns a promise that resolves with dimensions.
   */
  async fetch(url: string): Promise<{ width: number; height: number; aspectRatio: number }> {
    // Check cache first
    const cached = this.get(url);
    if (cached) {
      return cached;
    }

    // Fetch from network
    return new Promise((resolve, reject) => {
      Image.getSize(
        url,
        (width, height) => {
          if (width > 0 && height > 0) {
            const dimensions = { width, height, aspectRatio: width / height };
            this.set(url, dimensions);
            resolve(dimensions);
          } else {
            // Use default aspect ratio for invalid dimensions
            const dimensions = { width: 16, height: 9, aspectRatio: 16 / 9 };
            resolve(dimensions);
          }
        },
        (error) => {
          console.warn('[ImageCache] Failed to get dimensions for', url, error);
          // Use default aspect ratio on error
          const dimensions = { width: 16, height: 9, aspectRatio: 16 / 9 };
          resolve(dimensions);
        }
      );
    });
  }

  /**
   * Store dimensions in cache with LRU eviction.
   * Public method to allow manual caching of known dimensions.
   */
  set(url: string, dimensions: { width: number; height: number; aspectRatio: number }): void {
    // LRU eviction: if cache is full, remove oldest entry
    if (this.cache.size >= this.maxEntries) {
      const firstKey = this.cache.keys().next().value;
      if (firstKey) {
        this.cache.delete(firstKey);
      }
    }

    this.cache.set(url, dimensions);
  }

  /**
   * Clear the entire cache.
   */
  clear(): void {
    this.cache.clear();
  }

  /**
   * Get current cache size.
   */
  size(): number {
    return this.cache.size;
  }
}

// Export singleton instance
export const imageDimensionCache = new ImageDimensionCache();
