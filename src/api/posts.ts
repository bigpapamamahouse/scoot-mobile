
import { api } from './client';
import { dedupedFetch } from '../lib/requestDeduplication';

export interface PaginationOptions {
  limit?: number;
  offset?: number;
  cursor?: string;
}

export async function getFeed(options?: PaginationOptions){
  const params = new URLSearchParams();

  if (options?.limit) {
    params.append('limit', String(options.limit));
  }
  if (options?.offset) {
    params.append('offset', String(options.offset));
  }
  if (options?.cursor) {
    params.append('cursor', options.cursor);
  }

  const queryString = params.toString();
  const path = queryString ? `/feed?${queryString}` : '/feed';

  return api(path);
}

export interface GetUserPostsOptions {
  handle?: string | null;
  userId?: string | null;
  limit?: number;
  offset?: number;
  cursor?: string;
}

// Cache successful endpoint patterns to avoid repeated discovery
const endpointCache: Map<string, string> = new Map();

export async function getUserPosts(options: GetUserPostsOptions = {}){
  const { handle, userId, limit, offset, cursor } = options;

  // Build pagination query string
  const paginationParams = new URLSearchParams();
  if (limit) paginationParams.append('limit', String(limit));
  if (offset) paginationParams.append('offset', String(offset));
  if (cursor) paginationParams.append('cursor', cursor);
  const paginationQuery = paginationParams.toString();

  // Try cached endpoint first
  const cacheKey = handle || userId || 'me';
  const cachedEndpoint = endpointCache.get(cacheKey);
  if (cachedEndpoint) {
    try {
      const fullPath = paginationQuery
        ? `${cachedEndpoint}${cachedEndpoint.includes('?') ? '&' : '?'}${paginationQuery}`
        : cachedEndpoint;
      const result = await api(fullPath);
      // Cache hit! Return immediately
      return result;
    } catch (err: any) {
      // Cache miss or endpoint changed, fall through to discovery
      const message = String(err?.message || '');
      const statusMatch = message.match(/HTTP\s+(\d+)/);
      const statusCode = statusMatch ? parseInt(statusMatch[1], 10) : undefined;
      // Only invalidate cache for 404/405 (endpoint no longer exists)
      if (statusCode === 404 || statusCode === 405) {
        endpointCache.delete(cacheKey);
      } else {
        // For other errors (500, network issues), throw immediately
        throw err;
      }
    }
  }

  const attempts: string[] = [];
  const seen = new Set<string>();
  const push = (path: string) => {
    if (!seen.has(path)) {
      seen.add(path);
      // Add pagination params to each attempt
      if (paginationQuery) {
        const separator = path.includes('?') ? '&' : '?';
        attempts.push(`${path}${separator}${paginationQuery}`);
      } else {
        attempts.push(path);
      }
    }
  };

  // Only try POSTS endpoints, not FEED endpoints (feed returns all followed users' posts)
  push('/me/posts');
  push('/posts/me');
  push('/users/me/posts');

  if (handle) {
    const encodedHandle = encodeURIComponent(handle);
    push(`/u/${encodedHandle}/posts`);
    push(`/u/${encodedHandle}`); // Profile endpoint that includes posts
    push(`/users/${encodedHandle}/posts`);
    push(`/profiles/${encodedHandle}/posts`);
    push(`/posts?handle=${encodedHandle}`);
    push(`/posts?user=${encodedHandle}`);
  }

  if (userId) {
    const encodedUserId = encodeURIComponent(userId);
    push(`/u/${encodedUserId}/posts`);
    push(`/u/${encodedUserId}`); // Profile endpoint that includes posts
    push(`/users/${encodedUserId}/posts`);
    push(`/posts?userId=${encodedUserId}`);
  }

  let lastError: unknown;
  for (const path of attempts) {
    try {
      const result = await api(path);
      // Success! Cache this endpoint pattern for future requests
      // Extract the base path without pagination params
      const basePath = path.split('?')[0];
      const basePattern = basePath
        .replace(/\/[^/]+$/, (match) => {
          // If the last segment looks like a specific value, keep it as pattern
          if (handle && match.includes(handle)) return `/:handle`;
          if (userId && match.includes(userId)) return `/:userId`;
          return match;
        });
      endpointCache.set(cacheKey, basePath); // Cache the actual working path
      console.log(`[API] Cached endpoint for ${cacheKey}: ${basePath}`);
      return result;
    } catch (err: any) {
      lastError = err;
      const message = String(err?.message || '');
      const statusMatch = message.match(/HTTP\s+(\d+)/);
      const statusCode = statusMatch ? parseInt(statusMatch[1], 10) : undefined;
      // Silently try next endpoint if we get 404/405 (expected during endpoint discovery)
      if (statusCode === 404 || statusCode === 405) {
        continue;
      }
      // For other errors, stop trying and throw
      break;
    }
  }

  if (lastError) {
    throw lastError;
  }

  throw new Error('No user post endpoints responded');
}

export async function createPost(text: string, imageKey?: string, imageAspectRatio?: number){
  return api('/posts', { method: 'POST', body: JSON.stringify({ text, imageKey, imageAspectRatio }) });
}

export async function deletePost(id: string){
  return api(`/posts/${encodeURIComponent(id)}`, { method: 'DELETE' });
}

export async function updatePost(id: string, text: string){
  return api(`/posts/${encodeURIComponent(id)}`, { method: 'PATCH', body: JSON.stringify({ text }) });
}

export async function getPost(id: string){
  return dedupedFetch(`getPost:${id}`, async () => {
    const encodedId = encodeURIComponent(id);

    // Try multiple endpoint patterns
    const endpoints = [
      `/p/${encodedId}`,
      `/posts/${encodedId}`,
      `/post/${encodedId}`,
    ];

    let lastError: unknown;
    for (const endpoint of endpoints) {
      try {
        return await api(endpoint);
      } catch (err: any) {
        lastError = err;
        const message = String(err?.message || '');
        const statusMatch = message.match(/HTTP\s+(\d+)/);
        const statusCode = statusMatch ? parseInt(statusMatch[1], 10) : undefined;

        // Silently try next endpoint if we get 404/405 (expected during endpoint discovery)
        if (statusCode === 404 || statusCode === 405) {
          continue;
        }

        // For other errors, stop trying and throw
        break;
      }
    }

    if (lastError) {
      throw lastError;
    }

    throw new Error('No post endpoints responded');
  });
}
