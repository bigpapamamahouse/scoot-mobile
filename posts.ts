
import { api } from './client';

export async function getFeed(){
  return api('/feed');
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
