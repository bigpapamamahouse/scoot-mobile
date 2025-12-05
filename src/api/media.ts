
import { ENV } from '../lib/env';

const ABSOLUTE_URI_REGEX = /^(https?:\/\/|data:|blob:)/i;

const encodeKeySafely = (raw: string): string => {
  let sanitized = raw.trim().replace(/^\/+/, '');
  try {
    sanitized = decodeURIComponent(sanitized);
  } catch (error) {
    // Ignore malformed URI sequences and use the original value instead.
  }
  const segments = sanitized
    .split('/')
    .filter(Boolean)
    .map((segment) => encodeURIComponent(segment));
  return segments.join('/');
};

export function mediaUrlFromKey(key?: string | null) {
  if (!key || typeof key !== 'string') {
    return null;
  }

  const trimmed = key.trim();
  if (!trimmed) {
    return null;
  }

  if (ABSOLUTE_URI_REGEX.test(trimmed) || trimmed.startsWith('//')) {
    return trimmed.startsWith('//') ? `https:${trimmed}` : trimmed;
  }

  const base = ENV.MEDIA_BASE.replace(/^https?:\/\//, '');
  const encodedKey = encodeKeySafely(trimmed);
  return `https://${base}/${encodedKey}`;
}
