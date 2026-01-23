/**
 * Media Service - Handles file uploads and video processing
 *
 * Routes:
 *   POST   /upload-url                - Get presigned upload URL
 *   POST   /avatar-url                - Get avatar upload URL
 *   DELETE /media/:key                - Delete media file
 *
 * Memory: 1024 MB (video processing with FFmpeg)
 * Timeout: 60 seconds (video processing can be slow)
 */

const { randomUUID } = require('crypto');
const { execSync } = require('child_process');
const fs = require('fs');
const { pipeline } = require('stream/promises');

const {
  ddb,
  tables,
} = require('/opt/nodejs/db-client');
const { ok, bad, handleOptions } = require('/opt/nodejs/response');
const { normalizePath, getUserFromEvent } = require('/opt/nodejs/auth');

const { MEDIA_BUCKET } = tables;
const FFMPEG_PATH = process.env.FFMPEG_PATH || '/opt/bin/ffmpeg';

// S3 client - lazy loaded
let s3Client = null;
async function getS3() {
  if (!s3Client) {
    const { S3Client } = require('@aws-sdk/client-s3');
    s3Client = new S3Client({});
  }
  return s3Client;
}

// Get presigned URL helper
async function getPresignedUploadUrl(bucket, key, contentType, expiresIn = 300) {
  const { PutObjectCommand } = require('@aws-sdk/client-s3');
  const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');

  const s3 = await getS3();
  const command = new PutObjectCommand({
    Bucket: bucket,
    Key: key,
    ContentType: contentType,
  });

  return getSignedUrl(s3, command, { expiresIn });
}

/**
 * Process video: trim to specified segment
 */
async function processVideo(bucket, key, startTime, endTime) {
  const timestamp = Date.now();
  const tmpInput = `/tmp/input_${timestamp}.mp4`;
  const tmpOutput = `/tmp/output_${timestamp}.mp4`;

  try {
    console.log(`[VideoProcess] Processing video: ${key}`);

    // Check FFmpeg availability
    try {
      execSync(`${FFMPEG_PATH} -version`, { stdio: ['pipe', 'pipe', 'pipe'] });
    } catch (e) {
      console.error('[VideoProcess] FFmpeg not available');
      return key; // Return original if FFmpeg unavailable
    }

    // Download from S3
    const { GetObjectCommand, PutObjectCommand } = require('@aws-sdk/client-s3');
    const s3 = await getS3();

    const getResult = await s3.send(new GetObjectCommand({ Bucket: bucket, Key: key }));
    const writeStream = fs.createWriteStream(tmpInput);
    await pipeline(getResult.Body, writeStream);

    const duration = endTime - startTime;
    const inputSize = fs.statSync(tmpInput).size;
    const mbPerSecond = (inputSize / 1024 / 1024) / duration;

    // Determine if compression needed
    const needsCompression = mbPerSecond > 1.5;

    let cmd;
    if (needsCompression) {
      cmd = [
        FFMPEG_PATH, '-y', '-ss', startTime.toString(),
        '-i', tmpInput, '-t', duration.toString(),
        '-c:v', 'libx264', '-crf', '28', '-preset', 'fast',
        '-c:a', 'aac', '-b:a', '128k',
        '-movflags', '+faststart',
        '-vf', 'scale=trunc(iw/2)*2:trunc(ih/2)*2',
        tmpOutput,
      ].join(' ');
    } else {
      cmd = [
        FFMPEG_PATH, '-y', '-ss', startTime.toString(),
        '-i', tmpInput, '-t', duration.toString(),
        '-c', 'copy', '-avoid_negative_ts', 'make_zero',
        tmpOutput,
      ].join(' ');
    }

    console.log(`[VideoProcess] Running: ${cmd}`);
    execSync(cmd, { maxBuffer: 50 * 1024 * 1024 });

    // Upload processed video
    const processedKey = key.replace(/(\.[^.]+)$/, '_processed$1');
    const fileContent = fs.readFileSync(tmpOutput);

    await s3.send(new PutObjectCommand({
      Bucket: bucket,
      Key: processedKey,
      Body: fileContent,
      ContentType: 'video/mp4',
    }));

    // Cleanup
    fs.unlinkSync(tmpInput);
    fs.unlinkSync(tmpOutput);

    console.log(`[VideoProcess] Complete: ${processedKey}`);
    return processedKey;
  } catch (error) {
    console.error('[VideoProcess] Error:', error);
    // Cleanup on error
    try { fs.unlinkSync(tmpInput); } catch (e) {}
    try { fs.unlinkSync(tmpOutput); } catch (e) {}
    return key; // Return original on error
  }
}

