
import { api } from './client';

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

export async function getUserPosts(options: GetUserPostsOptions = {}){
  const { handle, userId, limit, offset, cursor } = options;

  // Build pagination query string
  const paginationParams = new URLSearchParams();
  if (limit) paginationParams.append('limit', String(limit));
  if (offset) paginationParams.append('offset', String(offset));
  if (cursor) paginationParams.append('cursor', cursor);
  const paginationQuery = paginationParams.toString();

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

  push('/me/posts');
  push('/me/feed');
  push('/posts/me');
  push('/users/me/posts');
  push('/users/me/feed');

  if (handle) {
    const encodedHandle = encodeURIComponent(handle);
    push(`/u/${encodedHandle}/posts`);
    push(`/u/${encodedHandle}/feed`);
    push(`/users/${encodedHandle}/posts`);
    push(`/users/${encodedHandle}/feed`);
    push(`/profiles/${encodedHandle}/posts`);
    push(`/posts?handle=${encodedHandle}`);
    push(`/posts?user=${encodedHandle}`);
    push(`/feed?handle=${encodedHandle}`);
  }

  if (userId) {
    const encodedUserId = encodeURIComponent(userId);
    push(`/u/${encodedUserId}/posts`);
    push(`/u/${encodedUserId}/feed`);
    push(`/users/${encodedUserId}/posts`);
    push(`/users/${encodedUserId}/feed`);
    push(`/posts?userId=${encodedUserId}`);
    push(`/feed?userId=${encodedUserId}`);
  }

  let lastError: unknown;
  for (const path of attempts) {
    try {
      return await api(path);
    } catch (err: any) {
      lastError = err;
      const message = String(err?.message || '');
      const statusMatch = message.match(/HTTP\s+(\d+)/);
      const statusCode = statusMatch ? parseInt(statusMatch[1], 10) : undefined;
      if (statusCode === 404 || statusCode === 405) {
        console.warn(`User posts endpoint ${path} returned ${statusCode}: ${message}`);
        continue;
      }
      console.warn(`User posts endpoint ${path} failed:`, message || err);
      break;
    }
  }

  if (lastError) {
    throw lastError;
  }

  throw new Error('No user post endpoints responded');
}

export async function createPost(text: string, imageKey?: string){
  return api('/posts', { method: 'POST', body: JSON.stringify({ text, imageKey }) });
}

export async function deletePost(id: string){
  return api(`/posts/${encodeURIComponent(id)}`, { method: 'DELETE' });
}

export async function updatePost(id: string, text: string){
  return api(`/posts/${encodeURIComponent(id)}`, { method: 'PATCH', body: JSON.stringify({ text }) });
}

export async function getPost(id: string){
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

      // If we get a 404, try the next endpoint
      if (statusCode === 404 || statusCode === 405) {
        console.warn(`Post endpoint ${endpoint} returned ${statusCode}, trying next...`);
        continue;
      }

      // For other errors, throw immediately
      console.warn(`Post endpoint ${endpoint} failed:`, message || err);
      break;
    }
  }

  if (lastError) {
    throw lastError;
  }

  throw new Error('No post endpoints responded');
}
