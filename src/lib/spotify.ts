/**
 * Spotify oEmbed integration utilities
 * Supports tracks, albums, and playlists
 */

import { SpotifyContentType, SpotifyEmbed } from '../types';

// Re-export types for convenience
export type { SpotifyContentType, SpotifyEmbed } from '../types';

// Raw response from Spotify oEmbed API
interface SpotifyOEmbedResponse {
  html: string;
  width: number;
  height: number;
  version: string;
  provider_name: string;
  provider_url: string;
  type: string;
  title: string;
  thumbnail_url: string;
  thumbnail_width: number;
  thumbnail_height: number;
}

// Regex patterns for Spotify URLs
const SPOTIFY_URL_PATTERNS = {
  // https://open.spotify.com/track/6rqhFgbbKwnb9MLmUQDhG6
  webUrl: /https?:\/\/open\.spotify\.com\/(track|album|playlist)\/([a-zA-Z0-9]+)(\?.*)?/,
  // spotify:track:6rqhFgbbKwnb9MLmUQDhG6
  uri: /spotify:(track|album|playlist):([a-zA-Z0-9]+)/,
};

/**
 * Extract Spotify content info from a URL or URI
 * @param input - Spotify URL or URI string
 * @returns Object with type and id, or null if not a valid Spotify link
 */
export function parseSpotifyUrl(input: string): { type: SpotifyContentType; id: string } | null {
  if (!input || typeof input !== 'string') {
    return null;
  }

  const trimmed = input.trim();

  // Try web URL pattern first
  const webMatch = trimmed.match(SPOTIFY_URL_PATTERNS.webUrl);
  if (webMatch) {
    return {
      type: webMatch[1] as SpotifyContentType,
      id: webMatch[2],
    };
  }

  // Try URI pattern
  const uriMatch = trimmed.match(SPOTIFY_URL_PATTERNS.uri);
  if (uriMatch) {
    return {
      type: uriMatch[1] as SpotifyContentType,
      id: uriMatch[2],
    };
  }

  return null;
}

/**
 * Detect all Spotify URLs/URIs in a text string
 * @param text - Text to search for Spotify links
 * @returns Array of detected Spotify URLs
 */
export function detectSpotifyUrls(text: string): string[] {
  if (!text || typeof text !== 'string') {
    return [];
  }

  const urls: string[] = [];

  // Find web URLs
  const webMatches = text.matchAll(new RegExp(SPOTIFY_URL_PATTERNS.webUrl, 'g'));
  for (const match of webMatches) {
    urls.push(match[0]);
  }

  // Find URIs
  const uriMatches = text.matchAll(new RegExp(SPOTIFY_URL_PATTERNS.uri, 'g'));
  for (const match of uriMatches) {
    urls.push(match[0]);
  }

  return urls;
}

/**
 * Convert a Spotify ID to the canonical web URL
 */
export function getSpotifyWebUrl(type: SpotifyContentType, id: string): string {
  return `https://open.spotify.com/${type}/${id}`;
}

/**
 * Get the Spotify app deep link URI for opening in the Spotify app
 */
export function getSpotifyDeepLink(type: SpotifyContentType, id: string): string {
  return `spotify:${type}:${id}`;
}

/**
 * Fetch metadata from Spotify's oEmbed API
 * @param spotifyUrl - A valid Spotify web URL
 * @returns SpotifyEmbed data or null if fetch fails
 */
export async function fetchSpotifyEmbed(spotifyUrl: string): Promise<SpotifyEmbed | null> {
  const parsed = parseSpotifyUrl(spotifyUrl);
  if (!parsed) {
    console.warn('[Spotify] Invalid Spotify URL:', spotifyUrl);
    return null;
  }

  // Normalize to web URL for oEmbed API
  const normalizedUrl = getSpotifyWebUrl(parsed.type, parsed.id);
  const oembedUrl = `https://open.spotify.com/oembed?url=${encodeURIComponent(normalizedUrl)}`;

  try {
    const response = await fetch(oembedUrl, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
      },
    });

    if (!response.ok) {
      console.warn('[Spotify] oEmbed API error:', response.status, response.statusText);
      return null;
    }

    const data: SpotifyOEmbedResponse = await response.json();

    return {
      type: parsed.type,
      spotifyId: parsed.id,
      spotifyUrl: normalizedUrl,
      title: data.title,
      thumbnailUrl: data.thumbnail_url,
      thumbnailWidth: data.thumbnail_width,
      thumbnailHeight: data.thumbnail_height,
    };
  } catch (error) {
    console.error('[Spotify] Failed to fetch oEmbed:', error);
    return null;
  }
}

/**
 * Fetch metadata for the first Spotify URL found in text
 * @param text - Text that may contain a Spotify URL
 * @returns SpotifyEmbed data or null if no valid Spotify link found
 */
export async function fetchSpotifyEmbedFromText(text: string): Promise<SpotifyEmbed | null> {
  const urls = detectSpotifyUrls(text);
  if (urls.length === 0) {
    return null;
  }

  // Only use the first Spotify URL found
  return fetchSpotifyEmbed(urls[0]);
}

/**
 * Check if text contains any Spotify URLs
 */
export function hasSpotifyUrl(text: string): boolean {
  return detectSpotifyUrls(text).length > 0;
}

/**
 * Get a human-readable label for the content type
 */
export function getSpotifyTypeLabel(type: SpotifyContentType): string {
  switch (type) {
    case 'track':
      return 'Song';
    case 'album':
      return 'Album';
    case 'playlist':
      return 'Playlist';
    default:
      return 'Spotify';
  }
}
