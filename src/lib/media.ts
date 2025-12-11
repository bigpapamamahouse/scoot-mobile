
import { ENV } from '../lib/env';
import { api } from '../api/client';

const ABSOLUTE_URI_REGEX = /^(https?:\/\/|data:|blob:)/i;

const encodeKeySafely = (raw: string): string => {
  let sanitized = raw.trim().replace(/^\/+/, '');
  try {
    sanitized = decodeURIComponent(sanitized);
  } catch (error) {
    // Ignore malformed URI sequences and fall back to the original string.
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

export interface ImageOptimizationOptions {
  /** Target width in pixels */
  width?: number;
  /** Target height in pixels */
  height?: number;
  /** Quality (1-100, default 80) */
  quality?: number;
  /** Image format (e.g., 'webp', 'jpeg', 'png') */
  format?: string;
}

/**
 * Optimizes media URLs by adding CDN parameters for resizing and compression
 * This significantly reduces bandwidth and improves load times
 *
 * @param key - The media key or URL
 * @param options - Optimization options (width, height, quality, format)
 * @returns Optimized media URL with query parameters
 *
 * @example
 * // Get thumbnail version
 * optimizedMediaUrl(avatarKey, { width: 100, quality: 80 })
 *
 * // Get feed image
 * optimizedMediaUrl(imageKey, { width: 800, quality: 85, format: 'webp' })
 */
export function optimizedMediaUrl(
  key?: string | null,
  options?: ImageOptimizationOptions
): string | null {
  const baseUrl = mediaUrlFromKey(key);
  if (!baseUrl) {
    return null;
  }

  // If no optimization options provided, return base URL
  if (!options || Object.keys(options).length === 0) {
    return baseUrl;
  }

  // Build query parameters for CDN optimization
  const params = new URLSearchParams();

  if (options.width) {
    params.append('w', String(options.width));
  }

  if (options.height) {
    params.append('h', String(options.height));
  }

  if (options.quality) {
    params.append('q', String(Math.min(100, Math.max(1, options.quality))));
  }

  if (options.format) {
    params.append('f', options.format);
  }

  const queryString = params.toString();
  if (!queryString) {
    return baseUrl;
  }

  // Add query parameters to URL
  const separator = baseUrl.includes('?') ? '&' : '?';
  return `${baseUrl}${separator}${queryString}`;
}

/**
 * Preset optimization options for common use cases
 */
export const ImagePresets = {
  /** Small avatar (32-64px) */
  avatarSmall: { width: 64, quality: 80 },
  /** Medium avatar (100-128px) */
  avatarMedium: { width: 128, quality: 85 },
  /** Large avatar (200-256px) */
  avatarLarge: { width: 256, quality: 85 },
  /** Feed thumbnail */
  feedThumbnail: { width: 400, quality: 80 },
  /** Feed full image */
  feedFull: { width: 800, quality: 85 },
  /** Full screen image */
  fullScreen: { width: 1200, quality: 90 },
} as const;

/**
 * Delete an uploaded media file from S3
 * @param key The S3 key of the media to delete
 */
export async function deleteMedia(key: string): Promise<void> {
  if (!key || typeof key !== 'string') {
    throw new Error('Invalid media key');
  }

  const encodedKey = encodeURIComponent(key);
  console.log('[deleteMedia] Deleting key:', key);
  console.log('[deleteMedia] Encoded key:', encodedKey);
  console.log('[deleteMedia] Request path:', `/media/${encodedKey}`);

  try {
    const result = await api(`/media/${encodedKey}`, { method: 'DELETE' });
    console.log('[deleteMedia] Success:', result);
  } catch (error) {
    console.error('[deleteMedia] Failed:', error);
    throw error;
  }
}
