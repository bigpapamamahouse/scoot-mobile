
import { api } from './client';

export async function listComments(
  postId: string,
  options?: { limit?: number; offset?: number }
){
  const params = new URLSearchParams();
  if (options?.limit !== undefined) {
    params.append('limit', String(options.limit));
  }
  if (options?.offset !== undefined) {
    params.append('offset', String(options.offset));
  }
  const queryString = params.toString();
  const url = `/comments/${encodeURIComponent(postId)}${queryString ? `?${queryString}` : ''}`;
  return api(url);
}

export async function addComment(postId: string, text: string){
  return api(`/comments/${encodeURIComponent(postId)}`, { method: 'POST', body: JSON.stringify({ text }) });
}

export async function updateComment(postId: string, id: string, text: string){
  return api(`/comments/${encodeURIComponent(postId)}`, { method: 'PATCH', body: JSON.stringify({ id, text }) });
}

export async function deleteComment(postId: string, id: string){
  return api(`/comments/${encodeURIComponent(postId)}`, { method: 'DELETE', body: JSON.stringify({ id }) });
}
