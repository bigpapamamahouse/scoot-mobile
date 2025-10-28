
import { api } from './client';

export async function getFeed(){
  return api('/feed');
}

export interface GetUserPostsOptions {
  handle?: string | null;
  userId?: string | null;
}

export async function getUserPosts(options: GetUserPostsOptions = {}){
  const { handle, userId } = options;

  const attempts: string[] = [];
  const seen = new Set<string>();
  const push = (path: string) => {
    if (!seen.has(path)) {
      seen.add(path);
      attempts.push(path);
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
  return api(`/p/${encodeURIComponent(id)}`);
}
