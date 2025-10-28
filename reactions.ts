
import { api } from './client';
export async function getReactions(postId: string){
  return api(`/reactions/${encodeURIComponent(postId)}`);
}
export async function getReactionsWho(postId: string){
  return api(`/reactions/${encodeURIComponent(postId)}?who=1`);
}
export async function toggleReaction(postId: string, emoji: string){
  return api(`/reactions/${encodeURIComponent(postId)}`, { method: 'POST', body: JSON.stringify({ emoji }) });
}
