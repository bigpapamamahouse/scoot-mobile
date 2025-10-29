
import { api } from './client';
import type { User } from '../types';

export async function me(){
  console.log('[API] me() called');
  const result = await api('/me');
  console.log('[API] me() response:', result);
  console.log('[API] me() result.id:', result?.id);
  console.log('[API] me() result.userId:', result?.userId);
  return result;
}

export async function updateMe(payload: { fullName?: string | null }){
  return api('/me', { method: 'PATCH', body: JSON.stringify(payload) });
}

export async function getUser(handle: string){
  console.log('[API] getUser called with handle:', handle);
  const result = await api(`/u/${encodeURIComponent(handle)}`);
  console.log('[API] getUser response:', result);
  return result;
}

export interface UserIdentityOptions {
  handle?: string | null;
  userId?: string | null;
}

const isRecord = (value: unknown): value is Record<string, unknown> => {
  return typeof value === 'object' && value !== null;
};

const isUserLike = (value: unknown): value is User => {
  if (!isRecord(value)) return false;

  // Check for either 'id' or 'userId' field
  const hasId = typeof value.id === 'string' && value.id.trim().length > 0;
  const hasUserId = typeof value.userId === 'string' && value.userId.trim().length > 0;

  return hasId || hasUserId;
};

function extractUserFromPayload(payload: unknown, visited = new Set<unknown>()): User | null {
  if (payload === null || payload === undefined) {
    return null;
  }

  if (visited.has(payload)) {
    return null;
  }

  if (isRecord(payload)) {
    visited.add(payload);
  }

  if (isUserLike(payload)) {
    const record = payload as unknown as Record<string, unknown>;
    // Normalize userId -> id
    const normalized: Partial<User> = { ...(record as Partial<User>) };
    if (!normalized.id && typeof record.userId === 'string') {
      normalized.id = record.userId;
    }
    if (!normalized.createdAt && typeof record.createdAt === 'string') {
      normalized.createdAt = record.createdAt;
    }
    if (normalized.id && normalized.createdAt) {
      return normalized as User;
    }
    return null;
  }

  if (Array.isArray(payload)) {
    for (const entry of payload) {
      const result = extractUserFromPayload(entry, visited);
      if (result) {
        return result;
      }
    }
    return null;
  }

  if (!isRecord(payload)) {
    return null;
  }

  const record = payload as Record<string, unknown>;
  const candidateKeys = [
    'user',
    'profile',
    'account',
    'data',
    'result',
    'item',
  ];

  for (const key of candidateKeys) {
    if (!(key in record)) continue;
    const candidate = record[key];
    const result = extractUserFromPayload(candidate, visited);
    if (result) {
      return result;
    }
  }

  return null;
}

export async function getUserByIdentity(options: UserIdentityOptions = {}): Promise<User | null> {
  const { handle, userId } = options;

  const attempts: string[] = [];
  const seen = new Set<string>();
  const push = (path: string) => {
    if (!seen.has(path)) {
      seen.add(path);
      attempts.push(path);
    }
  };

  if (handle) {
    const normalizedHandle = handle.replace(/^@/, '');
    const encodedHandle = encodeURIComponent(normalizedHandle);
    push(`/u/${encodedHandle}`);
    push(`/users/${encodedHandle}`);
    push(`/profiles/${encodedHandle}`);
    push(`/accounts/${encodedHandle}`);
  }

  if (userId) {
    const encodedUserId = encodeURIComponent(userId);
    push(`/u/${encodedUserId}`);
    push(`/users/${encodedUserId}`);
    push(`/profiles/${encodedUserId}`);
    push(`/accounts/${encodedUserId}`);
  }

  if (!attempts.length) {
    return null;
  }

  let lastError: unknown;
  for (const path of attempts) {
    try {
      console.log('[getUserByIdentity] Trying path:', path);
      const payload = await api(path);
      console.log('[getUserByIdentity] Payload from', path, ':', payload);
      const user = extractUserFromPayload(payload);
      console.log('[getUserByIdentity] Extracted user:', user);
      if (user) {
        console.log('[getUserByIdentity] Success! Returning user with ID:', user.id);
        return user;
      }
      console.warn(`User lookup ${path} returned unrecognized shape`, payload);
    } catch (err: any) {
      lastError = err;
      const message = String(err?.message || '');
      const statusMatch = message.match(/HTTP\s+(\d+)/);
      const statusCode = statusMatch ? parseInt(statusMatch[1], 10) : undefined;
      if (statusCode === 404 || statusCode === 405) {
        console.warn(`User lookup ${path} returned ${statusCode}: ${message}`);
        continue;
      }
      console.warn(`User lookup ${path} failed:`, message || err);
      break;
    }
  }

  if (lastError) {
    throw lastError;
  }

  return null;
}

export async function listFollowers(handle: string){
  return api(`/u/${encodeURIComponent(handle)}/followers`);
}

export async function listFollowing(handle: string){
  return api(`/u/${encodeURIComponent(handle)}/following`);
}

export async function searchUsers(query: string): Promise<User[]> {
  const response = await api(`/search?q=${encodeURIComponent(query)}`);

  // Handle both array responses and wrapped responses
  if (Array.isArray(response)) {
    return response;
  }
  if (response && typeof response === 'object') {
    if ('items' in response && Array.isArray(response.items)) {
      return response.items;
    }
    if ('users' in response && Array.isArray(response.users)) {
      return response.users;
    }
    if ('results' in response && Array.isArray(response.results)) {
      return response.results;
    }
    if ('Items' in response && Array.isArray(response.Items)) {
      return response.Items;
    }
  }

  return [];
}

export async function followUser(handle: string) {
  console.log('[API] followUser called with handle:', handle);
  const requestBody = { handle };
  console.log('[API] followUser request body:', JSON.stringify(requestBody));

  const result = await api('/follow-request', {
    method: 'POST',
    body: JSON.stringify(requestBody)
  });

  console.log('[API] followUser response:', result);
  console.log('[API] followUser response type:', typeof result);
  console.log('[API] followUser response JSON:', JSON.stringify(result, null, 2));
  if (result && typeof result === 'object') {
    console.log('[API] followUser response keys:', Object.keys(result));
  }
  return result;
}

export async function unfollowUser(handle: string) {
  console.log('[API] unfollowUser called with handle:', handle);

  // Try different unfollow endpoint patterns
  const attempts = [
    { method: 'POST', path: '/unfollow', body: JSON.stringify({ handle }) },
    { method: 'DELETE', path: `/follow/${handle}`, body: undefined },
    { method: 'DELETE', path: '/follow', body: JSON.stringify({ handle }) },
    { method: 'POST', path: '/follow/remove', body: JSON.stringify({ handle }) },
  ];

  let lastError: any;
  for (const attempt of attempts) {
    try {
      console.log(`[API] Trying unfollow: ${attempt.method} ${attempt.path}`);
      const result = await api(attempt.path, {
        method: attempt.method,
        body: attempt.body
      });
      console.log('[API] unfollowUser success with:', attempt.path, result);
      return result;
    } catch (err: any) {
      lastError = err;
      const message = String(err?.message || '');
      if (message.includes('404')) {
        console.log(`[API] ${attempt.path} returned 404, trying next...`);
        continue;
      }
      // If it's not a 404, throw immediately
      throw err;
    }
  }

  console.error('[API] All unfollow attempts failed:', lastError);
  throw lastError;
}
