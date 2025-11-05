
import { api } from './client';

export async function getReactions(postId: string){
  return api(`/reactions/${encodeURIComponent(postId)}`);
}

export async function getReactionsWho(postId: string){
  return api(`/reactions/${encodeURIComponent(postId)}?who=1`);
}

export async function toggleReaction(postId: string, emoji: string){
  return api(`/reactions/${encodeURIComponent(postId)}`, { method: 'POST', body: JSON.stringify({ emoji }) });
}

/**
 * Batches reactions fetching for multiple posts in parallel.
 * Returns a Map of postId -> reactions data.
 * This prevents N+1 query problem when loading feeds.
 */
export async function getBatchedReactions(postIds: string[]): Promise<Map<string, any>> {
  const uniqueIds = [...new Set(postIds)];

  // Fetch all reactions in parallel
  const results = await Promise.allSettled(
    uniqueIds.map(postId => getReactions(postId))
  );

  const reactionsMap = new Map<string, any>();

  uniqueIds.forEach((postId, index) => {
    const result = results[index];
    if (result.status === 'fulfilled') {
      reactionsMap.set(postId, result.value);
    } else {
      // On error, store empty array so components don't break
      reactionsMap.set(postId, []);
    }
  });

  return reactionsMap;
}
