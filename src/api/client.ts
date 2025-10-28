import { fetchAuthSession } from 'aws-amplify/auth';
import { ENV } from '../lib/env';
import { readIdToken, writeIdToken } from '../lib/storage';

async function buildRequestInit(init: RequestInit = {}) {
  const token = await readIdToken();
  const headers = new Headers(init.headers || {});
  const body = init.body as unknown;
  if (!headers.has('Content-Type') && typeof body === 'string') {
    headers.set('Content-Type', 'application/json');
  }
  if (!headers.has('Accept')) {
    headers.set('Accept', 'application/json');
  }
  headers.set('X-Ignore-Auth-Redirect', '1');
  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }
  return { headers, token };
}

async function refreshSession(previousToken?: string | null) {
  try {
    const session = await fetchAuthSession();
    const nextToken = session.tokens?.idToken?.toString();
    if (nextToken && nextToken !== previousToken) {
      await writeIdToken(nextToken);
      return nextToken;
    }
  } catch (err) {
    console.warn('Failed to refresh auth session', err);
  }
  return null;
}

export async function api(path: string, init: RequestInit = {}) {
  let lastText = '';
  let attempt = 0;
  let token: string | null | undefined;

  const fullUrl = `${ENV.API_URL}${path}`;
  console.log(`[API Client] Fetching: ${fullUrl}`);
  console.log(`[API Client] Method: ${init.method || 'GET'}`);

  while (attempt < 2) {
    attempt += 1;
    const { headers, token: currentToken } = await buildRequestInit(init);
    token = currentToken;
    const res = await fetch(fullUrl, { ...init, headers });

    console.log(`[API Client] Response status: ${res.status}`);

    if (res.ok) {
      const ct = res.headers.get('content-type') || '';
      if (ct.includes('application/json')) return res.json();
      return res.text();
    }

    lastText = await res.text().catch(() => '');
    console.log(`[API Client] Error response: ${lastText}`);

    if (res.status === 401 && attempt === 1) {
      const refreshed = await refreshSession(token);
      if (refreshed) {
        continue;
      }
    }

    throw new Error(`HTTP ${res.status}: ${lastText}`);
  }

  throw new Error(`HTTP 401: ${lastText}`);
}
