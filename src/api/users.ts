
import { api } from './client';

export async function me(){
  return api('/me');
}

export async function updateMe(payload: { fullName?: string | null }){
  return api('/me', { method: 'PATCH', body: JSON.stringify(payload) });
}

export async function getUser(handle: string){
  return api(`/u/${encodeURIComponent(handle)}`);
}

export async function listFollowers(handle: string){
  return api(`/u/${encodeURIComponent(handle)}/followers`);
}

export async function listFollowing(handle: string){
  return api(`/u/${encodeURIComponent(handle)}/following`);
}
