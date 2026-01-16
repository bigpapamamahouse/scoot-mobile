
import { api } from './client';
import type { User } from '../types';
import { mediaUrlFromKey } from '../lib/media';
import { ENV } from '../lib/env';
import { dedupedFetch } from '../lib/requestDeduplication';

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
  return dedupedFetch('me', async () => {
    const result = await api('/me');

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
  });
}

export async function updateMe(payload: { fullName?: string | null; avatarKey?: string | null; handle?: string | null }){
  const body: Record<string, unknown> = {};

  if ('fullName' in payload) {
    body.fullName = payload.fullName === undefined ? undefined : payload.fullName;
    if (!('full_name' in body)) {
      body.full_name = payload.fullName === undefined ? undefined : payload.fullName;
    }
  }

  if ('handle' in payload) {
    // Send handle in multiple formats for backend compatibility
    body.handle = payload.handle === undefined ? undefined : payload.handle;
    body.username = payload.handle === undefined ? undefined : payload.handle;
    // Also try snake_case versions
    body.user_handle = payload.handle === undefined ? undefined : payload.handle;
    body.user_name = payload.handle === undefined ? undefined : payload.handle;
  }

  // Don't include avatarKey in PATCH /me - use updateAvatar() instead
  if ('avatarKey' in payload && !('fullName' in payload) && !('handle' in payload)) {
    // If only updating avatar, use the dedicated endpoint
    console.warn('[updateMe] avatarKey should be updated via updateAvatar() instead');
  }

  if ('avatarKey' in payload && ('fullName' in payload || 'handle' in payload)) {
    // Legacy support: If updating both, include avatar in PATCH /me
    const details = resolveAvatarDetails(payload.avatarKey);
    const keyValue =
      details.key !== undefined
        ? details.key
        : typeof payload.avatarKey === 'string'
        ? payload.avatarKey
        : null;
    const urlValue =
      details.url !== undefined
        ? details.url
        : typeof keyValue === 'string'
        ? mediaUrlFromKey(keyValue) || keyValue
        : typeof payload.avatarKey === 'string'
        ? payload.avatarKey
        : null;

    const keyTargets = [
      'avatarKey',
      'avatar_key',
      'avatarId',
      'avatar_id',
      'avatarID',
      'photoKey',
      'photo_key',
      'photoId',
      'photo_id',
      'profilePhotoKey',
      'profile_photo_key',
      'profileImageKey',
      'profile_image_key',
      'imageKey',
      'image_key',
      'pictureKey',
      'picture_key',
    ];

    for (const field of keyTargets) {
      if (!(field in body)) {
        body[field] = keyValue ?? null;
      }
    }

    const urlTargets = [
      'avatar',
      'avatarUrl',
      'avatar_url',
      'avatarUri',
      'avatar_uri',
      'photo',
      'photoUrl',
      'photo_url',
      'profilePhoto',
      'profile_photo',
      'profilePhotoUrl',
      'profile_photo_url',
      'profileImage',
      'profile_image',
      'profileImageUrl',
      'profile_image_url',
      'image',
      'imageUrl',
      'image_url',
      'picture',
      'pictureUrl',
      'picture_url',
    ];

    for (const field of urlTargets) {
      if (!(field in body)) {
        body[field] = urlValue ?? keyValue ?? null;
      }
    }
  }

  console.log('[updateMe] Sending PATCH /me with body:', body);
  const result = await api('/me', { method: 'PATCH', body: JSON.stringify(body) });
  console.log('[updateMe] Response:', result);
  return result;
}

export async function updateAvatar(avatarKey: string | null) {
  const body: Record<string, unknown> = {
    key: avatarKey ?? null,
    avatarKey: avatarKey ?? null,
    avatar_key: avatarKey ?? null,
  };

  console.log('[updateAvatar] Sending POST /me/avatar with body:', body);
  const result = await api('/me/avatar', { method: 'POST', body: JSON.stringify(body) });
  console.log('[updateAvatar] Response:', result);
  return result;
}

