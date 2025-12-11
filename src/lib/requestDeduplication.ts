/**
 * Request Deduplication Utility
 *
 * Prevents duplicate API calls when multiple components request the same data simultaneously.
 * If a request is already in-flight, subsequent calls will receive the same Promise.
 */

const inFlightRequests = new Map<string, Promise<any>>();

/**
 * Deduplicates fetch requests by caching in-flight promises
 *
 * @param key - Unique identifier for the request (e.g., "getUser:12345")
 * @param fetchFn - The function that performs the actual fetch
 * @returns Promise with the fetch result
 *
 * @example
 * const user = await dedupedFetch('getUser:123', () => api.getUser('123'));
 */
export function dedupedFetch<T>(
  key: string,
  fetchFn: () => Promise<T>
): Promise<T> {
  // If there's already a request in-flight for this key, return it
  if (inFlightRequests.has(key)) {
    return inFlightRequests.get(key) as Promise<T>;
  }

  // Create new request and cache it
  const promise = fetchFn()
    .finally(() => {
      // Clean up after the request completes (success or failure)
      inFlightRequests.delete(key);
    });

  inFlightRequests.set(key, promise);
  return promise;
}

/**
 * Clears all in-flight request caches
 * Useful for testing or forcing fresh requests
 */
export function clearInFlightRequests(): void {
  inFlightRequests.clear();
}

/**
 * Gets the number of currently in-flight requests
 * Useful for debugging
 */
export function getInFlightRequestCount(): number {
  return inFlightRequests.size;
}
