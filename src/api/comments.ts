
import { api } from './client';

export async function listComments(postId: string){
  return api(`/comments/${encodeURIComponent(postId)}`);
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