export async function getUser(handle: string){
  return dedupedFetch(`getUser:${handle}`, async () => {
    const result = await api(`/u/${encodeURIComponent(handle)}`);
    return result;
  });
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
    // Accept user object if it has an id (createdAt is optional)
    // Many API endpoints return user info without createdAt
    if (normalized.id) {
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
  const cacheKey = `getUserByIdentity:${handle || ''}:${userId || ''}`;

  return dedupedFetch(cacheKey, async () => {
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
    const failedAttempts: string[] = [];

    for (const path of attempts) {
      try {
        const payload = await api(path);
        const user = extractUserFromPayload(payload);
        if (user) {
          return user;
        }
        // Only log if we get an unexpected response shape (not a 404)
        console.warn(`User lookup ${path} returned unrecognized shape`, payload);
      } catch (err: any) {
        lastError = err;
        const message = String(err?.message || '');
        const statusMatch = message.match(/HTTP\s+(\d+)/);
        const statusCode = statusMatch ? parseInt(statusMatch[1], 10) : undefined;
        if (statusCode === 404 || statusCode === 405) {
          // Silently track failed attempts - 404s are expected when trying multiple endpoints
          failedAttempts.push(path);
          continue;
        }
        // Only warn for non-404/405 errors (unexpected failures)
        console.warn(`User lookup ${path} failed:`, message || err);
        break;
      }
    }

    // Only log a single warning if all attempts failed with 404s
    if (failedAttempts.length === attempts.length) {
      const identifier = handle || userId || 'unknown';
      console.warn(`User not found: ${identifier} (tried ${failedAttempts.length} endpoints)`);
    }

    if (lastError) {
      throw lastError;
    }

    return null;
  });
}

export async function listFollowers(handle: string){
  return dedupedFetch(`listFollowers:${handle}`, async () => {
    return api(`/u/${encodeURIComponent(handle)}/followers`);
  });
}

export async function listFollowing(handle: string){
  return dedupedFetch(`listFollowing:${handle}`, async () => {
    return api(`/u/${encodeURIComponent(handle)}/following`);
  });
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

// Cache for follower/following data to avoid repeated API calls
let followerCache: {
  followers: Set<string>;
  following: Set<string>;
  timestamp: number;
  currentUserHandle: string | null;
} | null = null;

const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

/**
 * Enhanced search that prioritizes users with mutual follower/following connections
 */
export async function searchUsersWithMutuals(query: string): Promise<User[]> {
  // Get basic search results
  const results = await searchUsers(query);

  if (results.length === 0) {
    return results;
  }

  try {
    // Enrich incomplete user data by fetching full profiles
    const enrichedDataPromises = results.map(async (user) => {
      // Check if user data is incomplete (missing fullName or avatarKey)
      const isIncomplete = !user.fullName || !user.avatarKey;

      if (isIncomplete && user.handle) {
        try {
          // Fetch complete user data
          const fullUserData = await getUser(user.handle);
          // Merge with existing data, preferring the fetched data for missing fields
          return {
            ...user,
            fullName: fullUserData?.fullName || user.fullName,
            avatarKey: fullUserData?.avatarKey || user.avatarKey,
          };
        } catch (error) {
          console.error(`Failed to enrich user data for ${user.handle}:`, error);
          // Return original user data if enrichment fails
          return user;
        }
      }

      return user;
    });

    const fullyEnrichedResults = await Promise.all(enrichedDataPromises);

    // Get current user to fetch their followers/following
    const currentUser = await me();
    const currentUserHandle = currentUser?.handle;

    if (!currentUserHandle) {
      // If we can't get current user, return enriched but unsorted results
      return fullyEnrichedResults;
    }

    // Check if cache is valid
    const now = Date.now();
    const isCacheValid =
      followerCache &&
      followerCache.currentUserHandle === currentUserHandle &&
      (now - followerCache.timestamp) < CACHE_DURATION;

    if (!isCacheValid) {
      // Fetch fresh follower/following data
      const [followersResponse, followingResponse] = await Promise.all([
        listFollowers(currentUserHandle),
        listFollowing(currentUserHandle)
      ]);

      // Extract handles from responses
      const followers = new Set<string>();
      const following = new Set<string>();

      // Handle followers response (could be array or wrapped object)
      const followersList = Array.isArray(followersResponse)
        ? followersResponse
        : followersResponse?.items || followersResponse?.users || [];

      followersList.forEach((user: any) => {
        if (user?.handle) followers.add(user.handle);
      });

      // Handle following response
      const followingList = Array.isArray(followingResponse)
        ? followingResponse
        : followingResponse?.items || followingResponse?.users || [];

      followingList.forEach((user: any) => {
        if (user?.handle) following.add(user.handle);
      });

      // Update cache
      followerCache = {
        followers,
        following,
        timestamp: now,
        currentUserHandle
      };
    }

    // Mark users with mutual connections
    const enrichedResults = fullyEnrichedResults.map(user => {
      const userHandle = user.handle;
      if (!userHandle || !followerCache) {
        return user;
      }

      // Check if this user is in our followers OR following
      const hasMutualConnection =
        followerCache.followers.has(userHandle) ||
        followerCache.following.has(userHandle);

      return {
        ...user,
        hasMutualConnection
      };
    });

    // Sort: mutuals first, then alphabetically by name
    enrichedResults.sort((a, b) => {
      // Prioritize mutual connections
      if (a.hasMutualConnection && !b.hasMutualConnection) return -1;
      if (!a.hasMutualConnection && b.hasMutualConnection) return 1;

      // If both have or don't have mutual connections, sort by name
      const nameA = a.fullName || a.handle || '';
      const nameB = b.fullName || b.handle || '';
      return nameA.localeCompare(nameB);
    });

    return enrichedResults;
  } catch (error) {
    console.error('Error enriching search results with mutuals:', error);
    // On error, return unsorted results
    return results;
  }
}

/**
 * Clear the follower/following cache. Useful when user follows/unfollows someone.
 */
export function clearFollowerCache() {
  followerCache = null;
}

/**
 * Get suggested users based on mutual follows (friends of friends).
 * Returns users followed by people you follow, but that you don't follow yet.
 * Results are randomized but weighted by number of mutual friends.
 */
export async function getSuggestedUsers(): Promise<User[]> {
  try {
    // Get current user
    const currentUser = await me();
    const currentUserHandle = currentUser?.handle;

    if (!currentUserHandle) {
      return [];
    }

    // Get list of people the current user follows
    const followingResponse = await listFollowing(currentUserHandle);
    const myFollowing = Array.isArray(followingResponse)
      ? followingResponse
      : followingResponse?.items || followingResponse?.users || [];

    if (myFollowing.length === 0) {
      return [];
    }

    // Create a Set of handles I already follow for quick lookup
    const myFollowingHandles = new Set<string>();
    myFollowing.forEach((user: any) => {
      if (user?.handle) {
        myFollowingHandles.add(user.handle);
      }
    });

    // Map to track suggested users and count of mutual friends
    const suggestedUsersMap = new Map<string, { user: any; mutualFriendCount: number }>();

    // Fetch who each of my friends follows (friends of friends)
    // Limit to 10 friends and batch requests to avoid overwhelming the API
    const friendsToCheck = myFollowing.slice(0, 10);

    // Helper function to add delay between batches
    const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

    // Process friends in batches of 3 to reduce concurrent load
    const batchSize = 3;
    const allFriendFollowing: Array<{ friendHandle: string; following: any[] }> = [];

    for (let i = 0; i < friendsToCheck.length; i += batchSize) {
      const batch = friendsToCheck.slice(i, i + batchSize);

      const batchPromises = batch.map(async (friend: any) => {
        if (!friend?.handle) return { friendHandle: '', following: [] };

        try {
          const friendFollowingResponse = await listFollowing(friend.handle);
          const friendFollowing = Array.isArray(friendFollowingResponse)
            ? friendFollowingResponse
            : friendFollowingResponse?.items || friendFollowingResponse?.users || [];

          return { friendHandle: friend.handle, following: friendFollowing };
        } catch (error) {
          console.error(`Failed to fetch following for ${friend.handle}:`, error);
          return { friendHandle: friend.handle, following: [] };
        }
      });

      const batchResults = await Promise.all(batchPromises);
      allFriendFollowing.push(...batchResults);

      // Add a small delay between batches to avoid rate limiting
      if (i + batchSize < friendsToCheck.length) {
        await delay(300);
      }
    }

    // Aggregate suggested users from all friends' following lists
    allFriendFollowing.forEach(({ friendHandle, following }) => {
      following.forEach((user: any) => {
        const userHandle = user?.handle;

        // Skip if:
        // - No handle
        // - It's the current user
        // - Already following this user
        if (!userHandle || userHandle === currentUserHandle || myFollowingHandles.has(userHandle)) {
          return;
        }

        // Add or update the suggested user
        if (suggestedUsersMap.has(userHandle)) {
          const existing = suggestedUsersMap.get(userHandle)!;
          existing.mutualFriendCount += 1;
        } else {
          suggestedUsersMap.set(userHandle, {
            user,
            mutualFriendCount: 1
          });
        }
      });
    });

    // Convert map to array
    let suggestedUsers = Array.from(suggestedUsersMap.values());

    if (suggestedUsers.length === 0) {
      return [];
    }

    // Sort by mutual friend count (descending)
    suggestedUsers.sort((a, b) => b.mutualFriendCount - a.mutualFriendCount);

    // Add controlled randomization while maintaining general priority
    // Group users by mutual friend count ranges for weighted random selection
    const highPriority = suggestedUsers.filter(u => u.mutualFriendCount >= 3); // 3+ mutual friends
    const mediumPriority = suggestedUsers.filter(u => u.mutualFriendCount === 2); // 2 mutual friends
    const lowPriority = suggestedUsers.filter(u => u.mutualFriendCount === 1); // 1 mutual friend

    // Shuffle each priority group
    const shuffleArray = <T>(array: T[]): T[] => {
      const shuffled = [...array];
      for (let i = shuffled.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
      }
      return shuffled;
    };

    const shuffledHigh = shuffleArray(highPriority);
    const shuffledMedium = shuffleArray(mediumPriority);
    const shuffledLow = shuffleArray(lowPriority);

    // Combine: high priority first, then medium, then low
    const randomizedSuggestions = [
      ...shuffledHigh,
      ...shuffledMedium,
      ...shuffledLow
    ];

    // Take top 10 suggestions
    const topSuggestions = randomizedSuggestions.slice(0, 10);

    // Enrich user data and add mutualFriendCount
    const enrichedPromises = topSuggestions.map(async ({ user, mutualFriendCount }) => {
      try {
        // Check if user data is incomplete
        const isIncomplete = !user.fullName || !user.avatarKey;

        if (isIncomplete && user.handle) {
          const fullUserData = await getUser(user.handle);
          return {
            ...user,
            fullName: fullUserData?.fullName || user.fullName,
            avatarKey: fullUserData?.avatarKey || user.avatarKey,
            mutualFriendCount
          };
        }

        return {
          ...user,
          mutualFriendCount
        };
      } catch (error) {
        console.error(`Failed to enrich suggested user ${user.handle}:`, error);
        return {
          ...user,
          mutualFriendCount
        };
      }
    });

    const enrichedSuggestions = await Promise.all(enrichedPromises);
    return enrichedSuggestions;

  } catch (error) {
    console.error('Error fetching suggested users:', error);
    return [];
  }
}

/**
 * Search through users that the current user follows for mention autocomplete
 */
export async function searchFollowingForMentions(query: string): Promise<User[]> {
  try {
    // Get current user
    const currentUser = await me();
    const currentUserHandle = currentUser?.handle;

    if (!currentUserHandle) {
      return [];
    }

    // Get following list
    const followingResponse = await listFollowing(currentUserHandle);
    const followingList = Array.isArray(followingResponse)
      ? followingResponse
      : followingResponse?.items || followingResponse?.users || [];

    // Filter by query (case insensitive)
    const normalizedQuery = query.toLowerCase();
    const filtered = followingList.filter((user: any) => {
      const handle = (user.handle || '').toLowerCase();
      const fullName = (user.fullName || '').toLowerCase();
      return handle.includes(normalizedQuery) || fullName.includes(normalizedQuery);
    });

    // Sort by relevance: exact handle match first, then handle starts with, then name match
    filtered.sort((a: any, b: any) => {
      const handleA = (a.handle || '').toLowerCase();
      const handleB = (b.handle || '').toLowerCase();
      const nameA = (a.fullName || '').toLowerCase();
      const nameB = (b.fullName || '').toLowerCase();

      // Exact handle match
      if (handleA === normalizedQuery && handleB !== normalizedQuery) return -1;
      if (handleB === normalizedQuery && handleA !== normalizedQuery) return 1;

      // Handle starts with query
      if (handleA.startsWith(normalizedQuery) && !handleB.startsWith(normalizedQuery)) return -1;
      if (handleB.startsWith(normalizedQuery) && !handleA.startsWith(normalizedQuery)) return 1;

      // Name starts with query
      if (nameA.startsWith(normalizedQuery) && !nameB.startsWith(normalizedQuery)) return -1;
      if (nameB.startsWith(normalizedQuery) && !nameA.startsWith(normalizedQuery)) return 1;

      // Alphabetical by handle
      return handleA.localeCompare(handleB);
    });

    return filtered.slice(0, 10); // Limit to 10 results
  } catch (error) {
    console.error('Error searching following for mentions:', error);
    return [];
  }
}

export async function followUser(handle: string) {
  const requestBody = { handle };

  const result = await api('/follow-request', {
    method: 'POST',
    body: JSON.stringify(requestBody)
  });

  return result;
}

export async function unfollowUser(handle: string) {
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
      const result = await api(attempt.path, {
        method: attempt.method,
        body: attempt.body
      });
      return result;
    } catch (err: any) {
      lastError = err;
      const message = String(err?.message || '');
      if (message.includes('404')) {
        continue;
      }
      // If it's not a 404, throw immediately
      throw err;
    }
  }

  console.error('[API] All unfollow attempts failed:', lastError);
  throw lastError;
}

