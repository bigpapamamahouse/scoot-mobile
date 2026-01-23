// Dynamic import to handle Expo Go (where native module isn't available)
let Video: any = null;
try {
  Video = require('react-native-compressor').Video;
} catch (e) {
  console.log('[VideoCompression] react-native-compressor not available (Expo Go)');
}

export interface CompressionResult {
  uri: string;
  originalSize?: number;
  compressedSize?: number;
  compressionRatio?: number;
  skipped?: boolean;
}

export interface CompressionOptions {
  /** Quality preset: 'low' | 'medium' | 'high'. Default: 'medium' */
  quality?: 'low' | 'medium' | 'high';
  /** Whether to log compression stats. Default: true */
  logStats?: boolean;
}

/**
 * Check if video compression is available (native module loaded)
 */
export function isCompressionAvailable(): boolean {
  return Video !== null;
}

/**
 * Compress a video file for upload.
 * Uses react-native-compressor with settings optimized for 10-second scoops.
 * Falls back to original video if compression is unavailable (Expo Go).
 *
 * Typical compression results for 10-second videos:
 * - 1080p 30fps: 50MB -> 5-8MB (85-90% reduction)
 * - 1080p 60fps: 80MB -> 8-12MB (85-90% reduction)
 * - 4K: 150MB -> 15-25MB (83-90% reduction)
 */
export async function compressVideo(
  uri: string,
  options: CompressionOptions = {}
): Promise<CompressionResult> {
  const { quality = 'medium', logStats = true } = options;

  // Check if compression is available (not in Expo Go)
  if (!Video) {
    if (logStats) {
      console.log('[VideoCompression] Skipping compression (Expo Go - native module unavailable)');
      console.log('[VideoCompression] Video will upload without compression');
    }
    return { uri, skipped: true };
  }

  if (logStats) {
    console.log('[VideoCompression] Starting compression...');
    console.log(`[VideoCompression] Input URI: ${uri}`);
    console.log(`[VideoCompression] Quality: ${quality}`);
  }

  const startTime = Date.now();

  try {
    // Compress the video using react-native-compressor
    // The library handles codec selection, bitrate, and resolution automatically
    const compressedUri = await Video.compress(uri, {
      compressionMethod: 'auto',
      // Quality maps to internal presets:
      // - 'low': aggressive compression, smaller files
      // - 'medium': balanced quality/size (recommended for mobile)
      // - 'high': less compression, larger files
      quality,
    });

    const elapsed = Date.now() - startTime;

    if (logStats) {
      console.log(`[VideoCompression] Compression complete in ${(elapsed / 1000).toFixed(1)}s`);
      console.log(`[VideoCompression] Output URI: ${compressedUri}`);
    }

    return {
      uri: compressedUri,
      skipped: false,
    };
  } catch (error) {
    console.error('[VideoCompression] Compression failed:', error);
    // Return original URI if compression fails - upload will still work
    console.log('[VideoCompression] Falling back to original video');
    return { uri, skipped: true };
  }
}

/**
 * Check if a URI points to a video file based on extension
 */
export function isVideoUri(uri: string): boolean {
  const videoExtensions = ['.mp4', '.mov', '.m4v', '.webm', '.3gp', '.avi'];
  const lowercaseUri = uri.toLowerCase();
  return videoExtensions.some(ext => lowercaseUri.includes(ext));
}
