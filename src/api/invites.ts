
import { api } from './client';

export async function listInvites(){
  return api('/invites');
}

export async function createInvite(uses = 10){
  return api('/invites', { method: 'POST', body: JSON.stringify({ uses }) });
}