export async function deleteAccount() {
  console.log('[deleteAccount] Sending DELETE /me request');

  try {
    const result = await api('/me', {
      method: 'DELETE',
    });

    console.log('[deleteAccount] Account deletion successful:', result);
    return result;
  } catch (err: any) {
    console.error('[deleteAccount] Account deletion failed:', err);
    throw err;
  }
}

export interface NotificationPreferences {
  mentions: boolean;
  comments: boolean;
  reactions: boolean;
}

export async function getNotificationPreferences(): Promise<NotificationPreferences> {
  const result = await api('/me/notification-preferences');

  // Ensure we return a valid preferences object with defaults
  return {
    mentions: result?.mentions ?? true,
    comments: result?.comments ?? true,
    reactions: result?.reactions ?? true,
  };
}

export async function updateNotificationPreferences(preferences: Partial<NotificationPreferences>): Promise<NotificationPreferences> {
  const result = await api('/me/notification-preferences', {
    method: 'PATCH',
    body: JSON.stringify(preferences),
  });

  return {
    mentions: result?.mentions ?? true,
    comments: result?.comments ?? true,
    reactions: result?.reactions ?? true,
  };
}

/**
 * Get the user who invited the current user (via invite code used during signup).
 * Returns null if the inviter cannot be determined.
 */
