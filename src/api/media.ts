
import { ENV } from '../lib/env';
import { api } from './client';

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

/**
 * Delete an uploaded media file from S3
 * @param key The S3 key of the media to delete
 */
export async function deleteMedia(key: string): Promise<void> {
  if (!key || typeof key !== 'string') {
    throw new Error('Invalid media key');
  }

  const encodedKey = encodeURIComponent(key);
  await api(`/media/${encodedKey}`, { method: 'DELETE' });
}
