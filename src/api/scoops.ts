import { api } from './client';
import { Scoop, ScoopFeedItem, TextOverlay } from '../types';

export interface CreateScoopParams {
  mediaKey: string;
  mediaType: 'photo' | 'video';
  duration?: number;
  aspectRatio: number;
  textOverlay?: TextOverlay[];
}

/**
 * Get scoops feed from followed users
 */
export async function getScoopsFeed(): Promise<{ items: ScoopFeedItem[] }> {
  return api('/scoops/feed');
}

/**
 * Get a specific user's scoops
 */
export async function getUserScoops(userId: string): Promise<{ scoops: Scoop[] }> {
  const encodedUserId = encodeURIComponent(userId);
  return api(`/scoops/user/${encodedUserId}`);
}

/**
 * Create a new scoop
 */
export async function createScoop(params: CreateScoopParams): Promise<{ id: string }> {
  return api('/scoops', {
    method: 'POST',
    body: JSON.stringify(params),
  });
}

/**
 * Mark a scoop as viewed
 */
export async function markScoopViewed(scoopId: string): Promise<{ viewed: boolean }> {
  const encodedId = encodeURIComponent(scoopId);
  return api(`/scoops/${encodedId}/view`, {
    method: 'POST',
  });
}

/**
 * Delete a scoop (own scoops only)
 */
export async function deleteScoop(scoopId: string): Promise<{ deleted: boolean }> {
  const encodedId = encodeURIComponent(scoopId);
  return api(`/scoops/${encodedId}`, {
    method: 'DELETE',
  });
}