export async function getInviter(): Promise<User | null> {
  try {
    // Try multiple endpoint patterns for getting inviter info
    const attempts = ['/me/inviter', '/me/invited-by', '/me/referrer'];

    for (const path of attempts) {
      try {
        const result = await api(path);
        console.log(`[getInviter] ${path} returned:`, JSON.stringify(result, null, 2));
        const user = extractUserFromPayload(result);
        console.log(`[getInviter] extractUserFromPayload result:`, user);
        if (user) {
          return user;
        }
      } catch (err: any) {
        const message = String(err?.message || '');
        console.log(`[getInviter] ${path} error:`, message);
        if (message.includes('404') || message.includes('405')) {
          continue;
        }
        // For other errors, try the next endpoint
        console.warn(`Inviter lookup ${path} failed:`, message);
        continue;
      }
    }

    // Fallback: Check if /me response includes inviter info
    try {
      const meData = await me();
      const inviterData = (meData as any)?.inviter || (meData as any)?.invitedBy || (meData as any)?.referrer;
      if (inviterData) {
        const user = extractUserFromPayload(inviterData);
        if (user) {
          return user;
        }
      }
    } catch (err) {
      console.warn('Failed to get inviter from /me:', err);
    }

    return null;
  } catch (error) {
    console.error('Error fetching inviter:', error);
    return null;
  }
}

