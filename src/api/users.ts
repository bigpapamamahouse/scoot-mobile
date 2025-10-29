
import { api } from './client';
import type { User } from '../types';
import { mediaUrlFromKey } from '../lib/media';
import { ENV } from '../lib/env';

const isRecord = (value: unknown): value is Record<string, unknown> => {
  return typeof value === 'object' && value !== null;
};

const trimString = (value: unknown): string | null => {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
};

const ABSOLUTE_URI_REGEX = /^(https?:\/\/|data:|blob:)/i;

type AvatarDetails = {
  key: string | null | undefined;
  url: string | null | undefined;
};

const resolveAvatarDetails = (raw: unknown): AvatarDetails => {
  if (raw === undefined) {
    return { key: undefined, url: undefined };
  }

  const stringValue = trimString(raw);
  if (stringValue === null) {
    return { key: null, url: null };
  }

  if (ABSOLUTE_URI_REGEX.test(stringValue) || stringValue.startsWith('//')) {
    const absolute = stringValue.startsWith('//') ? `https:${stringValue}` : stringValue;
    const base = ENV.MEDIA_BASE.replace(/^https?:\/\//, '');
    const withoutProtocol = absolute.replace(/^https?:\/\//, '');
    let derivedKey: string | null = null;
    if (withoutProtocol.startsWith(`${base}/`)) {
      const remainder = withoutProtocol.slice(base.length + 1);
      derivedKey = decodeURIComponent(remainder);
    }
    return { key: derivedKey ?? stringValue, url: absolute };
  }

  const derivedUrl = mediaUrlFromKey(stringValue) || stringValue;
  return { key: stringValue, url: derivedUrl };
};

const AVATAR_KEYS = [
  'avatarKey',
  'avatar_key',
  'avatar',
  'avatarUrl',
  'avatar_url',
  'avatarURL',
  'photo',
  'photoUrl',
  'photo_url',
  'profilePhoto',
  'profile_photo',
  'profileImage',
  'profile_image',
  'profilePicture',
  'profile_picture',
  'image',
  'imageUrl',
  'image_url',
  'picture',
  'pictureUrl',
  'picture_url',
];

const INVITE_CODE_KEYS = [
  'inviteCode',
  'invite_code',
  'invitecode',
  'inviteToken',
  'invite_token',
  'invite',
  'invitationCode',
  'invitation_code',
  'invitation',
  'code',
  'token',
];

const INVITE_CONTAINER_KEYS = [
  'invite',
  'invitation',
  'invites',
  'data',
  'result',
  'results',
  'item',
  'items',
  'payload',
  'attributes',
  'details',
  'meta',
];

export function findInviteCode(payload: unknown, visited = new Set<unknown>()): string | null {
  const direct = trimString(payload);
  if (direct) {
    return direct;
  }

  if (!payload || typeof payload !== 'object') {
    return null;
  }

  if (visited.has(payload)) {
    return null;
  }
  visited.add(payload);

  if (Array.isArray(payload)) {
    for (const entry of payload) {
      const result = findInviteCode(entry, visited);
      if (result) {
        return result;
      }
    }
    return null;
  }

  const record = payload as Record<string, unknown>;

  for (const key of INVITE_CODE_KEYS) {
    if (!(key in record)) continue;
    const value = record[key];
    if (typeof value === 'object' && value !== null) {
      const nested = findInviteCode(value, visited);
      if (nested) {
        return nested;
      }
      continue;
    }
    const normalized = trimString(value);
    if (normalized) {
      return normalized;
    }
  }

  for (const key of INVITE_CONTAINER_KEYS) {
    if (!(key in record)) continue;
    const nested = findInviteCode(record[key], visited);
    if (nested) {
      return nested;
    }
  }

  return null;
}

const candidateRecords = (
  value: Record<string, unknown>,
  keys: string[]
): Array<Record<string, unknown>> => {
  const records: Array<Record<string, unknown>> = [];
  for (const key of keys) {
    if (key in value) {
      const candidate = value[key];
      if (isRecord(candidate)) {
        records.push(candidate);
      }
    }
  }
  return records;
};

const ensureId = (value: Record<string, unknown>): void => {
  if (trimString(value.id)) {
    return;
  }
  const candidates = [
    trimString(value.userId),
    trimString((value.user as any)?.id),
    trimString((value.profile as any)?.id),
    trimString((value.account as any)?.id),
  ].filter(Boolean);
  if (candidates.length > 0) {
    value.id = candidates[0] as string;
  }
};

const ensureCreatedAt = (value: Record<string, unknown>): void => {
  if (trimString(value.createdAt)) {
    return;
  }
  const candidates = [
    trimString((value.user as any)?.createdAt),
    trimString((value.profile as any)?.createdAt),
    trimString((value.account as any)?.createdAt),
  ].filter(Boolean);
  if (candidates.length > 0) {
    value.createdAt = candidates[0] as string;
  }
};

const ensureFullName = (value: Record<string, unknown>): void => {
  if (trimString(value.fullName)) {
    return;
  }
  const candidates = [
    trimString(value.name),
    trimString((value.user as any)?.fullName),
    trimString((value.profile as any)?.fullName),
    trimString((value.account as any)?.fullName),
    trimString((value.user as any)?.name),
  ].filter(Boolean);
  if (candidates.length > 0) {
    value.fullName = candidates[0] as string;
  }
};

const collectAvatarCandidates = (source: unknown): string[] => {
  if (!isRecord(source)) {
    return [];
  }
  const found: string[] = [];
  for (const key of AVATAR_KEYS) {
    if (!(key in source)) continue;
    const value = trimString(source[key]);
    if (value) {
      found.push(value);
    }
  }
  return found;
};

const applyAvatarDetails = (target: Record<string, unknown>, candidates: string[]): void => {
  let selectedKey: string | null | undefined = undefined;
  let selectedUrl: string | null | undefined = undefined;

  for (const candidate of candidates) {
    const details = resolveAvatarDetails(candidate);
    if (selectedKey === undefined && details.key !== undefined) {
      selectedKey = details.key;
    }
    if (selectedUrl === undefined && details.url !== undefined) {
      selectedUrl = details.url;
    }
    if (selectedKey !== undefined && selectedUrl !== undefined) {
      break;
    }
  }

  if (selectedKey !== undefined) {
    target.avatarKey = selectedKey;
  }
  if (selectedUrl !== undefined) {
    target.avatarUrl = selectedUrl;
  }
};

export async function me(){
  console.log('[API] me() called');
  const result = await api('/me');
  console.log('[API] me() response:', result);
  console.log('[API] me() result.id:', (result as any)?.id);
  console.log('[API] me() result.userId:', (result as any)?.userId);

  if (!isRecord(result)) {
    return result;
  }

  const normalized: Record<string, unknown> = { ...result };
  const stack: Record<string, unknown>[] = [result];
  const seen = new Set<Record<string, unknown>>();
  const allAvatarCandidates: string[] = [];

  while (stack.length) {
    const current = stack.pop()!;
    if (seen.has(current)) {
      continue;
    }
    seen.add(current);
    collectAvatarCandidates(current).forEach((value) => allAvatarCandidates.push(value));
    candidateRecords(current, ['user', 'profile', 'account', 'data', 'attributes', 'result']).forEach((record) => {
      if (!seen.has(record)) {
        stack.push(record);
      }
    });
  }

  if (allAvatarCandidates.length > 0) {
    applyAvatarDetails(normalized, allAvatarCandidates);
  }

  ensureId(normalized);
  ensureCreatedAt(normalized);
  ensureFullName(normalized);

  const inviteCode = findInviteCode(result);
  if (inviteCode) {
    normalized.inviteCode = inviteCode;
  }

  return normalized;
}

export async function updateMe(payload: { fullName?: string | null; avatarKey?: string | null }){
  const body: Record<string, unknown> = {};

  if ('fullName' in payload) {
    body.fullName = payload.fullName === undefined ? undefined : payload.fullName;
    if (!('full_name' in body)) {
      body.full_name = payload.fullName === undefined ? undefined : payload.fullName;
    }
  }

  if ('avatarKey' in payload) {
    const details = resolveAvatarDetails(payload.avatarKey);

    if (!('avatarKey' in body)) {
      body.avatarKey = details.key;
    }
    if (!('avatar_key' in body)) {
      body.avatar_key = details.key;
    }
    if (!('avatar' in body)) {
      body.avatar = details.url ?? details.key ?? null;
    }
    if (!('avatarUrl' in body)) {
      body.avatarUrl = details.url ?? details.key ?? null;
    }
    if (!('avatar_url' in body)) {
      body.avatar_url = details.url ?? details.key ?? null;
    }
    if (!('profilePhoto' in body)) {
      body.profilePhoto = details.url ?? details.key ?? null;
    }
    if (!('profile_photo' in body)) {
      body.profile_photo = details.url ?? details.key ?? null;
    }
  }

  return api('/me', { method: 'PATCH', body: JSON.stringify(body) });
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
