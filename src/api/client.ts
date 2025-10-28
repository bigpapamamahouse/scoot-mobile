
import { ENV } from '../lib/env';
import { readIdToken } from '../lib/storage';
export async function api(path: string, init: RequestInit = {}){
  const token = await readIdToken();
  const headers = new Headers(init.headers || {});
  headers.set('Content-Type', headers.get('Content-Type') || 'application/json');
  headers.set('X-Ignore-Auth-Redirect', '1');
  if (token) headers.set('Authorization', `Bearer ${token}`);
  const res = await fetch(`${ENV.API_URL}${path}`, { ...init, headers });
  if (!res.ok) {
    const text = await res.text().catch(()=>'');
    throw new Error(`HTTP ${res.status}: ${text}`);
  }
  const ct = res.headers.get('content-type') || '';
  if (ct.includes('application/json')) return res.json();
  return res.text();
}