/**
 * Get suggested users for the welcome screen.
 * Returns the inviter (if available) plus some users that the inviter follows.
 * This helps new users start following relevant accounts.
 */
export async function getWelcomeSuggestions(maxCount: number = 5): Promise<User[]> {
  console.log('[getWelcomeSuggestions] Starting...');
  try {
    const suggestions: User[] = [];
    const seenHandles = new Set<string>();

    // Get current user to avoid suggesting self
    const currentUser = await me();
    const currentUserHandle = currentUser?.handle;
    console.log('[getWelcomeSuggestions] Current user handle:', currentUserHandle);
    if (currentUserHandle) {
      seenHandles.add(currentUserHandle);
    }

    // First, try to get the inviter
    const inviter = await getInviter();
    console.log('[getWelcomeSuggestions] Inviter result:', inviter);

    if (inviter && inviter.handle) {
      // Add inviter as first suggestion
      seenHandles.add(inviter.handle);

      // Enrich inviter data if needed
      let enrichedInviter = inviter;
      if (!inviter.fullName || !inviter.avatarKey) {
        try {
          const fullData = await getUser(inviter.handle);
          enrichedInviter = {
            ...inviter,
            fullName: fullData?.fullName || inviter.fullName,
            avatarKey: fullData?.avatarKey || inviter.avatarKey,
          };
        } catch (err) {
          console.warn('Failed to enrich inviter data:', err);
        }
      }

      suggestions.push({
        ...enrichedInviter,
        isInviter: true, // Mark as the inviter for special treatment in UI
      } as User & { isInviter: boolean });

      // Get people the inviter follows
      try {
        const inviterFollowingResponse = await listFollowing(inviter.handle);
        const inviterFollowing = Array.isArray(inviterFollowingResponse)
          ? inviterFollowingResponse
          : inviterFollowingResponse?.items || inviterFollowingResponse?.users || [];

        // Add some of the inviter's following to suggestions
        for (const user of inviterFollowing) {
          if (suggestions.length >= maxCount) break;

          const userHandle = user?.handle;
          if (!userHandle || seenHandles.has(userHandle)) continue;

          seenHandles.add(userHandle);

          // Enrich user data if needed
          let enrichedUser = user;
          if (!user.fullName || !user.avatarKey) {
            try {
              const fullData = await getUser(userHandle);
              enrichedUser = {
                ...user,
                fullName: fullData?.fullName || user.fullName,
                avatarKey: fullData?.avatarKey || user.avatarKey,
              };
            } catch (err) {
              // Use original data if enrichment fails
            }
          }

          suggestions.push(enrichedUser);
        }
      } catch (err) {
        console.warn('Failed to fetch inviter following:', err);
      }
    }

    // If we don't have enough suggestions, fall back to general suggested users
    if (suggestions.length < maxCount) {
      try {
        const generalSuggestions = await getSuggestedUsers();
        for (const user of generalSuggestions) {
          if (suggestions.length >= maxCount) break;

          const userHandle = user?.handle;
          if (!userHandle || seenHandles.has(userHandle)) continue;

          seenHandles.add(userHandle);
          suggestions.push(user);
        }
      } catch (err) {
        console.warn('Failed to fetch general suggestions:', err);
      }
    }

    console.log('[getWelcomeSuggestions] Final suggestions count:', suggestions.length, suggestions);
    return suggestions;
  } catch (error) {
    console.error('Error fetching welcome suggestions:', error);
    return [];
  }
}
