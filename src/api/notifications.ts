
import { api } from './client';
export async function listNotifications(markRead = false){
  const q = markRead ? '?markRead=1' : '';
  return api(`/notifications${q}`);
}
export async function acceptFollow(fromUserId: string){
  return api('/follow-accept', { method: 'POST', body: JSON.stringify({ fromUserId }) });
}
export async function declineFollow(fromUserId: string){
  return api('/follow-decline', { method: 'POST', body: JSON.stringify({ fromUserId }) });
}
