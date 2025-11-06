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

/**
 * Creates a fetch request with a timeout.
 * Aborts the request if it takes longer than the specified timeout.
 */
async function fetchWithTimeout(url: string, init: RequestInit, timeoutMs: number = 10000) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      ...init,
      signal: controller.signal,
    });
    clearTimeout(timeoutId);
    return response;
  } catch (error: any) {
    clearTimeout(timeoutId);
    if (error.name === 'AbortError') {
      throw new Error(`Request timeout after ${timeoutMs}ms`);
    }
    throw error;
  }
}

export async function api(path: string, init: RequestInit = {}) {
  let lastText = '';
  let attempt = 0;
  let token: string | null | undefined;

  const fullUrl = `${ENV.API_URL}${path}`;

  while (attempt < 2) {
    attempt += 1;
    const { headers, token: currentToken } = await buildRequestInit(init);
    token = currentToken;

    // Use 10-second timeout to prevent hanging requests
    const res = await fetchWithTimeout(fullUrl, { ...init, headers }, 10000);

    if (res.ok) {
      const ct = res.headers.get('content-type') || '';
      if (ct.includes('application/json')) {
        const json = await res.json();
        return json;
      }
      const text = await res.text();
      return text;
    }

    lastText = await res.text().catch(() => '');

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