// Route handlers
async function uploadUrl(event, user) {
  if (!MEDIA_BUCKET) return bad(event, 'Media storage not configured', 501);

  const body = JSON.parse(event.body || '{}');
  const contentType = body.contentType || 'image/jpeg';
  const isVideo = contentType.startsWith('video/');
  const ext = isVideo ? 'mp4' : (contentType.includes('png') ? 'png' : 'jpg');

  const key = `uploads/${user.userId}/${Date.now()}_${randomUUID().slice(0, 8)}.${ext}`;

  const url = await getPresignedUploadUrl(MEDIA_BUCKET, key, contentType);

  return ok(event, { url, key });
}

async function avatarUrl(event, user) {
  if (!MEDIA_BUCKET) return bad(event, 'Media storage not configured', 501);

  const body = JSON.parse(event.body || '{}');
  const contentType = body.contentType || 'image/jpeg';
  const ext = contentType.includes('png') ? 'png' : 'jpg';

  const key = `avatars/${user.userId}/${Date.now()}.${ext}`;

  const url = await getPresignedUploadUrl(MEDIA_BUCKET, key, contentType);

  return ok(event, { url, key });
}

async function deleteMedia(event, user, key) {
  if (!MEDIA_BUCKET) return bad(event, 'Media storage not configured', 501);

  // Verify ownership (key should start with user's path)
  if (!key.includes(user.userId)) {
    return bad(event, 'Forbidden', 403);
  }

  try {
    const { DeleteObjectCommand } = require('@aws-sdk/client-s3');
    const s3 = await getS3();

    await s3.send(new DeleteObjectCommand({
      Bucket: MEDIA_BUCKET,
      Key: key,
    }));

    return ok(event, { success: true });
  } catch (error) {
    console.error('[Media] Delete error:', error);
    return bad(event, 'Failed to delete media', 500);
  }
}

async function processVideoRoute(event, user) {
  if (!MEDIA_BUCKET) return bad(event, 'Media storage not configured', 501);

  const body = JSON.parse(event.body || '{}');
  const { key, startTime, endTime } = body;

  if (!key || startTime === undefined || endTime === undefined) {
    return bad(event, 'Key, startTime, and endTime required', 400);
  }

  // Verify ownership
  if (!key.includes(user.userId)) {
    return bad(event, 'Forbidden', 403);
  }

  const processedKey = await processVideo(MEDIA_BUCKET, key, startTime, endTime);

  return ok(event, { key: processedKey, processed: processedKey !== key });
}

// Main handler
exports.handler = async (event) => {
  if ((event?.requestContext?.http?.method || event?.httpMethod) === 'OPTIONS') {
    return handleOptions(event);
  }

  const { method, path, route } = normalizePath(event);
  const user = getUserFromEvent(event);

  console.log('[media-service]', route, user.userId ? `user:${user.userId.slice(0, 8)}` : 'anonymous');

  if (!user.userId) {
    return bad(event, 'Unauthorized', 401);
  }

  try {
    switch (route) {
      case 'POST /upload-url':
        return await uploadUrl(event, user);
      case 'POST /avatar-url':
        return await avatarUrl(event, user);
      case 'POST /process-video':
        return await processVideoRoute(event, user);
    }

    // DELETE /media/:key
    if (method === 'DELETE' && path.startsWith('/media/')) {
      const key = decodeURIComponent(path.replace('/media/', ''));
      return await deleteMedia(event, user, key);
    }

    return bad(event, 'Not found', 404);
  } catch (error) {
    console.error('[media-service] Error:', error);
    return bad(event, 'Internal server error', 500);
  }
};
