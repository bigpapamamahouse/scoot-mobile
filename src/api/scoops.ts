import { api } from './client';
import { Scoop, ScoopViewer, UserScoops, ScoopTextOverlay, ScoopMediaType } from '../types';

export interface VideoTrimParams {
  startTime: number;
  endTime: number;
}

export interface CreateScoopPayload {
  mediaKey: string;
  mediaType: ScoopMediaType;
  mediaAspectRatio?: number;
  textOverlays?: ScoopTextOverlay[];
  trimParams?: VideoTrimParams;
}

/**
 * Get scoops feed - returns scoops from users the current user follows
 * Scoops are grouped by user and sorted by most recent
 */
export async function getScoopsFeed(): Promise<UserScoops[]> {
  try {
    const response = await api('/scoops/feed');
    return response.items || response || [];
  } catch (error: any) {
    console.warn('[ScoopsAPI] Failed to get scoops feed:', error?.message);
    return [];
  }
}

/**
 * Get the current user's own scoops
 */
export async function getMyScoops(): Promise<Scoop[]> {
  try {
    const response = await api('/scoops/me');
    console.log('[ScoopsAPI] getMyScoops response:', JSON.stringify(response, null, 2));
    return response.items || response || [];
  } catch (error: any) {
    console.warn('[ScoopsAPI] Failed to get my scoops:', error?.message);
    return [];
  }
}

/**
 * Get scoops for a specific user
 */
export async function getUserScoops(userId: string): Promise<Scoop[]> {
  try {
    const response = await api(`/scoops/user/${encodeURIComponent(userId)}`);
    return response.items || response || [];
  } catch (error: any) {
    console.warn('[ScoopsAPI] Failed to get user scoops:', error?.message);
    return [];
  }
}

/**
 * Create a new scoop
 * Uses a longer timeout (60s) to allow for server-side video processing
 */
export async function createScoop(payload: CreateScoopPayload): Promise<Scoop> {
  const response = await api('/scoops', {
    method: 'POST',
    body: JSON.stringify(payload),
    timeoutMs: 60000,
  });
  console.log('[ScoopsAPI] Scoop created successfully:', response);
  return response;
}

/**
 * Delete a scoop
 */
export async function deleteScoop(scoopId: string): Promise<void> {
  await api(`/scoops/${encodeURIComponent(scoopId)}`, {
    method: 'DELETE',
  });
  console.log('[ScoopsAPI] Scoop deleted successfully:', scoopId);
}

/**
 * Mark a scoop as viewed - this is called automatically when viewing a scoop
 */
export async function markScoopViewed(scoopId: string): Promise<void> {
  try {
    await api(`/scoops/${encodeURIComponent(scoopId)}/view`, {
      method: 'POST',
    });
    console.log('[ScoopsAPI] Scoop marked as viewed:', scoopId);
  } catch (error: any) {
    // Non-critical - don't throw, just log
    console.warn('[ScoopsAPI] Failed to mark scoop as viewed:', error?.message);
  }
}

/**
 * Get the list of users who viewed a specific scoop
 * Only the scoop owner can see this
 */
export async function getScoopViewers(scoopId: string): Promise<ScoopViewer[]> {
  try {
    const response = await api(`/scoops/${encodeURIComponent(scoopId)}/viewers`);
    return response.items || response || [];
  } catch (error: any) {
    console.warn('[ScoopsAPI] Failed to get scoop viewers:', error?.message);
    return [];
  }
}

/**
 * Get a single scoop by ID
 */
export async function getScoop(scoopId: string): Promise<Scoop | null> {
  try {
    return await api(`/scoops/${encodeURIComponent(scoopId)}`);
  } catch (error: any) {
    console.warn('[ScoopsAPI] Failed to get scoop:', error?.message);
    return null;
  }
}
