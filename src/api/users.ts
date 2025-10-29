
import { api } from './client';
import type { User } from '../types';

export async function me(){
  return api('/me');
}

export async function updateMe(payload: { fullName?: string | null }){
  return api('/me', { method: 'PATCH', body: JSON.stringify(payload) });
}

export async function getUser(handle: string){
  return api(`/u/${encodeURIComponent(handle)}`);
}

export interface UserIdentityOptions {
  handle?: string | null;
  userId?: string | null;
}

const isRecord = (value: unknown): value is Record<string, unknown> => {
  return typeof value === 'object' && value !== null;
};

const isUserLike = (value: unknown): value is User => {
  return (
    isRecord(value) &&
    typeof value.id === 'string' &&
    value.id.trim().length > 0
  );
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
    return payload as User;
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
      const payload = await api(path);
      const user = extractUserFromPayload(payload);
      if (user) {
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

export async function followUser(userId: string) {
  console.log('[API] followUser called with userId:', userId);
  const result = await api('/follow', { method: 'POST', body: JSON.stringify({ userId }) });
  console.log('[API] followUser response:', result);
  return result;
}

export async function unfollowUser(userId: string) {
  console.log('[API] unfollowUser called with userId:', userId);
  const result = await api('/follow', { method: 'DELETE', body: JSON.stringify({ userId }) });
  console.log('[API] unfollowUser response:', result);
  return result;
}
