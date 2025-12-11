
import { api } from './client';
import { dedupedFetch } from '../lib/requestDeduplication';

export async function getReactions(postId: string){
  return dedupedFetch(`getReactions:${postId}`, async () => {
    return api(`/reactions/${encodeURIComponent(postId)}`);
  });
}

export async function getReactionsWho(postId: string){
  return dedupedFetch(`getReactionsWho:${postId}`, async () => {
    return api(`/reactions/${encodeURIComponent(postId)}?who=1`);
  });
}

export async function toggleReaction(postId: string, emoji: string){
  return api(`/reactions/${encodeURIComponent(postId)}`, { method: 'POST', body: JSON.stringify({ emoji }) });
}

/**
 * Throttles concurrent promises to prevent overwhelming the backend.
 * Processes items in chunks with a maximum concurrency limit.
 */
async function throttledMap<T, R>(
  items: T[],
  mapFn: (item: T) => Promise<R>,
  maxConcurrency: number = 5
): Promise<R[]> {
  const results: R[] = [];

  for (let i = 0; i < items.length; i += maxConcurrency) {
    const chunk = items.slice(i, i + maxConcurrency);
    const chunkResults = await Promise.allSettled(chunk.map(mapFn));

    // Extract results or handle rejections
    chunkResults.forEach((result, idx) => {
      if (result.status === 'fulfilled') {
        results.push(result.value);
      } else {
        // For rejected promises, push a default/empty value
        // This will be handled by the caller
        results.push(null as any);
      }
    });
  }

  return results;
}

/**
 * Batches reactions fetching for multiple posts with throttling.
 * Returns a Map of postId -> reactions data.
 *
 * FIXED: Now limits concurrent requests to 5 at a time to prevent
 * overwhelming Lambda with cold starts and causing 503 errors.
 */
export async function getBatchedReactions(postIds: string[]): Promise<Map<string, any>> {
  const uniqueIds = [...new Set(postIds)];

  // Fetch reactions with throttling (max 5 concurrent requests)
  // This prevents the "thundering herd" problem that causes random 503 errors
  const results = await throttledMap(
    uniqueIds,
    (postId) => getReactions(postId),
    5 // Max 5 concurrent requests instead of 20+
  );

  const reactionsMap = new Map<string, any>();

  uniqueIds.forEach((postId, index) => {
    const result = results[index];
    if (result !== null) {
      reactionsMap.set(postId, result);
    } else {
      // On error, store empty array so components don't break
      reactionsMap.set(postId, []);
    }
  });

  return reactionsMap;
}
