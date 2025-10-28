
import { api } from './client';
export async function createInvite(uses = 10){
  return api('/invites', { method: 'POST', body: JSON.stringify({ uses }) });
}
