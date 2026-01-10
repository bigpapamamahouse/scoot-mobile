// === ScooterBooter Lambda (merged with Notifications / Mentions / Follow-Requests) ===
// ---------- CommonJS + AWS SDK v3 ----------
const crypto = require('crypto');
const { randomUUID } = require('crypto');

const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const {
  DynamoDBDocumentClient,
  GetCommand,
  PutCommand,
  QueryCommand,
  ScanCommand,
  DeleteCommand,
  UpdateCommand,
  BatchGetCommand,
} = require('@aws-sdk/lib-dynamodb');

const { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');

const { CognitoIdentityProviderClient, AdminDeleteUserCommand } = require('@aws-sdk/client-cognito-identity-provider');

const { BedrockRuntimeClient, InvokeModelCommand } = require('@aws-sdk/client-bedrock-runtime');

// ---------- Env ----------
const POSTS_TABLE     = process.env.POSTS_TABLE;
const USERS_TABLE     = process.env.USERS_TABLE;
const INVITES_TABLE   = process.env.INVITES_TABLE;
const FOLLOWS_TABLE   = process.env.FOLLOWS_TABLE; // optional but recommended
const MEDIA_BUCKET    = process.env.MEDIA_BUCKET;
const COMMENTS_TABLE  = process.env.COMMENTS_TABLE;   // pk: POST#<postId>, sk: C#<ts>#<uuid>
const REACTIONS_TABLE = process.env.REACTIONS_TABLE;  // pk: POST#<postId>, sk: COUNT#<emoji> (count item)
//                                                    // pk: POST#<postId>, sk: USER#<userId>  (who reacted + emoji)
const NOTIFICATIONS_TABLE = process.env.NOTIFICATIONS_TABLE; // NEW: pk USER#<targetId>, sk N#<ts>#<uuid>
const PUSH_TOKENS_TABLE = process.env.PUSH_TOKENS_TABLE; // pk: USER#<userId>, sk: TOKEN#<tokenHash>
const REPORTS_TABLE = process.env.REPORTS_TABLE; // pk: REPORT#<reportId>, sk: <timestamp>
const BLOCKS_TABLE = process.env.BLOCKS_TABLE; // pk: USER#<userId>, sk: BLOCKED#<blockedUserId>
const SCOOPS_TABLE = process.env.SCOOPS_TABLE; // pk: USER#<userId>, sk: SCOOP#<ts>#<uuid> - Stories/Scoops
const USER_POOL_ID = process.env.USER_POOL_ID;

// ---------- Allowed origins for CORS ----------
const ALLOWED_ORIGINS = new Set([
  'https://app.scooterbooter.com',
  'http://localhost:5173',
]);

const ADMIN_EMAILS = (process.env.ADMIN_EMAILS || '')
  .split(',')
  .map(s => s.trim().toLowerCase())
  .filter(Boolean);

// ---------- Clients ----------
const ddbClient = new DynamoDBClient({
  requestHandler: {
    requestTimeout: 3000, // 3 second timeout per request to prevent cascading delays
  },
  maxAttempts: 2, // Reduce retries from default 3 to prevent timeout cascade
});
const ddb = DynamoDBDocumentClient.from(ddbClient, {
  marshallOptions: { removeUndefinedValues: true },
});
const s3 = new S3Client({});
const cognito = new CognitoIdentityProviderClient({});
const bedrock = new BedrockRuntimeClient({ region: 'us-east-1' });

// ---------- CORS + response helpers ----------

function corsFor(event) {
  const o = event?.headers?.origin || event?.headers?.Origin || '';
  const allow = ALLOWED_ORIGINS.has(o) ? o : 'https://app.scooterbooter.com';
  // Allow both canonical and lowercase header names + our custom header.
  const allowHeaders = [
    'Content-Type',
    'content-type',
    'Authorization',
    'authorization',
    'Accept',
    'accept',
    'X-Requested-With',
    'x-requested-with',
    'Origin',
    'origin',
    'X-Ignore-Auth-Redirect',
    'x-ignore-auth-redirect',
  ].join(', ');
  return {
    'Access-Control-Allow-Origin': allow,
    'Access-Control-Allow-Credentials': 'true',
    'Access-Control-Allow-Headers': allowHeaders,
    'Access-Control-Allow-Methods': 'GET,POST,PATCH,DELETE,OPTIONS',
    'Access-Control-Max-Age': '86400',
    'Vary': 'Origin',
  };
}

// we keep the original ok/bad call sites unchanged by capturing the current event
let __event = null;
const ok = (body, status = 200, extraHeaders = {}) => ({
  statusCode: status,
  headers: {
    ...(corsFor(__event) || {}),
    'Content-Type': 'application/json; charset=utf-8', // ← ensure JSON content type
    ...extraHeaders
  },
  body: typeof body === 'string' ? body : JSON.stringify(body),
});
const bad = (message = 'Bad Request', status = 400) => ok({ message }, status);

// ---------- Misc helpers ----------
const claimsFrom = (event) => event?.requestContext?.authorizer?.jwt?.claims || {};

async function getHandleForUserId(userId) {
  const r = await ddb.send(new GetCommand({
    TableName: USERS_TABLE,
    Key: { pk: `USER#${userId}` },
    ConsistentRead: true,
  }));
  return r.Item?.handle || null;
}

// Resolve a userId from a handle
async function userIdFromHandle(handle) {
  if (!handle) return null;
  const h = String(handle).trim().toLowerCase();
  // Primary: HANDLE mapping row -> USER id
  try {
    const r = await ddb.send(new GetCommand({
      TableName: USERS_TABLE,
      Key: { pk: `HANDLE#${h}` },
      ProjectionExpression: 'userId',
      ConsistentRead: true,
    }));
    if (r.Item && r.Item.userId) return String(r.Item.userId);
  } catch (e) {}

  // Optional fallback via GSI if present
  try {
    const qr = await ddb.send(new QueryCommand({
      TableName: USERS_TABLE,
      IndexName: 'byHandle',
      KeyConditionExpression: '#t = :t AND #h = :h',
      ExpressionAttributeNames: { '#t': 'type', '#h': 'handle' },
      ExpressionAttributeValues: { ':t': 'HANDLE', ':h': h },
      Limit: 1,
      // Note: GSIs do not support ConsistentRead - only eventually consistent
    }));
    const it = (qr.Items || [])[0];
    if (it && it.userId) return String(it.userId);
  } catch (e) {}

  return null;
}

// NEW: Get user notification preferences
async function getUserNotificationPreferences(userId) {
  if (!USERS_TABLE || !userId) return null;

  try {
    const r = await ddb.send(new GetCommand({
      TableName: USERS_TABLE,
      Key: { pk: `USER#${userId}` },
      ProjectionExpression: 'notificationPreferences',
      ConsistentRead: true,
    }));

    // Default: all notifications enabled
    const defaults = {
      mentions: true,
      comments: true,
      reactions: true,
    };

    return r.Item?.notificationPreferences || defaults;
  } catch (e) {
    console.error('[Preferences] Failed to get notification preferences:', e);
    // Return defaults on error
    return {
      mentions: true,
      comments: true,
      reactions: true,
    };
  }
}

// NEW: notifications helper
async function createNotification(targetUserId, type, fromUserId, postId = null, message = '') {
  if (!NOTIFICATIONS_TABLE || !targetUserId || targetUserId === fromUserId) return;

  // Check user's notification preferences
  const prefs = await getUserNotificationPreferences(targetUserId);

  // Map notification types to preference keys
  const prefMap = {
    'mention': 'mentions',
    'comment': 'comments',
    'reply': 'comments',
    'reaction': 'reactions',
  };

  const prefKey = prefMap[type];

  // If this notification type is mapped to a preference and it's disabled, skip notification
  if (prefKey && prefs && prefs[prefKey] === false) {
    console.log(`[Notifications] Skipping ${type} notification for user ${targetUserId} (preference disabled)`);
    return;
  }

  const now = Date.now();
  const id = randomUUID();
  await ddb.send(new PutCommand({
    TableName: NOTIFICATIONS_TABLE,
    Item: {
      pk: `USER#${targetUserId}`,
      sk: `N#${now}#${id}`,
      id,
      type,
      fromUserId,
      postId,
      message,
      read: false,
      createdAt: now,
    },
  }));

  // NEW: Send push notification
  try {
    // Get sender's handle for personalized notification
    let senderHandle = 'Someone';
    try {
      senderHandle = await getHandleForUserId(fromUserId) || 'Someone';
    } catch (e) {
      console.error('[Push] Failed to get sender handle:', e);
    }

    // Create notification title and body based on type
    let title = 'New Notification';
    let body = message;

    switch (type) {
      case 'comment':
        title = `${senderHandle} commented`;
        body = 'commented on your post';
        break;
      case 'reaction':
        title = `${senderHandle} reacted`;
        body = 'reacted to your post';
        break;
      case 'mention':
        title = `${senderHandle} mentioned you`;
        body = 'mentioned you';
        break;
      case 'follow':
        title = `${senderHandle} followed you`;
        body = 'started following you';
        break;
      case 'follow_request':
        title = `${senderHandle} wants to follow you`;
        body = 'sent you a follow request';
        break;
      case 'follow_accept':
        title = `${senderHandle} accepted`;
        body = 'accepted your follow request';
        break;
      case 'follow_declined':
        title = `Follow request declined`;
        body = `${senderHandle} declined your follow request`;
        break;
      case 'reply':
        title = `${senderHandle} replied`;
        body = 'replied to your comment';
        break;
      default:
        title = 'New Notification';
        body = message || 'You have a new notification';
    }

    // Send push notification
    await sendPushNotification(targetUserId, title, body, {
      notificationId: id,
      postId: postId || undefined,
      type: type,
    });
  } catch (err) {
    console.error('[Push] Failed to send push notification in createNotification:', err);
    // Don't throw - notification was still created in DB
  }
}


// Helper: delete notifications that match a predicate (type/fromUserId/postId)
async function deleteNotifications(targetUserId, type, fromUserId = null, postId = null, sk = null) {
  if (!NOTIFICATIONS_TABLE || !targetUserId) return;
  if (sk) {
    try {
      await ddb.send(new DeleteCommand({
        TableName: NOTIFICATIONS_TABLE,
        Key: { pk: `USER#${targetUserId}`, sk }
      }));
    } catch (e) {
      console.error('deleteNotifications (by sk) failed for', targetUserId, sk, e);
    }
    return;
  }
  try {
    const q = await ddb.send(new QueryCommand({
      TableName: NOTIFICATIONS_TABLE,
      KeyConditionExpression: 'pk = :p',
      ExpressionAttributeValues: { ':p': `USER#${targetUserId}` },
      ScanIndexForward: false,
      Limit: 200,
      ConsistentRead: true,
    }));
    const items = (q.Items || []).filter(it => {
      if (type && it.type !== type) return false;
      if (fromUserId && String(it.fromUserId) !== String(fromUserId)) return false;
      if (postId && String(it.postId || '') !== String(postId)) return false;
      return true;
    });
    for (const it of items) {
      try {
        await ddb.send(new DeleteCommand({
          TableName: NOTIFICATIONS_TABLE,
          Key: { pk: `USER#${targetUserId}`, sk: it.sk },
        }));
      } catch (e) {
        console.error('deleteNotifications failed for', targetUserId, e);
      }
    }
  } catch (e) {
    console.error('deleteNotifications query failed', e);
  }
}

// ---------- Content Moderation with Amazon Bedrock ----------

/**
 * Moderate content using Amazon Bedrock (text and/or image)
 * Returns { safe: boolean, reason: string }
 */
async function moderateContent(text, imageKey = null) {
  // Must have at least text or image
  if ((!text || typeof text !== 'string') && !imageKey) {
    return { safe: true, reason: null };
  }

  try {
    // Build content array for multimodal input
    const contentParts = [];

    // Add text prompt
    const prompt = imageKey
      ? `You are a content moderation system for a social media app. Your job is to protect users from harmful content while allowing normal everyday content.

Analyze the provided image and/or text. You MUST block content if it contains ANY of the following:

BLOCK IMMEDIATELY:
- Explicit nudity showing genitals, exposed breasts, or buttocks in a sexual context
- Pornographic content or explicit sexual acts
- Graphic violence, blood, gore, or disturbing imagery
- Hate symbols, slurs, or attacks on protected groups (race, religion, ethnicity, gender, sexual orientation, disability)
- Weapons being used to threaten or harm
- Drug paraphernalia or illegal drug use
- Self-harm or suicide content

ALLOW (safe content):
- Artistic nudity in classical art/sculptures (museums, famous paintings)
- Medical or educational diagrams
- Swimwear, beachwear, or beach photos
- Clothing products (lingerie, sleepwear, etc.) shown in non-sexual product photos
- Sleep masks, eye masks, and similar everyday items
- Fashion photography and modeling (even if revealing, as long as not pornographic)
- Casual profanity in text (when not attacking people/groups)
- Political opinions or criticism

${text ? `Text: "${text}"` : 'No text provided.'}

IMPORTANT: Only block content that is clearly and explicitly pornographic or harmful. Everyday items, clothing products, and non-sexual content should be allowed even if they might be considered mildly suggestive. When in doubt, allow the content.

Respond ONLY with a JSON object:
{"safe": true/false, "reason": "brief explanation if unsafe, null if safe"}`
      : `You are a content moderation system. Analyze the following text and flag ONLY if it contains:

BLOCK if it contains:
- Graphic descriptions of violence or gore
- Hate speech targeting protected groups (race, religion, ethnicity, gender, sexual orientation, disability)
- Direct threats or harassment targeting specific individuals
- Content promoting illegal activities (terrorism, child exploitation, drug trafficking)

ALLOW (do not block):
- Casual profanity or strong language (e.g., "fuck", "shit", "damn") when not directed at groups or individuals
- Political opinions or criticism (even if heated)
- Edgy humor that doesn't target protected groups
- General complaints or frustration
- Sexual jokes, innuendo, or sexually suggestive text (text-only sexual content is allowed)

Text to analyze: "${text}"

Respond ONLY with a JSON object in this exact format:
{"safe": true/false, "reason": "brief explanation if unsafe, null if safe"}`;

    contentParts.push({
      type: "text",
      text: prompt
    });

    // Add image if provided
    if (imageKey) {
      try {
        console.log(`[Moderation] Fetching image from S3: ${imageKey}`);

        // Fetch image from S3
        const getCommand = new GetObjectCommand({
          Bucket: MEDIA_BUCKET,
          Key: imageKey
        });
        const s3Response = await s3.send(getCommand);

        // Convert stream to buffer
        const chunks = [];
        for await (const chunk of s3Response.Body) {
          chunks.push(chunk);
        }
        const imageBuffer = Buffer.concat(chunks);
        const base64Image = imageBuffer.toString('base64');

        console.log(`[Moderation] Image fetched, size: ${imageBuffer.length} bytes`);

        // Determine and normalize media type to Bedrock's strict requirements
        // Bedrock only accepts: image/jpeg, image/png, image/gif, image/webp
        let mediaType = 'image/jpeg'; // Default

        // First check S3 ContentType
        const s3ContentType = s3Response.ContentType?.toLowerCase();
        console.log(`[Moderation] S3 ContentType: ${s3ContentType}`);

        if (s3ContentType) {
          if (s3ContentType.includes('png')) {
            mediaType = 'image/png';
          } else if (s3ContentType.includes('gif')) {
            mediaType = 'image/gif';
          } else if (s3ContentType.includes('webp')) {
            mediaType = 'image/webp';
          } else if (s3ContentType.includes('jpeg') || s3ContentType.includes('jpg')) {
            mediaType = 'image/jpeg';
          }
        }

        // Fallback: check image key for extension hints
        if (mediaType === 'image/jpeg') {
          const keyLower = imageKey.toLowerCase();
          if (keyLower.includes('.png')) {
            mediaType = 'image/png';
          } else if (keyLower.includes('.gif')) {
            mediaType = 'image/gif';
          } else if (keyLower.includes('.webp')) {
            mediaType = 'image/webp';
          }
        }

        console.log(`[Moderation] Normalized media type: ${mediaType}`);

        contentParts.push({
          type: "image",
          source: {
            type: "base64",
            media_type: mediaType,
            data: base64Image
          }
        });

        console.log('[Moderation] Image added to content parts for analysis');
      } catch (imageError) {
        console.error('[Moderation] Failed to fetch image from S3:', imageError);
        console.error('[Moderation] Image key:', imageKey);
        console.error('[Moderation] Bucket:', MEDIA_BUCKET);
        // Continue with text-only moderation if image fetch fails
      }
    }

    const payload = {
      anthropic_version: "bedrock-2023-05-31",
      max_tokens: 200,
      messages: [{
        role: "user",
        content: contentParts
      }]
    };

    console.log(`[Moderation] Calling Bedrock with ${contentParts.length} content parts (text: ${!!text}, image: ${!!imageKey})`);

    const command = new InvokeModelCommand({
      modelId: "anthropic.claude-3-haiku-20240307-v1:0",
      contentType: "application/json",
      accept: "application/json",
      body: JSON.stringify(payload)
    });

    const response = await bedrock.send(command);
    const responseBody = JSON.parse(new TextDecoder().decode(response.body));

    // Extract the content from Claude's response
    const content = responseBody.content[0].text;
    console.log('[Moderation] Bedrock response:', content);

    // Try to parse the JSON response
    try {
      const result = JSON.parse(content);
      const isSafe = result.safe === true;
      console.log(`[Moderation] Result: ${isSafe ? 'SAFE' : 'BLOCKED'} - ${result.reason || 'no reason'}`);
      return {
        safe: isSafe,
        reason: result.reason || null
      };
    } catch (parseErr) {
      console.error('[Moderation] Failed to parse Bedrock response:', content);
      // Default to safe if we can't parse (fail open to prevent blocking all content)
      return { safe: true, reason: null };
    }
  } catch (error) {
    console.error('[Moderation] Bedrock moderation failed:', error);
    // Fail open - allow content if moderation service is down
    return { safe: true, reason: null };
  }
}

// ---------- Blocking helpers ----------

/**
 * Check if userA has blocked userB
 */
async function isBlocked(userA, userB) {
  if (!BLOCKS_TABLE || !userA || !userB) return false;
  try {
    const result = await ddb.send(new GetCommand({
      TableName: BLOCKS_TABLE,
      Key: { pk: `USER#${userA}`, sk: `BLOCKED#${userB}` },
      ConsistentRead: true,
    }));
    return !!result.Item;
  } catch (e) {
    console.error('[Blocking] isBlocked check failed:', e);
    return false;
  }
}

/**
 * Check if there's a bidirectional block between two users
 */
async function hasBlockBetween(userA, userB) {
  if (!userA || !userB) return false;
  const [aBlocksB, bBlocksA] = await Promise.all([
    isBlocked(userA, userB),
    isBlocked(userB, userA)
  ]);
  return aBlocksB || bBlocksA;
}

/**
 * Get list of user IDs that the given user has blocked
 */
async function getBlockedUserIds(userId) {
  if (!BLOCKS_TABLE || !userId) return [];
  try {
    const result = await ddb.send(new QueryCommand({
      TableName: BLOCKS_TABLE,
      KeyConditionExpression: 'pk = :pk',
      ExpressionAttributeValues: { ':pk': `USER#${userId}` },
      ConsistentRead: true,
    }));
    return (result.Items || []).map(item => item.blockedUserId).filter(Boolean);
  } catch (e) {
    console.error('[Blocking] getBlockedUserIds failed:', e);
    return [];
  }
}


// Helper: check if a notification already exists (best-effort; scans recent)
async function hasNotification(targetUserId, type, fromUserId = null, postId = null) {
  if (!NOTIFICATIONS_TABLE || !targetUserId) return false;
  try {
    const q = await ddb.send(new QueryCommand({
      TableName: NOTIFICATIONS_TABLE,
      KeyConditionExpression: 'pk = :p',
      ExpressionAttributeValues: { ':p': `USER#${targetUserId}` },
      ScanIndexForward: false,
      Limit: 200,
    }));
    const items = q.Items || [];
    for (const it of items) {
      if (type && it.type !== type) continue;
      if (fromUserId && String(it.fromUserId) !== String(fromUserId)) continue;
      if (postId && String(it.postId || '') !== String(postId)) continue;
      return true;
    }
  } catch (e) { console.error('hasNotification failed', e); }
  return false;
}

// NEW: Send push notification via Expo Push Service
async function sendPushNotification(userId, title, body, data = {}) {
  if (!PUSH_TOKENS_TABLE || !userId) return;

  try {
    // Get all push tokens for this user
    const tokensQuery = await ddb.send(new QueryCommand({
      TableName: PUSH_TOKENS_TABLE,
      KeyConditionExpression: 'pk = :p',
      ExpressionAttributeValues: { ':p': `USER#${userId}` },
      ConsistentRead: true,
    }));

    const tokens = (tokensQuery.Items || []).map(item => item.token).filter(Boolean);

    if (tokens.length === 0) {
      console.log(`[Push] No tokens found for user ${userId}`);
      return;
    }

    // Send push notification to each token via Expo Push Service
    const messages = tokens.map(token => ({
      to: token,
      sound: 'default',
      title: title,
      body: body,
      data: data,
      priority: 'high',
      channelId: 'default',
    }));

    // Send to Expo Push Service
    const response = await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Accept-Encoding': 'gzip, deflate',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(messages),
    });

    const result = await response.json();
    console.log(`[Push] Sent to ${tokens.length} device(s) for user ${userId}:`, result);

    // Handle receipts (optional - for production you'd want to track and handle errors)
    if (result.data) {
      for (let i = 0; i < result.data.length; i++) {
        const receipt = result.data[i];
        if (receipt.status === 'error') {
          console.error(`[Push] Error sending to token ${tokens[i]}:`, receipt.message);
          // In production, you might want to delete invalid tokens here
        }
      }
    }
  } catch (err) {
    console.error('[Push] Failed to send push notification:', err);
  }
}

// NEW: Generate or retrieve a unique invite code for a user
async function generateUserInviteCode(userId) {
  if (!INVITES_TABLE || !userId) return null;

  // First, check if user already has an invite code by querying with GSI
  try {
    const existing = await ddb.send(new QueryCommand({
      TableName: INVITES_TABLE,
      IndexName: 'byUserId',
      KeyConditionExpression: 'userId = :uid',
      ExpressionAttributeValues: { ':uid': userId },
      Limit: 1,
      // Note: GSIs do not support ConsistentRead - only eventually consistent
    }));

    if (existing.Items && existing.Items[0]) {
      console.log(`[Invites] Found existing code via GSI: ${existing.Items[0].code}`);
      return existing.Items[0].code;
    }
  } catch (e) {
    // If GSI doesn't exist yet, fall back to Scan with filter
    console.log('[Invites] GSI byUserId not available, trying Scan fallback:', e.message);

    try {
      const scanResult = await ddb.send(new ScanCommand({
        TableName: INVITES_TABLE,
        FilterExpression: 'userId = :uid',
        ExpressionAttributeValues: { ':uid': userId },
        Limit: 10, // Should only be 1, but allow a few in case of duplicates
        ConsistentRead: true,
      }));

      if (scanResult.Items && scanResult.Items.length > 0) {
        // Return the first (oldest) code for this user
        console.log(`[Invites] Found existing code via Scan: ${scanResult.Items[0].code}`);
        return scanResult.Items[0].code;
      }
    } catch (scanError) {
      console.error('[Invites] Scan fallback also failed:', scanError.message);
      // Continue to create new code
    }
  }

  // Generate a new code if none exists
  const code = crypto.randomUUID().slice(0, 8).toUpperCase();

  try {
    await ddb.send(new PutCommand({
      TableName: INVITES_TABLE,
      Item: {
        code,
        userId,
        usesRemaining: 10,
        createdAt: Date.now(),
      },
    }));

    console.log(`[Invites] Generated new invite code ${code} for user ${userId}`);
    return code;
  } catch (e) {
    console.error('[Invites] Failed to create user invite code:', e);
    return null;
  }
}

function normalizePath(event) {
  // Handles both API Gateway v1 (REST) and v2 (HTTP) payloads
  const method = (event?.httpMethod || event?.requestContext?.http?.method || '').toUpperCase();
  const rawPath = event?.path || event?.rawPath || event?.requestContext?.http?.path || '';
  const stage   = event?.requestContext?.stage || '';

  let path = rawPath || '/';
  // Strip stage if it's part of the path
  if (stage && path.startsWith(`/${stage}`)) {
    path = path.slice(stage.length + 1);
  }

  // Clean up the path
  path = ('/' + path.split('?')[0]).replace(/\/{2,}/g, '/').replace(/\/+$/g, '') || '/';

  return { method, rawPath, stage, path, route: `${method} ${path}` };
}

function matchUserRoutes(path) {
  const m1 = path.match(/^\/u\/([^\/]+)$/);
  if (m1) return { kind: 'user', handle: decodeURIComponent(m1[1]) };

  const m2 = path.match(/^\/u\/([^\/]+)\/followers$/);
  if (m2) return { kind: 'followers', handle: decodeURIComponent(m2[1]) };

  const m3 = path.match(/^\/u\/([^\/]+)\/following$/);
  if (m3) return { kind: 'following', handle: decodeURIComponent(m3[1]) };

  const m4 = path.match(/^\/u\/([^\/]+)\/posts$/);
  if (m4) return { kind: 'posts', handle: decodeURIComponent(m4[1]) };

  return null;
}

async function listPostsByUserId(targetId, limit = 1000) {
  const r = await ddb.send(new QueryCommand({
    TableName: POSTS_TABLE,
    KeyConditionExpression: 'pk = :p',
    ExpressionAttributeValues: { ':p': `USER#${targetId}` },
    ScanIndexForward: false,
    Limit: limit,
    ConsistentRead: true,
  }));
  return (r.Items || []).map(i => ({
    id: i.id,
    userId: i.userId,
    username: i.username || 'unknown',
    text: i.text || '',
    imageKey: i.imageKey || null,
    imageAspectRatio: i.imageAspectRatio || null,
    images: i.images || null,
    avatarKey: i.avatarKey || null,
    createdAt: i.createdAt,
  }));
}

// ---- ConsistentRead helpers for follow state ----
async function countFollowers(targetUserId) {
  if (!FOLLOWS_TABLE) return 0;
  const r = await ddb.send(new ScanCommand({
    TableName: FOLLOWS_TABLE,
    FilterExpression: 'sk = :t',
    ExpressionAttributeValues: { ':t': targetUserId },
    ProjectionExpression: 'pk',
    ConsistentRead: true,
  }));
  return (r.Items || []).length;
}

async function countFollowing(userId) {
  if (!FOLLOWS_TABLE) return 0;
  const r = await ddb.send(new QueryCommand({
    TableName: FOLLOWS_TABLE,
    KeyConditionExpression: 'pk = :me',
    ExpressionAttributeValues: { ':me': userId },
    ProjectionExpression: 'sk',
    ConsistentRead: true,
  }));
  return (r.Items || []).length;
}

async function isFollowing(userId, targetUserId) {
  if (!FOLLOWS_TABLE) return false;
  const r = await ddb.send(new GetCommand({
    TableName: FOLLOWS_TABLE,
    Key: { pk: userId, sk: targetUserId },
    ConsistentRead: true,
  }));
  return !!r.Item;
}

// Get handle + avatarKey for a list of userIds.
async function fetchUserSummaries(userIds) {
  const unique = Array.from(new Set(userIds)).filter(Boolean);
  if (unique.length === 0) return [];

  const chunk = (arr, n) =>
    arr.reduce((acc, _, i) => (i % n ? acc : [...acc, arr.slice(i, i + n)]), []);
  const chunks = chunk(unique, 100);

  const out = [];
  for (const ids of chunks) {
    const resp = await ddb.send(new BatchGetCommand({
      RequestItems: {
        [USERS_TABLE]: {
          Keys: ids.map(id => ({ pk: `USER#${id}` })),
          ProjectionExpression: 'pk, handle, userId, avatarKey, fullName',
        }
      }
    }));
    const rows = (resp.Responses?.[USERS_TABLE] || []);
    for (const it of rows) {
      let id = (it.userId && String(it.userId)) || '';
      if (!id && typeof it.pk === 'string' && it.pk.startsWith('USER#')) {
        id = it.pk.slice('USER#'.length);
      }
      if (!id) continue;
      out.push({
        userId: id,
        handle: it.handle || null,
        avatarKey: it.avatarKey || null,
        fullName: it.fullName || null,
      });
    }
  }

  // Fallback per-item (LIMITED to prevent excessive queries)
  if (out.length === 0 && unique.length > 0) {
    console.warn(`[fetchUserSummaries] BatchGet returned 0 results for ${unique.length} users - using limited fallback`);
    // IMPORTANT: Limit fallback to prevent timeout on large reaction lists
    const limit = Math.min(unique.length, 5);
    for (let i = 0; i < limit; i++) {
      const id = unique[i];
      try {
        const r = await ddb.send(new GetCommand({
          TableName: USERS_TABLE,
          Key: { pk: `USER#${id}` },
          ProjectionExpression: 'pk, handle, userId, avatarKey, fullName',
          ConsistentRead: false, // Use eventually consistent for speed
        }));
        const it = r.Item;
        if (!it) continue;
        let uid = (it.userId && String(it.userId)) || '';
        if (!uid && typeof it.pk === 'string' && it.pk.startsWith('USER#')) {
          uid = it.pk.slice('USER#'.length);
        }
        if (!uid) continue;
        out.push({
          userId: uid,
          handle: it.handle || null,
          avatarKey: it.avatarKey || null,
          fullName: it.fullName || null,
        });
      } catch (err) {
        console.error(`[fetchUserSummaries] Fallback GetCommand failed for user ${id}:`, err);
        // Continue to next user instead of failing entirely
      }
    }
    if (unique.length > limit) {
      console.warn(`[fetchUserSummaries] Truncated fallback from ${unique.length} to ${limit} users to prevent timeout`);
    }
  }
  return out;
}

// Determine if 'requesterId' has a pending follow_request to 'targetId'
async function hasPendingFollow(requesterId, targetId) {
  try {
    if (!NOTIFICATIONS_TABLE || !requesterId || !targetId) return false;
    const q = await ddb.send(new QueryCommand({
      ConsistentRead: true,
      TableName: NOTIFICATIONS_TABLE,
      KeyConditionExpression: 'pk = :p',
      ExpressionAttributeValues: { ':p': `USER#${targetId}` },
      ScanIndexForward: false,
      Limit: 200,
    }));
    const items = q.Items || [];
    for (const it of items) {
      if (it.type === 'follow_request' && String(it.fromUserId) === String(requesterId)) {
        return true;
      }
    }
  } catch (e) { console.error('hasPendingFollow error', e); }
  return false;
}

// ---------- Handler ----------
module.exports.handler = async (event) => {
  __event = event; // capture for CORS headers everywhere

  // Always return 200 for preflight with CORS headers
  if ((event?.requestContext?.http?.method || event?.httpMethod) === 'OPTIONS') {
    return ok({});
  }

  const { method, rawPath, stage, path, route } = normalizePath(event);
  // Always log DELETE requests for debugging
  if (method === 'DELETE') {
    console.log('===== DELETE REQUEST =====', { method, rawPath, stage, normalized: path, route });
  } else {
    console.log('ROUTE', { method, rawPath, stage, normalized: path, route });
  }

  const claims = claimsFrom(event);
  const userId = claims.sub;
  const email  = (claims.email || '').toLowerCase();
  const usernameFallback = claims['cognito:username'] || email || userId || 'user';

  try {
    // ===== Notifications API =====
    if (route === 'GET /notifications') {
      if (!userId) return bad('Unauthorized', 401);
      if (!NOTIFICATIONS_TABLE) return bad('Notifications not enabled', 501);

      const r = await ddb.send(new QueryCommand({
        TableName: NOTIFICATIONS_TABLE,
        KeyConditionExpression: 'pk = :p',
        ExpressionAttributeValues: { ':p': `USER#${userId}` },
        ScanIndexForward: false,
        Limit: 50,
      }));

      // Optional markRead=1
      const markRead = event?.queryStringParameters?.markRead === '1';
      if (markRead) {
        for (const it of (r.Items || [])) {
          await ddb.send(new UpdateCommand({
            TableName: NOTIFICATIONS_TABLE,
            Key: { pk: `USER#${userId}`, sk: it.sk },
            UpdateExpression: 'SET #r = :t',
            ExpressionAttributeNames: { '#r': 'read' },
            ExpressionAttributeValues: { ':t': true },
          }));
        }
      }

      const items = r.Items || [];
      // Gather sender ids
      const fromIds = items.map(it => it.fromUserId).filter(Boolean);
      // Fetch handle+avatar for senders
      let summaries = [];
      try { summaries = await fetchUserSummaries(fromIds); } catch (_) {}
      const byId = Object.fromEntries(summaries.map(s => [String(s.userId), s]));

      const enriched = items.map(it => {
        const prof = byId[String(it.fromUserId)] || {};
        const handle = prof.handle || null;
        const userUrl = handle ? `/u/${handle}` : undefined;
        const postUrl = it.postId ? `/p/${encodeURIComponent(String(it.postId))}` : undefined;
        return {
          ...it,
          fromHandle: handle,
          avatarKey: prof.avatarKey || null,
          userUrl,
          postUrl,
        };
      });
      return ok({ items: enriched });

    }

    // NEW: Register push token
    if (route === 'POST /push/register') {
      if (!userId) return bad('Unauthorized', 401);
      if (!PUSH_TOKENS_TABLE) return bad('Push notifications not enabled', 501);

      const body = JSON.parse(event.body || '{}');
      const token = String(body.token || '').trim();
      const platform = String(body.platform || 'ios').toLowerCase();

      if (!token) return bad('Token required', 400);

      // Create a hash of the token to use as sort key (for deduplication)
      const tokenHash = crypto.createHash('sha256').update(token).digest('hex').slice(0, 16);

      try {
        await ddb.send(new PutCommand({
          TableName: PUSH_TOKENS_TABLE,
          Item: {
            pk: `USER#${userId}`,
            sk: `TOKEN#${platform}#${tokenHash}`,
            token: token,
            platform: platform,
            registeredAt: Date.now(),
            lastUsedAt: Date.now(),
          },
        }));

        console.log(`[Push] Registered token for user ${userId} on ${platform}`);
        return ok({ success: true, registered: true });
      } catch (err) {
        console.error('[Push] Failed to register token:', err);
        return bad('Failed to register push token', 500);
      }
    }

    // Request to follow -> notify target user
    if (route === 'POST /follow-request') {
      if (!userId) return bad('Unauthorized', 401);
      if (!NOTIFICATIONS_TABLE) return bad('Notifications not enabled', 501);
      const body = JSON.parse(event.body || '{}');
      const handle = String(body.handle || '').trim().toLowerCase();
      const targetId = await userIdFromHandle(handle);
      if (!targetId || targetId === userId) return bad('Invalid target', 400);
      // avoid duplicate follow request notifications
      if (await hasNotification(targetId, 'follow_request', userId, null)) return ok({ requested: true });
      await createNotification(targetId, 'follow_request', userId, null, 'wants to follow you');
      return ok({ requested: true });
    }

    // Cancel a previously-sent follow request (remove target's pending notification)
    if (route === 'POST /follow-cancel') {
      if (!userId) return bad('Unauthorized', 401);
      if (!NOTIFICATIONS_TABLE) return bad('Notifications not enabled', 501);
      const body = JSON.parse(event.body || '{}');
      const handle = String(body.handle || '').trim().toLowerCase();
      const targetId = await userIdFromHandle(handle);
      if (!targetId || targetId === userId) return bad('Invalid target', 400);
      try { await deleteNotifications(targetId, 'follow_request', userId, null); }
      catch (e) { console.error('follow-cancel deleteNotifications failed', e); }
      return ok({ cancelled: true });
    }

    // Accept request -> create follow row + notify requester
    if (route === 'POST /follow-accept') {
      if (!userId) return bad('Unauthorized', 401);
      if (!FOLLOWS_TABLE) return bad('Follows not enabled', 501);
      const body = JSON.parse(event.body || '{}');
      const requesterId = String(body.fromUserId || '');
      if (!requesterId) return bad('Missing requesterId', 400);
      await ddb.send(new PutCommand({
        TableName: FOLLOWS_TABLE,
        Item: { pk: requesterId, sk: userId },
      }));
      // remove pending request notification from my inbox
      try { await deleteNotifications(userId, 'follow_request', requesterId, null); } catch (e) { console.error('follow-accept cleanup failed', e); }
      // notify requester
      try { await createNotification(requesterId, 'follow_accept', userId, null, 'accepted your follow request'); } catch (e) {}
      return ok({ accepted: true });
    }

    // Decline a follow request
    if (route === 'POST /follow-decline') {
      if (!userId) return bad('Unauthorized', 401);
      if (!NOTIFICATIONS_TABLE) return bad('Notifications not enabled', 501);
      const body = JSON.parse(event.body || '{}');
      const requesterId = String(body.fromUserId || '');
      if (!requesterId) return bad('Missing requesterId', 400);
      // Remove the pending request notification from my inbox
      await deleteNotifications(userId, 'follow_request', requesterId, null);
      // Optional: notify requester of decline
      try { await createNotification(requesterId, 'follow_declined', userId, null, 'declined your follow request'); } catch (e) {}
      return ok({ declined: true });
    }


    // (A) Return current profile (add avatarKey + fullName + inviteCode so UI can show it)
    if (route === 'GET /me') {
      if (!userId) return ok({ message: 'Unauthorized' }, 401);
      const r = await ddb.send(new GetCommand({
        TableName: USERS_TABLE,
        Key: { pk: `USER#${userId}` },
        ConsistentRead: true,
      }));

      // Get invite code from user record, or generate if not present
      let inviteCode = r.Item?.inviteCode ?? null;
      if (!inviteCode) {
        try {
          inviteCode = await generateUserInviteCode(userId);
          // Store the invite code in the user record for future requests
          if (inviteCode) {
            await ddb.send(new UpdateCommand({
              TableName: USERS_TABLE,
              Key: { pk: `USER#${userId}` },
              UpdateExpression: 'SET inviteCode = :code',
              ExpressionAttributeValues: { ':code': inviteCode },
            }));
          }
        } catch (e) {
          console.error('[Invites] Failed to get invite code for user:', e);
        }
      }

      return ok({
        userId,
        handle: r.Item?.handle ?? null,
        email,
        avatarKey: r.Item?.avatarKey ?? null,
        fullName: r.Item?.fullName ?? null,
        termsAccepted: r.Item?.termsAccepted ?? false,
        inviteCode, // Include invite code in response
      });
    }

    // GET /me/notification-preferences - Get user's notification preferences
    if (route === 'GET /me/notification-preferences') {
      if (!userId) return bad('Unauthorized', 401);

      const prefs = await getUserNotificationPreferences(userId);
      return ok(prefs);
    }

    // PATCH /me/notification-preferences - Update user's notification preferences
    if (route === 'PATCH /me/notification-preferences') {
      if (!userId) return bad('Unauthorized', 401);

      const body = JSON.parse(event.body || '{}');

      // Validate preferences
      const validKeys = ['mentions', 'comments', 'reactions'];
      const updates = {};

      for (const key of validKeys) {
        if (key in body && typeof body[key] === 'boolean') {
          updates[key] = body[key];
        }
      }

      if (Object.keys(updates).length === 0) {
        return bad('No valid preferences provided', 400);
      }

      // Get current preferences
      const currentPrefs = await getUserNotificationPreferences(userId);

      // Merge with updates
      const newPrefs = { ...currentPrefs, ...updates };

      // Update in database
      await ddb.send(new UpdateCommand({
        TableName: USERS_TABLE,
        Key: { pk: `USER#${userId}` },
        UpdateExpression: 'SET notificationPreferences = :prefs',
        ExpressionAttributeValues: {
          ':prefs': newPrefs,
        },
      }));

      return ok(newPrefs);
    }

    // POST /me/accept-terms - Accept terms of service
    if (route === 'POST /me/accept-terms') {
      if (!userId) return bad('Unauthorized', 401);

      await ddb.send(new UpdateCommand({
        TableName: USERS_TABLE,
        Key: { pk: `USER#${userId}` },
        UpdateExpression: 'SET termsAccepted = :true, termsAcceptedAt = :now',
        ExpressionAttributeValues: {
          ':true': true,
          ':now': Date.now(),
        },
      }));

      return ok({ success: true, termsAccepted: true });
    }

    // NEW: GET /me/invite - Get user's invite code
    if (route === 'GET /me/invite') {
      if (!userId) return bad('Unauthorized', 401);
      if (!INVITES_TABLE) return bad('Invites not enabled', 501);

      const inviteCode = await generateUserInviteCode(userId);

      if (!inviteCode) {
        return bad('Failed to generate invite code', 500);
      }

      // Get remaining uses
      const invite = await ddb.send(new GetCommand({
        TableName: INVITES_TABLE,
        Key: { code: inviteCode },
        ConsistentRead: true,
      }));

      return ok({
        code: inviteCode,
        usesRemaining: invite.Item?.usesRemaining ?? 10,
        inviteCode, // Include both formats for frontend compatibility
      });
    }

    // NEW: POST /me/invite - Create/regenerate invite code
    if (route === 'POST /me/invite') {
      if (!userId) return bad('Unauthorized', 401);
      if (!INVITES_TABLE) return bad('Invites not enabled', 501);

      const body = JSON.parse(event.body || '{}');
      const uses = Math.max(1, Math.min(100, Number(body.uses || 10)));

      const inviteCode = await generateUserInviteCode(userId);

      if (!inviteCode) {
        return bad('Failed to generate invite code', 500);
      }

      return ok({
        code: inviteCode,
        uses,
        inviteCode, // Include both formats for frontend compatibility
      });
    }

    // NEW: GET /me/invites - List all user's invite codes
    if (route === 'GET /me/invites') {
      if (!userId) return bad('Unauthorized', 401);
      if (!INVITES_TABLE) return bad('Invites not enabled', 501);

      try {
        const result = await ddb.send(new QueryCommand({
          TableName: INVITES_TABLE,
          IndexName: 'byUserId',
          KeyConditionExpression: 'userId = :uid',
          ExpressionAttributeValues: { ':uid': userId },
          // Note: GSIs do not support ConsistentRead - only eventually consistent
        }));

        const items = (result.Items || []).map(it => ({
          code: it.code,
          usesRemaining: it.usesRemaining ?? 0,
          createdAt: it.createdAt ?? null,
        }));

        // If no invites exist, generate one
        if (items.length === 0) {
          const code = await generateUserInviteCode(userId);
          if (code) {
            return ok({
              items: [{
                code,
                usesRemaining: 10,
                createdAt: Date.now(),
              }],
              inviteCode: code, // Include for frontend compatibility
            });
          }
        }

        return ok({
          items,
          inviteCode: items[0]?.code ?? null, // Return first code for frontend compatibility
        });
      } catch (e) {
        console.error('[Invites] Failed to list user invites:', e);
        // Fallback: try to generate a new one
        const code = await generateUserInviteCode(userId);
        if (code) {
          return ok({
            items: [{ code, usesRemaining: 10, createdAt: Date.now() }],
            inviteCode: code,
          });
        }
        return bad('Failed to retrieve invites', 500);
      }
    }

    // (A2) Update fields on me (currently: fullName)
    if (route === 'PATCH /me') {
      if (!userId) return ok({ message: 'Unauthorized' }, 401);
      const body = JSON.parse(event.body || '{}');

      // Parse fullName
      const rawFullName = (body.fullName ?? '').toString().trim();
      const fullName = rawFullName ? rawFullName.slice(0, 80) : null;

      // Parse handle (from any format the client sends)
      const rawHandle = (body.handle || body.username || body.user_handle || body.user_name || '').toString().trim().toLowerCase();
      const handle = rawHandle ? rawHandle.slice(0, 20) : null;

      // Validate handle format if provided
      if (handle && !/^[a-z0-9_]{3,20}$/.test(handle)) {
        return bad('Handle must be 3-20 chars, letters/numbers/underscore', 400);
      }

      // Check if handle is taken (if trying to set a new one)
      if (handle) {
        const existing = await ddb.send(new GetCommand({
          TableName: USERS_TABLE,
          Key: { pk: `HANDLE#${handle}` },
          ConsistentRead: true,
        }));
        // Allow if it's their own handle or if it's not taken
        if (existing.Item && existing.Item.userId !== userId) {
          return bad('Handle already taken', 409);
        }
      }

      // Build UpdateExpression dynamically
      const updates = ['#uid = :u'];
      const names = { '#uid': 'userId' };
      const values = { ':u': userId };

      if ('fullName' in body) {
        updates.push('#fn = :fn');
        names['#fn'] = 'fullName';
        values[':fn'] = fullName;
      }

      if (handle) {
        updates.push('#h = :h');
        names['#h'] = 'handle';
        values[':h'] = handle;
      }

      // Update USER record
      await ddb.send(new UpdateCommand({
        TableName: USERS_TABLE,
        Key: { pk: `USER#${userId}` },
        UpdateExpression: `SET ${updates.join(', ')}`,
        ExpressionAttributeNames: names,
        ExpressionAttributeValues: values,
      }));

      // Update HANDLE mapping if handle changed
      if (handle) {
        await ddb.send(new PutCommand({
          TableName: USERS_TABLE,
          Item: {
            pk: `HANDLE#${handle}`,
            userId,
            type: 'HANDLE',
            handle,
          },
        }));
      }

      return ok({ ok: true, fullName, handle });
    }

    // (A3) Allow POST /me as alias for updating fullName
    if (route === 'POST /me') {
      if (!userId) return ok({ message: 'Unauthorized' }, 401);
      const body = JSON.parse(event.body || '{}');
      const raw = (body.fullName ?? '').toString().trim();
      const fullName = raw ? raw.slice(0, 80) : null;
      await ddb.send(new UpdateCommand({
        TableName: USERS_TABLE,
        Key: { pk: `USER#${userId}` },
        UpdateExpression: 'SET #uid = :u, #fn = :n',
        ExpressionAttributeNames: { '#uid': 'userId', '#fn': 'fullName' },
        ExpressionAttributeValues: { ':u': userId, ':n': fullName },
      }));
      return ok({ ok: true, fullName });
    }

    // (B) Set avatar for current user (client uploads to S3 -> sends { key })
    // FIX: Use UpdateCommand instead of PutCommand to preserve other user fields
    if (route === 'POST /me/avatar') {
      if (!userId) return ok({ message: 'Unauthorized' }, 401);
      const { key } = JSON.parse(event.body || '{}');
      if (!key) return ok({ message: 'Missing key' }, 400);

      // FIX: Use UpdateCommand to only update avatarKey field, preserving fullName, handle, etc.
      await ddb.send(new UpdateCommand({
        TableName: USERS_TABLE,
        Key: { pk: `USER#${userId}` },
        UpdateExpression: 'SET avatarKey = :key, userId = :uid',
        ExpressionAttributeValues: { ':key': key, ':uid': userId },
      }));

      // Also update the HANDLE mapping if user has a handle
      const u = await ddb.send(new GetCommand({ TableName: USERS_TABLE, Key: { pk: `USER#${userId}` } }));
      if (u.Item?.handle) {
        await ddb.send(new UpdateCommand({
          TableName: USERS_TABLE,
          Key: { pk: `HANDLE#${u.Item.handle}` },
          UpdateExpression: 'SET avatarKey = :key, userId = :uid',
          ExpressionAttributeValues: { ':key': key, ':uid': userId },
        }));
      }
      return ok({ success: true, avatarKey: key });
    }

    // DELETE /me - Delete user account and all associated data
    if (route === 'DELETE /me') {
      console.log(`===== MATCHED DELETE /me ENDPOINT =====`);
      if (!userId) return bad('Unauthorized', 401);

      console.log(`[DELETE /me] Starting account deletion for user ${userId}`);

      try {
        // Get user's handle before deletion
        const userRecord = await ddb.send(new GetCommand({
          TableName: USERS_TABLE,
          Key: { pk: `USER#${userId}` },
          ConsistentRead: true,
        }));
        const userHandle = userRecord.Item?.handle || null;

        // 1. Delete all user's posts
        console.log(`[DELETE /me] Deleting posts for user ${userId}`);
        try {
          const postsResult = await ddb.send(new QueryCommand({
            TableName: POSTS_TABLE,
            KeyConditionExpression: 'pk = :p',
            ExpressionAttributeValues: { ':p': `USER#${userId}` },
            ConsistentRead: true,
          }));

          for (const post of (postsResult.Items || [])) {
            await ddb.send(new DeleteCommand({
              TableName: POSTS_TABLE,
              Key: { pk: post.pk, sk: post.sk },
            }));
          }
          console.log(`[DELETE /me] Deleted ${(postsResult.Items || []).length} posts`);
        } catch (e) {
          console.error('[DELETE /me] Failed to delete posts:', e);
        }

        // 2. Delete all user's comments
        console.log(`[DELETE /me] Deleting comments for user ${userId}`);
        try {
          if (COMMENTS_TABLE) {
            // Scan for all comments by this user
            const commentsResult = await ddb.send(new ScanCommand({
              TableName: COMMENTS_TABLE,
              FilterExpression: 'userId = :uid',
              ExpressionAttributeValues: { ':uid': userId },
              ConsistentRead: true,
            }));

            for (const comment of (commentsResult.Items || [])) {
              await ddb.send(new DeleteCommand({
                TableName: COMMENTS_TABLE,
                Key: { pk: comment.pk, sk: comment.sk },
              }));
            }
            console.log(`[DELETE /me] Deleted ${(commentsResult.Items || []).length} comments`);
          }
        } catch (e) {
          console.error('[DELETE /me] Failed to delete comments:', e);
        }

        // 3. Delete all user's reactions
        console.log(`[DELETE /me] Deleting reactions for user ${userId}`);
        try {
          if (REACTIONS_TABLE) {
            // Scan for all reactions by this user
            const reactionsResult = await ddb.send(new ScanCommand({
              TableName: REACTIONS_TABLE,
              FilterExpression: 'sk = :sk',
              ExpressionAttributeValues: { ':sk': `USER#${userId}` },
              ConsistentRead: true,
            }));

            for (const reaction of (reactionsResult.Items || [])) {
              // Decrement the count for this emoji
              if (reaction.emoji) {
                try {
                  await ddb.send(new UpdateCommand({
                    TableName: REACTIONS_TABLE,
                    Key: { pk: reaction.pk, sk: `COUNT#${reaction.emoji}` },
                    UpdateExpression: 'ADD #c :neg',
                    ExpressionAttributeNames: { '#c': 'count' },
                    ExpressionAttributeValues: { ':neg': -1 },
                  }));
                } catch (e) {
                  console.error('[DELETE /me] Failed to decrement reaction count:', e);
                }
              }

              // Delete the user's reaction record
              await ddb.send(new DeleteCommand({
                TableName: REACTIONS_TABLE,
                Key: { pk: reaction.pk, sk: reaction.sk },
              }));
            }
            console.log(`[DELETE /me] Deleted ${(reactionsResult.Items || []).length} reactions`);
          }
        } catch (e) {
          console.error('[DELETE /me] Failed to delete reactions:', e);
        }

        // 4. Delete all follow relationships (both following and followers)
        console.log(`[DELETE /me] Deleting follow relationships for user ${userId}`);
        try {
          if (FOLLOWS_TABLE) {
            // Delete users this user is following
            const followingResult = await ddb.send(new QueryCommand({
              TableName: FOLLOWS_TABLE,
              KeyConditionExpression: 'pk = :p',
              ExpressionAttributeValues: { ':p': userId },
              ConsistentRead: true,
            }));

            for (const follow of (followingResult.Items || [])) {
              await ddb.send(new DeleteCommand({
                TableName: FOLLOWS_TABLE,
                Key: { pk: follow.pk, sk: follow.sk },
              }));
            }

            // Delete users following this user
            const followersResult = await ddb.send(new ScanCommand({
              TableName: FOLLOWS_TABLE,
              FilterExpression: 'sk = :sk',
              ExpressionAttributeValues: { ':sk': userId },
              ConsistentRead: true,
            }));

            for (const follower of (followersResult.Items || [])) {
              await ddb.send(new DeleteCommand({
                TableName: FOLLOWS_TABLE,
                Key: { pk: follower.pk, sk: follower.sk },
              }));
            }
            console.log(`[DELETE /me] Deleted follow relationships`);
          }
        } catch (e) {
          console.error('[DELETE /me] Failed to delete follows:', e);
        }

        // 5. Delete all notifications (both sent to user and from user)
        console.log(`[DELETE /me] Deleting notifications for user ${userId}`);
        try {
          if (NOTIFICATIONS_TABLE) {
            // Delete notifications sent TO this user
            const notificationsResult = await ddb.send(new QueryCommand({
              TableName: NOTIFICATIONS_TABLE,
              KeyConditionExpression: 'pk = :p',
              ExpressionAttributeValues: { ':p': `USER#${userId}` },
              ConsistentRead: true,
            }));

            for (const notification of (notificationsResult.Items || [])) {
              await ddb.send(new DeleteCommand({
                TableName: NOTIFICATIONS_TABLE,
                Key: { pk: notification.pk, sk: notification.sk },
              }));
            }

            // Delete notifications sent FROM this user to others
            const sentNotificationsResult = await ddb.send(new ScanCommand({
              TableName: NOTIFICATIONS_TABLE,
              FilterExpression: 'fromUserId = :uid',
              ExpressionAttributeValues: { ':uid': userId },
              ConsistentRead: true,
            }));

            for (const notification of (sentNotificationsResult.Items || [])) {
              await ddb.send(new DeleteCommand({
                TableName: NOTIFICATIONS_TABLE,
                Key: { pk: notification.pk, sk: notification.sk },
              }));
            }
            console.log(`[DELETE /me] Deleted notifications`);
          }
        } catch (e) {
          console.error('[DELETE /me] Failed to delete notifications:', e);
        }

        // 6. Delete all invites created by user
        console.log(`[DELETE /me] Deleting invites for user ${userId}`);
        try {
          if (INVITES_TABLE) {
            // Query using GSI if available, otherwise scan
            try {
              const invitesResult = await ddb.send(new QueryCommand({
                TableName: INVITES_TABLE,
                IndexName: 'byUserId',
                KeyConditionExpression: 'userId = :uid',
                ExpressionAttributeValues: { ':uid': userId },
              }));

              for (const invite of (invitesResult.Items || [])) {
                await ddb.send(new DeleteCommand({
                  TableName: INVITES_TABLE,
                  Key: { code: invite.code },
                }));
              }
              console.log(`[DELETE /me] Deleted ${(invitesResult.Items || []).length} invites`);
            } catch (e) {
              // Fallback to scan if GSI not available
              console.log('[DELETE /me] GSI not available, using scan for invites');
              const invitesResult = await ddb.send(new ScanCommand({
                TableName: INVITES_TABLE,
                FilterExpression: 'userId = :uid',
                ExpressionAttributeValues: { ':uid': userId },
                ConsistentRead: true,
              }));

              for (const invite of (invitesResult.Items || [])) {
                await ddb.send(new DeleteCommand({
                  TableName: INVITES_TABLE,
                  Key: { code: invite.code },
                }));
              }
              console.log(`[DELETE /me] Deleted ${(invitesResult.Items || []).length} invites (via scan)`);
            }
          }
        } catch (e) {
          console.error('[DELETE /me] Failed to delete invites:', e);
        }

        // 7. Delete user records from users table
        console.log(`[DELETE /me] Deleting user records for user ${userId}`);
        try {
          // Delete USER# record
          await ddb.send(new DeleteCommand({
            TableName: USERS_TABLE,
            Key: { pk: `USER#${userId}` },
          }));

          // Delete HANDLE# record if user has a handle
          if (userHandle) {
            await ddb.send(new DeleteCommand({
              TableName: USERS_TABLE,
              Key: { pk: `HANDLE#${userHandle}` },
            }));
          }
          console.log(`[DELETE /me] Deleted user records`);
        } catch (e) {
          console.error('[DELETE /me] Failed to delete user records:', e);
        }

        // 8. Delete user from Cognito
        console.log(`[DELETE /me] Deleting user from Cognito: ${userId}`);
        try {
          if (USER_POOL_ID) {
            await cognito.send(new AdminDeleteUserCommand({
              UserPoolId: USER_POOL_ID,
              Username: userId,
            }));
            console.log(`[DELETE /me] Deleted user from Cognito`);
          } else {
            console.warn('[DELETE /me] USER_POOL_ID not set, skipping Cognito deletion');
          }
        } catch (e) {
          console.error('[DELETE /me] Failed to delete user from Cognito:', e);
          // Continue even if Cognito deletion fails
        }

        console.log(`[DELETE /me] Account deletion completed for user ${userId}`);
        return ok({ success: true, message: 'Account deleted successfully' });

      } catch (err) {
        console.error('[DELETE /me] Error during account deletion:', err);
        return bad('Failed to delete account', 500);
      }
    }

  // GET /posts/{id}/comments
  if (method === 'GET' && path.startsWith('/comments/')) {
  if (!COMMENTS_TABLE) return ok({ message: 'Comments not enabled' }, 501);
  const postId = path.split('/')[2];
  const r = await ddb.send(new QueryCommand({
    TableName: COMMENTS_TABLE,
    KeyConditionExpression: 'pk = :p',
    ExpressionAttributeValues: { ':p': `POST#${postId}` },
    ScanIndexForward: true,
    Limit: 50
  }));

  const items = (r.Items || []).map(it => ({
    id: it.id,
    userId: it.userId,
    userHandle: it.userHandle || 'unknown',
    text: it.text || '',
    createdAt: it.createdAt || 0,
    parentCommentId: it.parentCommentId || null,
  }));

  // Fetch avatarKey for each comment author
  try {
    const userIds = [...new Set(items.map(it => it.userId).filter(Boolean))];
    if (userIds.length > 0) {
      const summaries = await fetchUserSummaries(userIds);
      const avatarMap = Object.fromEntries(
        summaries.map(u => [u.userId, u.avatarKey || null])
      );

      // Add avatarKey to each comment
      for (const item of items) {
        if (item.userId && avatarMap[item.userId]) {
          item.avatarKey = avatarMap[item.userId];
        }
      }
    }
  } catch (e) {
    console.error('Failed to fetch comment avatars:', e);
  }

  return ok({ items });
}

    // POST /posts/{id}/comments  body: { text, parentCommentId? }
    if (method === 'POST' && path.startsWith('/comments/')) {
      if (!COMMENTS_TABLE) return ok({ message: 'Comments not enabled' }, 501);
      if (!userId) return ok({ message: 'Unauthorized' }, 401);
      const postId = path.split('/')[2];
      const body = JSON.parse(event.body || '{}');
      const text = String(body.text || '').trim().slice(0, 500);
      const parentCommentId = body.parentCommentId || null;
      if (!text) return ok({ message: 'Text required' }, 400);

      // Verify the post exists and user has permission to comment
      let post = null;
      try {
        const postQuery = await ddb.send(new QueryCommand({
          TableName: POSTS_TABLE,
          IndexName: 'byId',
          KeyConditionExpression: 'id = :id',
          ExpressionAttributeValues: { ':id': postId },
          Limit: 1,
        }));
        post = (postQuery.Items || [])[0];
        if (!post) {
          return ok({ message: 'Post not found' }, 404);
        }

        // Check if user has permission to comment on this post
        // Allow if:
        // 1) user owns the post
        // 2) user follows the post author
        // 3) user is mentioned in the post
        // 4) user already has comments on this post (already participating)
        const isOwnPost = post.userId === userId;
        const followsAuthor = await isFollowing(userId, post.userId);

        // Check if user is mentioned in the post
        const postText = post.text || '';
        const handle = await getHandleForUserId(userId);
        const isMentioned = handle && postText.toLowerCase().includes(`@${handle.toLowerCase()}`);

        // Check if user already has comments on this post
        let isParticipating = false;
        if (!isOwnPost && !followsAuthor && !isMentioned) {
          const existingComments = await ddb.send(new QueryCommand({
            TableName: COMMENTS_TABLE,
            KeyConditionExpression: 'pk = :pk',
            FilterExpression: 'userId = :userId',
            ExpressionAttributeValues: {
              ':pk': `POST#${postId}`,
              ':userId': userId
            },
            Limit: 1
          }));
          isParticipating = (existingComments.Items || []).length > 0;
        }

        if (!isOwnPost && !followsAuthor && !isMentioned && !isParticipating) {
          return ok({ message: 'You must follow this user to comment on their posts' }, 403);
        }
      } catch (e) {
        console.error('Failed to verify post access:', e);
        return ok({ message: 'Failed to verify post access' }, 500);
      }

      // If replying to a comment, verify parent exists and get its author
      let parentComment = null;
      if (parentCommentId) {
        try {
          // Query all comments for this post and find the parent by id
          // Note: FilterExpression with Limit doesn't work as expected - it limits first, then filters
          const qr = await ddb.send(new QueryCommand({
            TableName: COMMENTS_TABLE,
            KeyConditionExpression: 'pk = :pk',
            ExpressionAttributeValues: {
              ':pk': `POST#${postId}`
            }
          }));
          const allComments = qr.Items || [];
          parentComment = allComments.find(c => c.id === parentCommentId);
          if (!parentComment) {
            return ok({ message: 'Parent comment not found' }, 404);
          }
        } catch (e) {
          console.error('Failed to fetch parent comment:', e);
          return ok({ message: 'Failed to verify parent comment' }, 500);
        }
      }

      // Moderate comment content using Amazon Bedrock
      const moderation = await moderateContent(text);
      if (!moderation.safe) {
        console.log(`[Moderation] Comment blocked for user ${userId}: ${moderation.reason}`);
        return bad(`Content blocked: ${moderation.reason || 'Content violates our community guidelines'}`, 403);
      }

      const handle = await getHandleForUserId(userId) || 'unknown';
      const now = Date.now();
      const id = randomUUID();
      const item = {
        pk: `POST#${postId}`,
        sk: `C#${now}#${id}`,
        id,
        postId,
        userId,
        userHandle: handle,
        text,
        createdAt: now
      };

      // Add parentCommentId if this is a reply
      if (parentCommentId) {
        item.parentCommentId = parentCommentId;
      }

      await ddb.send(new PutCommand({ TableName: COMMENTS_TABLE, Item: item }));

      // NEW: notify parent comment author if this is a reply, otherwise notify post owner
      if (parentComment && parentComment.userId && parentComment.userId !== userId) {
        try {
          await createNotification(parentComment.userId, 'reply', userId, postId, 'replied to your comment');
        } catch (e) { console.error('notify parent comment author failed', e); }
      } else if (!parentCommentId) {
        try {
          // find post owner by GSI byId
          const qr = await ddb.send(new QueryCommand({
            TableName: POSTS_TABLE,
            IndexName: 'byId',
            KeyConditionExpression: 'id = :id',
            ExpressionAttributeValues: { ':id': postId },
            Limit: 1,
          }));
          const post = (qr.Items || [])[0];
          if (post && post.userId && post.userId !== userId) {
            await createNotification(post.userId, 'comment', userId, postId, 'commented on your post');
          }
        } catch (e) { console.error('notify comment post owner failed', e); }
      }

      try {
        const mentionRegex = /@([a-z0-9_]+)/gi;
        const mentions = [...text.matchAll(mentionRegex)].map(m => m[1].toLowerCase());
        for (const h of mentions) {
          const mid = await userIdFromHandle(h);
          if (mid && mid !== userId) {
            await createNotification(mid, 'mention', userId, postId, 'mentioned you in a comment');
          }
        }
      } catch (e) { console.error('notify mentions (comment) failed', e); }

      const response = { id, userHandle: handle, text, createdAt: now };
      if (parentCommentId) {
        response.parentCommentId = parentCommentId;
      }
      return ok(response);
    }

    // PATCH /comments/{postId}  body: { id, text }
    if (method === 'PATCH' && path.startsWith('/comments/')) {
      if (!COMMENTS_TABLE) return ok({ message: 'Comments not enabled' }, 501);
      if (!userId) return ok({ message: 'Unauthorized' }, 401);
      const postId = path.split('/')[2];
      const body = JSON.parse(event.body || '{}');
      const id = String(body.id || '').trim();
      const text = String(body.text || '').trim().slice(0, 500);
      if (!id || !text) return ok({ message: 'id and text required' }, 400);

      const qr = await ddb.send(new QueryCommand({
        TableName: COMMENTS_TABLE,
        KeyConditionExpression: 'pk = :p AND begins_with(sk, :c)',
        ExpressionAttributeValues: { ':p': `POST#${postId}`, ':c': 'C#' },
        ConsistentRead: true,
        Limit: 200
      }));
      const item = (qr.Items || []).find(i => i.id === id);
      if (!item) return ok({ message: 'Comment not found' }, 404);
      if (item.userId !== userId) return ok({ message: 'Forbidden' }, 403);

      await ddb.send(new UpdateCommand({
        TableName: COMMENTS_TABLE,
        Key: { pk: item.pk, sk: item.sk },
        UpdateExpression: 'SET #t = :t',
        ExpressionAttributeNames: { '#t': 'text' },
        ExpressionAttributeValues: { ':t': text },
        ConditionExpression: 'attribute_exists(pk) AND attribute_exists(sk)'
      }));

      return ok({ success: true });
    }

    // DELETE /comments/{postId}  body: { id }
    if (method === 'DELETE' && path.startsWith('/comments/')) {
      if (!COMMENTS_TABLE) return ok({ message: 'Comments not enabled' }, 501);
      if (!userId) return ok({ message: 'Unauthorized' }, 401);
      const postId = path.split('/')[2];
      const body = JSON.parse(event.body || '{}');
      const id = String(body.id || '').trim();
      if (!id) return ok({ message: 'id required' }, 400);

      const qr = await ddb.send(new QueryCommand({
        TableName: COMMENTS_TABLE,
        KeyConditionExpression: 'pk = :p AND begins_with(sk, :c)',
        ExpressionAttributeValues: { ':p': `POST#${postId}`, ':c': 'C#' },
        ConsistentRead: true,
        Limit: 200
      }));
      const item = (qr.Items || []).find(i => i.id === id);
      if (!item) return ok({ message: 'Comment not found' }, 404);
      if (item.userId !== userId) return ok({ message: 'Forbidden' }, 403);

      // First, cascade-delete all replies to this comment
      try {
        const repliesQr = await ddb.send(new QueryCommand({
          TableName: COMMENTS_TABLE,
          KeyConditionExpression: 'pk = :p',
          FilterExpression: 'parentCommentId = :parentId',
          ExpressionAttributeValues: {
            ':p': `POST#${postId}`,
            ':parentId': id
          },
          Limit: 100
        }));

        const replies = repliesQr.Items || [];
        for (const reply of replies) {
          // Delete each reply
          await ddb.send(new DeleteCommand({
            TableName: COMMENTS_TABLE,
            Key: { pk: reply.pk, sk: reply.sk }
          }));

          // Delete notifications from each reply
          try {
            const replyText = String(reply.text || '');
            const mentionRegex = /@([a-z0-9_]+)/gi;
            const mentions = [...replyText.matchAll(mentionRegex)].map(m => m[1].toLowerCase());
            for (const h of mentions) {
              const mid = await userIdFromHandle(h);
              if (mid && mid !== reply.userId) {
                await deleteNotifications(mid, 'mention', reply.userId, postId);
              }
            }
          } catch (e) { console.error('cleanup reply mention notifs failed', e); }
        }
      } catch (e) { console.error('cascade delete replies failed', e); }

      // Delete the comment itself
      await ddb.send(new DeleteCommand({
        TableName: COMMENTS_TABLE,
        Key: { pk: item.pk, sk: item.sk },
        ConditionExpression: 'attribute_exists(pk) AND attribute_exists(sk)'
      }));

      // Cascade-delete notifications created by this comment
      try {
        // If this is a reply, remove the 'reply' notification to parent comment author
        if (item.parentCommentId) {
          try {
            // Find parent comment to get its author
            const parentQr = await ddb.send(new QueryCommand({
              TableName: COMMENTS_TABLE,
              KeyConditionExpression: 'pk = :p',
              FilterExpression: 'id = :id',
              ExpressionAttributeValues: {
                ':p': `POST#${postId}`,
                ':id': item.parentCommentId
              },
              Limit: 1
            }));
            const parentComment = (parentQr.Items || [])[0];
            if (parentComment && parentComment.userId && parentComment.userId !== userId) {
              await deleteNotifications(parentComment.userId, 'reply', userId, postId);
            }
          } catch (e) { console.error('cleanup reply notif failed', e); }
        } else {
          // (a) Remove post owner's 'comment' notification from this commenter
          try {
            const qrPost = await ddb.send(new QueryCommand({
              TableName: POSTS_TABLE,
              IndexName: 'byId',
              KeyConditionExpression: 'id = :id',
              ExpressionAttributeValues: { ':id': postId },
              Limit: 1,
            }));
            const post = (qrPost.Items || [])[0];
            if (post && post.userId && post.userId !== userId) {
              await deleteNotifications(post.userId, 'comment', userId, postId);
            }
          } catch (e) { console.error('cleanup comment notif (owner) failed', e); }
        }

        // (b) Remove mention notifications that originated from this comment
        try {
          const text = String(item.text || '');
          const mentionRegex = /@([a-z0-9_]+)/gi;
          const mentions = [...text.matchAll(mentionRegex)].map(m => m[1].toLowerCase());
          for (const h of mentions) {
            const mid = await userIdFromHandle(h);
            if (mid && mid !== userId) {
              await deleteNotifications(mid, 'mention', userId, postId);
            }
          }
        } catch (e) { console.error('cleanup comment notif (mentions) failed', e); }
      } catch (e) { console.error('cleanup notifications on comment delete failed', e); }

      return ok({ success: true });
    }

    // GET /posts/{id}/reactions  -> counts + mine (+who optional)
    if (method === 'GET' && path.startsWith('/reactions/')) {
      if (!REACTIONS_TABLE) return ok({ message: 'Reactions not enabled' }, 501);
      const postId = path.split('/')[2];
      const startTime = Date.now();

      try {
        const qr = await ddb.send(new QueryCommand({
          TableName: REACTIONS_TABLE,
          KeyConditionExpression: 'pk = :p',
          ExpressionAttributeValues: { ':p': `POST#${postId}` },
          ProjectionExpression: 'sk, #c, emoji',
          ExpressionAttributeNames: { '#c': 'count' },
          ConsistentRead: false, // Use eventually consistent for better performance
        }));
        const counts = {};
        let mine = null;
        for (const it of (qr.Items || [])) {
          if (typeof it.sk === 'string' && it.sk.startsWith('COUNT#')) {
            const emoji = it.sk.slice('COUNT#'.length);
            counts[emoji] = Number(it.count || 0);
          } else if (userId && it.sk === `USER#${userId}`) {
            mine = it.emoji || null;
          }
        }

        // Fallback query for current user's reaction if not found
        if (userId && mine === null) {
          try {
            const ur = await ddb.send(new GetCommand({
              TableName: REACTIONS_TABLE,
              Key: { pk: `POST#${postId}`, sk: `USER#${userId}` },
              ProjectionExpression: 'emoji',
              ConsistentRead: false, // Use eventually consistent for better performance
            }));
            mine = ur.Item?.emoji || null;
          } catch (err) {
            console.error('[GET /reactions] Fallback user reaction query failed:', err);
            // Continue with mine=null instead of failing entire request
          }
        }

        const wantWho = (event?.queryStringParameters?.who === '1');
        let who = undefined;
        if (wantWho) {
          try {
            const uqr = await ddb.send(new QueryCommand({
              TableName: REACTIONS_TABLE,
              KeyConditionExpression: 'pk = :p AND begins_with(sk, :u)',
              ExpressionAttributeValues: { ':p': `POST#${postId}`, ':u': 'USER#' },
              ProjectionExpression: 'sk, emoji',
              ConsistentRead: false, // Use eventually consistent for better performance
            }));
            const byEmoji = {};
            const uids = [];
            for (const row of (uqr.Items || [])) {
              const uid = String(row.sk).slice('USER#'.length);
              const e = row.emoji || '';
              if (!e) continue;
              (byEmoji[e] ||= []).push(uid);
              uids.push(uid);
            }

            // Graceful degradation: if user profile fetch fails, return reactions without user details
            try {
              const profiles = await fetchUserSummaries(uids);
              const map = Object.fromEntries((profiles || []).map(p => [p.userId, p]));
              who = {};
              for (const [e, ids] of Object.entries(byEmoji)) {
                who[e] = ids.map(uid => ({
                  userId: uid,
                  handle: map[uid]?.handle || null,
                  avatarKey: map[uid]?.avatarKey || null,
                }));
              }
            } catch (err) {
              console.error('[GET /reactions] Failed to fetch user summaries:', err);
              // Return reaction data without user profiles instead of failing
              who = {};
              for (const [e, ids] of Object.entries(byEmoji)) {
                who[e] = ids.map(uid => ({ userId: uid, handle: null, avatarKey: null }));
              }
            }
          } catch (err) {
            console.error('[GET /reactions] Who query failed:', err);
            // Return without "who" data instead of failing entire request
            who = undefined;
          }
        }

        const duration = Date.now() - startTime;
        console.log(`[GET /reactions/${postId}] Completed in ${duration}ms`);
        return ok({ counts, my: mine ? [mine] : [], ...(wantWho ? { who } : {}) });

      } catch (err) {
        console.error('[GET /reactions] Main query failed:', err);
        // Return empty reactions instead of 500 error
        return ok({ counts: {}, my: [], message: 'Failed to fetch reactions' });
      }
    }

    // POST /posts/{id}/reactions  body: { emoji, action:'toggle' }
    if (method === 'POST' && path.startsWith('/reactions/')) {
      if (!REACTIONS_TABLE) return ok({ message: 'Reactions not enabled' }, 501);
      if (!userId) return ok({ message: 'Unauthorized' }, 401);
      const postId = path.split('/')[2];
      const body = JSON.parse(event.body || '{}');
      const raw = String(body.emoji || '').trim();
      const emoji = raw.slice(0, 8);
      if (!emoji) return ok({ message: 'Invalid emoji' }, 400);

      // Clean up any prior 'reaction' notifications from this user for this post (covers un-react & switches)
      try {
        const qr0 = await ddb.send(new QueryCommand({
          TableName: POSTS_TABLE,
          IndexName: 'byId',
          KeyConditionExpression: 'id = :id',
          ExpressionAttributeValues: { ':id': postId },
          Limit: 1,
        }));
        const post0 = (qr0.Items || [])[0];
        if (post0 && post0.userId && post0.userId !== userId) {
          await deleteNotifications(post0.userId, 'reaction', userId, postId);
        }
      } catch (e) { console.error('cleanup prior reaction notif failed', e); }

      const current = await ddb.send(new GetCommand({
        TableName: REACTIONS_TABLE,
        Key: { pk: `POST#${postId}`, sk: `USER#${userId}` },
        ProjectionExpression: 'emoji',
        ConsistentRead: true
      }));
      const prev = current.Item?.emoji || null;

      if (prev && prev === emoji) {
        // User is REMOVING their reaction - decrement count and delete
        await ddb.send(new UpdateCommand({
          TableName: REACTIONS_TABLE,
          Key: { pk: `POST#${postId}`, sk: `COUNT#${emoji}` },
          UpdateExpression: 'ADD #c :neg',
          ExpressionAttributeNames: { '#c': 'count' },
          ExpressionAttributeValues: { ':neg': -1 },
        }));
        await ddb.send(new DeleteCommand({
          TableName: REACTIONS_TABLE,
          Key: { pk: `POST#${postId}`, sk: `USER#${userId}` },
        }));
        // NOTE: No notification sent for reaction removal
      } else {
        // User is ADDING a new reaction or CHANGING to a different emoji
        await ddb.send(new UpdateCommand({
          TableName: REACTIONS_TABLE,
          Key: { pk: `POST#${postId}`, sk: `COUNT#${emoji}` },
          UpdateExpression: 'ADD #c :one',
          ExpressionAttributeNames: { '#c': 'count' },
          ExpressionAttributeValues: { ':one': 1 },
        }));
        if (prev) {
          await ddb.send(new UpdateCommand({
            TableName: REACTIONS_TABLE,
            Key: { pk: `POST#${postId}`, sk: `COUNT#${prev}` },
            UpdateExpression: 'ADD #c :neg',
            ExpressionAttributeNames: { '#c': 'count' },
            ExpressionAttributeValues: { ':neg': -1 },
          }));
        }
        await ddb.send(new PutCommand({
          TableName: REACTIONS_TABLE,
          Item: { pk: `POST#${postId}`, sk: `USER#${userId}`, emoji },
        }));

        // Notify post owner about NEW reaction (only when adding, not removing)
        try {
          const qr = await ddb.send(new QueryCommand({
            TableName: POSTS_TABLE,
            IndexName: 'byId',
            KeyConditionExpression: 'id = :id',
            ExpressionAttributeValues: { ':id': postId },
            Limit: 1,
          }));
          const post = (qr.Items || [])[0];
          if (post && post.userId && post.userId !== userId) {
            await createNotification(post.userId, 'reaction', userId, postId, 'reacted to your post');
          }
        } catch (e) { console.error('notify reaction post owner failed', e); }
      }

      // Return the caller's current reaction so the UI can refresh accurately
      const self = await ddb.send(new GetCommand({
        TableName: REACTIONS_TABLE,
        Key: { pk: `POST#${postId}`, sk: `USER#${userId}` },
        ProjectionExpression: 'emoji',
        ConsistentRead: true
      }));
      return ok({ ok: true, my: self.Item?.emoji ? [self.Item.emoji] : [] });
    }

    // ----- /username -----
    if (route === 'POST /username') {
      if (!userId) return bad('Unauthorized', 401);
      const body = JSON.parse(event.body || '{}');
      const candidate = String(body.handle || '').trim().toLowerCase();
      if (!/^[a-z0-9_]{3,20}$/.test(candidate)) {
        return bad('Handle must be 3-20 chars, letters/numbers/underscore', 400);
      }

      const taken = await ddb.send(new GetCommand({
        TableName: USERS_TABLE,
        Key: { pk: `HANDLE#${candidate}` },
        ConsistentRead: true,
      }));
      if (taken.Item) return bad('Handle already taken', 409);

      await ddb.send(new PutCommand({
        TableName: USERS_TABLE,
        Item: { pk: `HANDLE#${candidate}`, userId },
        ConditionExpression: 'attribute_not_exists(pk)',
      }));

      await ddb.send(new PutCommand({
        TableName: USERS_TABLE,
        Item: { pk: `USER#${userId}`, handle: candidate, type: 'HANDLE', userId },
        ConditionExpression: 'attribute_not_exists(pk)',
      }));

      return ok({ handle: candidate });
    }

    // ----- /feed (prefer following; also include my own posts; fallback to global) -----
    if (route === 'GET /feed') {
      if (!userId) return bad('Unauthorized', 401);

      const qs = event?.queryStringParameters || {};
      const limit = Math.min(parseInt(qs.limit) || 20, 100); // Default 20, max 100
      const offset = Math.max(parseInt(qs.offset) || 0, 0);

      try {
        if (FOLLOWS_TABLE) {
          const following = await ddb.send(new QueryCommand({
            TableName: FOLLOWS_TABLE,
            KeyConditionExpression: 'pk = :me',
            ExpressionAttributeValues: { ':me': userId },
            ProjectionExpression: 'sk',
            Limit: 500,
            ConsistentRead: true,
          }));
          const followIds = new Set((following.Items || []).map(i => i.sk));
          followIds.add(userId);

          if (followIds.size > 0) {
            const results = [];
            for (const fid of followIds) {
              const r = await ddb.send(new QueryCommand({
                TableName: POSTS_TABLE,
                KeyConditionExpression: 'pk = :p',
                ExpressionAttributeValues: { ':p': `USER#${fid}` },
                ScanIndexForward: false,
                Limit: 50, // Fetch more per user to ensure we have enough for pagination
                ConsistentRead: true,
              }));
              (r.Items || []).forEach(i => results.push(i));
            }
            results.sort((a, b) => Number(b.createdAt || 0) - Number(a.createdAt || 0));

            let items = results.slice(offset, offset + limit).map(i => ({
              id: i.id, userId: i.userId, username: i.username || 'unknown',
              handle: i.handle || null,
              text: i.text || '', imageKey: i.imageKey || null,
              imageAspectRatio: i.imageAspectRatio || null,
              images: i.images || null,
              avatarKey: i.avatarKey || null,
              createdAt: i.createdAt,
            }));

            // Filter out posts from blocked users
            if (BLOCKS_TABLE) {
              try {
                const blockedUserIds = await getBlockedUserIds(userId);
                if (blockedUserIds.length > 0) {
                  items = items.filter(post => !blockedUserIds.includes(post.userId));
                }
              } catch (e) {
                console.error('[Feed] Failed to filter blocked users:', e);
              }
            }

            // Hydrate avatars/handles
            try {
              const summaries = await fetchUserSummaries(items.map(i => i.userId));
              const avatarMap = {};
              const handleMap = {};
              for (const u of summaries) {
                if (u.userId) {
                  avatarMap[u.userId] = u.avatarKey || null;
                  handleMap[u.userId] = u.handle || null;
                }
              }
              const looksLikeUuid = (s) => !!s && /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i.test(String(s));
              for (const it of items) {
                const a = avatarMap[it.userId];
                if (a) it.avatarKey = a;
                const h = handleMap[it.userId];
                if (h) {
                  it.handle = h;
                  if ((!it.username || it.username === 'unknown' || looksLikeUuid(it.username))) {
                    it.username = h;
                  }
                }
              }
            } catch (e) {
              console.error('FEED avatar/handle hydrate failed', e);
            }

            // Fetch comment previews for all posts
            try {
              for (const post of items) {
                // First, get the total count of comments
                const countResult = await ddb.send(new QueryCommand({
                  TableName: COMMENTS_TABLE,
                  KeyConditionExpression: 'pk = :p',
                  ExpressionAttributeValues: { ':p': `POST#${post.id}` },
                  Select: 'COUNT',
                  ConsistentRead: true,
                }));
                const totalCommentCount = countResult.Count || 0;

                // Then fetch first 4 comments for preview
                const commentsResult = await ddb.send(new QueryCommand({
                  TableName: COMMENTS_TABLE,
                  KeyConditionExpression: 'pk = :p',
                  ExpressionAttributeValues: { ':p': `POST#${post.id}` },
                  ScanIndexForward: true,
                  Limit: 4, // Fetch 4 to detect if there are more than 3
                  ConsistentRead: true,
                }));

                const allComments = (commentsResult.Items || []).map(it => ({
                  id: it.id,
                  userId: it.userId,
                  handle: it.userHandle || null,
                  text: it.text || '',
                  createdAt: it.createdAt || 0,
                }));

                // Take only first 3 for preview
                const comments = allComments.slice(0, 3);

                // Fetch avatarKey for comment authors
                if (comments.length > 0) {
                  try {
                    const userIds = [...new Set(comments.map(c => c.userId).filter(Boolean))];
                    if (userIds.length > 0) {
                      const summaries = await fetchUserSummaries(userIds);
                      const avatarMap = Object.fromEntries(
                        summaries.map(u => [u.userId, u.avatarKey || null])
                      );
                      for (const comment of comments) {
                        if (comment.userId && avatarMap[comment.userId]) {
                          comment.avatarKey = avatarMap[comment.userId];
                        }
                      }
                    }
                  } catch (e) {
                    console.error('Failed to fetch comment avatars:', e);
                  }
                }

                post.comments = comments;
                post.commentCount = totalCommentCount;
              }
            } catch (e) {
              console.error('Failed to fetch comment previews for feed:', e);
              // Continue without comment previews if this fails
            }

            return ok({ items });
          }
        }

        // fallback to global GSI 'gsi1'
        const gf = await ddb.send(new QueryCommand({
          TableName: POSTS_TABLE,
          IndexName: 'gsi1',
          KeyConditionExpression: 'gsi1pk = :g',
          ExpressionAttributeValues: { ':g': 'FEED' },
          ScanIndexForward: false,
          Limit: limit + offset, // Fetch enough to support pagination
          // Note: GSIs do not support ConsistentRead - only eventually consistent
        }));

        let items = (gf.Items || []).slice(offset, offset + limit).map(i => ({
          id: i.id, userId: i.userId, username: i.username || 'unknown',
          handle: i.handle || null,
          text: i.text || '', imageKey: i.imageKey || null,
          imageAspectRatio: i.imageAspectRatio || null,
          images: i.images || null,
          avatarKey: i.avatarKey || null,
          createdAt: i.createdAt,
        }));

        // Filter out posts from blocked users
        if (BLOCKS_TABLE) {
          try {
            const blockedUserIds = await getBlockedUserIds(userId);
            if (blockedUserIds.length > 0) {
              items = items.filter(post => !blockedUserIds.includes(post.userId));
            }
          } catch (e) {
            console.error('[Feed] Failed to filter blocked users:', e);
          }
        }

        try {
          const summaries = await fetchUserSummaries(items.map(i => i.userId));
          const avatarMap = {};
          const handleMap = {};
          for (const u of summaries) {
            if (u.userId) {
              avatarMap[u.userId] = u.avatarKey || null;
              handleMap[u.userId] = u.handle || null;
            }
          }
          const looksLikeUuid = (s) => !!s && /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i.test(String(s));
          for (const it of items) {
            const a = avatarMap[it.userId];
            if (a) it.avatarKey = a;
            const h = handleMap[it.userId];
            if (h) {
              it.handle = h;
              if ((!it.username || it.username === 'unknown' || looksLikeUuid(it.username))) {
                it.username = h;
              }
            }
          }
        } catch (e) {
          console.error('FEED avatar/handle hydrate failed', e);
        }

        // Fetch comment previews for all posts (fallback path)
        try {
          for (const post of items) {
            // First, get the total count of comments
            const countResult = await ddb.send(new QueryCommand({
              TableName: COMMENTS_TABLE,
              KeyConditionExpression: 'pk = :p',
              ExpressionAttributeValues: { ':p': `POST#${post.id}` },
              Select: 'COUNT',
              ConsistentRead: true,
            }));
            const totalCommentCount = countResult.Count || 0;

            // Then fetch first 4 comments for preview
            const commentsResult = await ddb.send(new QueryCommand({
              TableName: COMMENTS_TABLE,
              KeyConditionExpression: 'pk = :p',
              ExpressionAttributeValues: { ':p': `POST#${post.id}` },
              ScanIndexForward: true,
              Limit: 4, // Fetch 4 to detect if there are more than 3
              ConsistentRead: true,
            }));

            const allComments = (commentsResult.Items || []).map(it => ({
              id: it.id,
              userId: it.userId,
              handle: it.userHandle || null,
              text: it.text || '',
              createdAt: it.createdAt || 0,
            }));

            // Take only first 3 for preview
            const comments = allComments.slice(0, 3);

            // Fetch avatarKey for comment authors
            if (comments.length > 0) {
              try {
                const userIds = [...new Set(comments.map(c => c.userId).filter(Boolean))];
                if (userIds.length > 0) {
                  const summaries = await fetchUserSummaries(userIds);
                  const avatarMap = Object.fromEntries(
                    summaries.map(u => [u.userId, u.avatarKey || null])
                  );
                  for (const comment of comments) {
                    if (comment.userId && avatarMap[comment.userId]) {
                      comment.avatarKey = avatarMap[comment.userId];
                    }
                  }
                }
              } catch (e) {
                console.error('Failed to fetch comment avatars:', e);
              }
            }

            post.comments = comments;
            post.commentCount = totalCommentCount;
          }
        } catch (e) {
          console.error('Failed to fetch comment previews for feed (fallback):', e);
          // Continue without comment previews if this fails
        }

        return ok({ items });
      } catch (e) {
        console.error('FEED_ERROR', e);
        return bad('Server error', 500);
      }
    }

    // ----- /posts (create) -----
    if (route === 'POST /posts') {
      if (!userId) return bad('Unauthorized', 401);
      const body = JSON.parse(event.body || '{}');

      // Moderate content using Amazon Bedrock (text and image)
      const textContent = String(body.text || '').slice(0, 500);
      const imageKey = body.imageKey || null;
      const moderation = await moderateContent(textContent, imageKey);
      if (!moderation.safe) {
        console.log(`[Moderation] Post blocked for user ${userId}: ${moderation.reason}`);
        return bad(`Content blocked: ${moderation.reason || 'Content violates our community guidelines'}`, 403);
      }

      const id = crypto.randomUUID();
      const now = Date.now();

      const handle = await getHandleForUserId(userId);
      const display = handle || usernameFallback;

      const userProfile = await ddb.send(new GetCommand({
        TableName: USERS_TABLE,
        Key: { pk: `USER#${userId}` },
        ConsistentRead: true,
      }));
      const avatarKey = userProfile.Item?.avatarKey || null;

      const item = {
        pk: `USER#${userId}`,
        sk: `POST#${now}`,
        gsi1pk: 'FEED',
        gsi1sk: String(now),
        id, userId,
        handle: handle || null,
        username: display,
        avatarKey,
        text: textContent,
        createdAt: now,
      };

      // Support multi-image posts (new format)
      if (body.images && Array.isArray(body.images) && body.images.length > 0) {
        item.images = body.images.map((img, index) => ({
          key: img.key,
          aspectRatio: img.aspectRatio || 1,
          width: img.width || null,
          height: img.height || null,
          order: img.order !== undefined ? img.order : index,
        }));
      }
      // Backward compatibility: support legacy single image format
      else if (body.imageKey) {
        item.imageKey = body.imageKey;
        if (body.imageAspectRatio) item.imageAspectRatio = body.imageAspectRatio;
      }

      await ddb.send(new PutCommand({ TableName: POSTS_TABLE, Item: item }));

      // NEW: detect mentions in post text
      try {
        const text = String(body.text || '');
        const mentionRegex = /@([a-z0-9_]+)/gi;
        const mentions = [...text.matchAll(mentionRegex)].map(m => m[1].toLowerCase());
        for (const h of mentions) {
          const mid = await userIdFromHandle(h);
          if (mid && mid !== userId) {
            await createNotification(mid, 'mention', userId, id, 'mentioned you in a post');
          }
        }
      } catch (e) { console.error('notify mentions (post) failed', e); }

      // Return the full post object (matching GET /posts/{id} format)
      return ok({
        id: item.id,
        userId: item.userId,
        username: item.username,
        handle: item.handle,
        text: item.text,
        imageKey: item.imageKey || null,
        imageAspectRatio: item.imageAspectRatio || null,
        images: item.images || null,
        avatarKey: item.avatarKey,
        createdAt: item.createdAt,
      });
    }

    // ----- /upload-url (media for posts) -----
    if (route === 'POST /upload-url') {
      if (!userId) return bad('Unauthorized', 401);
      const { contentType } = JSON.parse(event.body || '{}');
      const key = `u/${userId}/${Date.now()}-${crypto.randomUUID()}`;
      const put = new PutObjectCommand({
        Bucket: MEDIA_BUCKET,
        Key: key,
        ContentType: contentType || 'application/octet-stream',
        // Note: ACL removed - bucket uses "Bucket owner enforced" Object Ownership
      });
      const url = await getSignedUrl(s3, put, { expiresIn: 60 });
      return ok({ url, key });
    }

    // ----- /avatar-url (upload for profile avatar) -----
    if (route === 'POST /avatar-url') {
      if (!userId) return bad('Unauthorized', 401);
      const { contentType } = JSON.parse(event.body || '{}');
      const key = `a/${userId}/${Date.now()}-${crypto.randomUUID()}`;
      const put = new PutObjectCommand({
        Bucket: MEDIA_BUCKET,
        Key: key,
        ContentType: contentType || 'image/jpeg',
        // Note: ACL removed - bucket uses "Bucket owner enforced" Object Ownership
      });
      const url = await getSignedUrl(s3, put, { expiresIn: 60 });
      return ok({ url, key });
    }

    // ----- DELETE /media/{key} - Delete unused uploaded media -----
    if (method === 'DELETE' && path.startsWith('/media/')) {
      if (!userId) return bad('Unauthorized', 401);

      // Extract the key from the path (everything after /media/) and decode it
      const encodedKey = path.substring('/media/'.length);
      if (!encodedKey) return bad('Missing media key', 400);

      const key = decodeURIComponent(encodedKey);

      // Verify user owns this media - key should start with u/{userId}/ or a/{userId}/
      const userPrefix = `u/${userId}/`;
      const avatarPrefix = `a/${userId}/`;

      if (!key.startsWith(userPrefix) && !key.startsWith(avatarPrefix)) {
        console.log(`[DELETE /media] User ${userId} attempted to delete unauthorized key: ${key}`);
        return bad('Forbidden: You can only delete your own media', 403);
      }

      // Delete from S3
      try {
        await s3.send(new DeleteObjectCommand({
          Bucket: MEDIA_BUCKET,
          Key: key,
        }));
        console.log(`[DELETE /media] Deleted S3 object: ${key} for user ${userId}`);
        return ok({ deleted: true, key });
      } catch (e) {
        console.error('[DELETE /media] Failed to delete S3 object:', e);
        return bad('Failed to delete media', 500);
      }
    }

    // ----- PATCH /posts/{id} -----
    if (method === 'PATCH' && path.startsWith('/posts/')) {
      if (!userId) return bad('Unauthorized', 401);
      const id = path.split('/')[2];
      const body = JSON.parse(event.body || '{}');

      let qr;
      try {
        qr = await ddb.send(new QueryCommand({
          TableName: POSTS_TABLE,
          IndexName: 'byId',
          KeyConditionExpression: 'id = :id',
          ExpressionAttributeValues: { ':id': id },
          Limit: 1,
        }));
      } catch (e) {
        return ok({ message: 'POSTS_TABLE needs GSI "byId" (PK: id)', detail: String(e) }, 501);
      }
      const post = (qr.Items || [])[0];
      if (!post) return bad('Not found', 404);
      if (post.userId !== userId) return bad('Forbidden', 403);

      const sets = [];
      const names = {};
      const values = { ':u': userId };
      const remove = [];

      if (typeof body.text === 'string') {
        sets.push('#text = :text');
        names['#text'] = 'text';
        values[':text'] = String(body.text).slice(0, 500);
      }
      if (typeof body.imageKey === 'string') {
        sets.push('#imageKey = :imageKey');
        names['#imageKey'] = 'imageKey';
        values[':imageKey'] = body.imageKey;
      }
      if (body.deleteImage) {
        remove.push('#imageKey');
        names['#imageKey'] = 'imageKey';
      }

      const UpdateExpression =
        (sets.length ? ('SET ' + sets.join(', ')) : '') +
        (remove.length ? (sets.length ? ' ' : '') + 'REMOVE ' + remove.join(', ') : '');

      if (!UpdateExpression) return ok({ message: 'No changes' });

      await ddb.send(new UpdateCommand({
        TableName: POSTS_TABLE,
        Key: { pk: post.pk, sk: post.sk },
        UpdateExpression,
        ExpressionAttributeNames: Object.keys(names).length ? names : undefined,
        ExpressionAttributeValues: Object.keys(values).length ? values : undefined,
        ConditionExpression: 'userId = :u'
      }));

      return ok({ ok: true });
    }

    // ----- DELETE /posts/{id} -----
    if (method === 'DELETE' && path.startsWith('/posts/')) {
      if (!userId) return bad('Unauthorized', 401);
      const id = path.split('/')[2];

      let qr;
      try {
        qr = await ddb.send(new QueryCommand({
          TableName: POSTS_TABLE,
          IndexName: 'byId',
          KeyConditionExpression: 'id = :id',
          ExpressionAttributeValues: { ':id': id },
          Limit: 1,
        }));
      } catch (e) {
        return ok({ message: 'POSTS_TABLE needs GSI "byId" (PK: id)', detail: String(e) }, 501);
      }
      const post = (qr.Items || [])[0];
      if (!post) return bad('Not found', 404);
      if (post.userId !== userId) return bad('Forbidden', 403);

      // Delete photo from S3 if it exists
      if (post.imageKey && MEDIA_BUCKET) {
        try {
          await s3.send(new DeleteObjectCommand({
            Bucket: MEDIA_BUCKET,
            Key: post.imageKey,
          }));
          console.log(`[DELETE /posts] Deleted S3 object: ${post.imageKey}`);
        } catch (e) {
          console.error('[DELETE /posts] Failed to delete S3 object:', e);
          // Continue with post deletion even if S3 deletion fails
        }
      }

      await ddb.send(new DeleteCommand({
        TableName: POSTS_TABLE,
        Key: { pk: post.pk, sk: post.sk },
        ConditionExpression: 'userId = :u',
        ExpressionAttributeValues: { ':u': userId }
      }));

      return ok({ ok: true });
    }

    // ----- GET /posts/{id} -----
    if (method === 'GET' && path.startsWith('/posts/')) {
      const id = path.split('/')[2];
      if (!id) return bad('Missing id', 400);

      let qr;
      try {
        qr = await ddb.send(new QueryCommand({
          TableName: POSTS_TABLE,
          IndexName: 'byId',
          KeyConditionExpression: 'id = :id',
          ExpressionAttributeValues: { ':id': id },
          Limit: 1,
          }));
      } catch (e) {
        return ok({ message: 'POSTS_TABLE needs GSI \"byId\" (PK: id)', detail: String(e) }, 501);
      }
      const post = (qr.Items || [])[0];
      if (!post) return bad('Not found', 404);

      // Hydrate latest handle/avatar to be safe
      try {
        const profiles = await fetchUserSummaries([post.userId]);
        if (profiles && profiles[0]) {
          post.handle = profiles[0].handle || post.handle || null;
          post.avatarKey = profiles[0].avatarKey ?? post.avatarKey ?? null;
        }
      } catch (e) { console.error('GET /posts hydrate failed', e); }

      return ok({
        id: post.id,
        userId: post.userId,
        username: post.username || 'unknown',
        handle: post.handle || null,
        text: post.text || '',
        imageKey: post.imageKey || null,
        imageAspectRatio: post.imageAspectRatio || null,
        images: post.images || null,
        avatarKey: post.avatarKey || null,
        createdAt: post.createdAt,
      });
    }

    // ----- /u/:handle, /u/:handle/followers, /u/:handle/following, /u/:handle/posts -----
    const userRoute = matchUserRoutes(path);
    if (method === 'GET' && userRoute) {
      if (!userId) return bad('Unauthorized', 401);

      const qs = event?.queryStringParameters || {};
      const limit = Math.min(parseInt(qs.limit) || 20, 100); // Default 20, max 100
      const offset = Math.max(parseInt(qs.offset) || 0, 0);

      const h = userRoute.handle.toLowerCase();
      const u = await ddb.send(new GetCommand({
        TableName: USERS_TABLE,
        Key: { pk: `HANDLE#${h}` },
        ConsistentRead: true,
      }));
      if (!u.Item?.userId) return bad('User not found', 404);
      const targetId = u.Item.userId;

      if (userRoute.kind === 'user') {
        const profile = await ddb.send(new GetCommand({
          TableName: USERS_TABLE,
          Key: { pk: `USER#${targetId}` },
          ConsistentRead: true,
        }));

        const [followerCount, followingCount, iFollow] = await Promise.all([
          countFollowers(targetId),
          countFollowing(targetId),
          isFollowing(userId, targetId),
        ]);


        let isFollowPending = false;
        try { if (!iFollow) { isFollowPending = await hasPendingFollow(userId, targetId); } } catch (e) { console.error('compute isFollowPending', e); }

        // Check if this is the user's own profile
        const isSelf = userId === targetId;

        // Private profiles by default: only show posts if viewer is following or viewing own profile
        const canViewPosts = isSelf || iFollow;

        // Fetch posts with pagination
        let items = [];
        let isPrivate = false;

        if (canViewPosts) {
          const allPosts = await listPostsByUserId(targetId);
          items = allPosts.slice(offset, offset + limit);
        } else {
          // Profile is private and viewer is not following
          isPrivate = true;
        }

        // Hydrate profile posts with fresh avatar/handle
        try {
          const summaries = await fetchUserSummaries([targetId]);
          const freshAvatar = (summaries[0] && summaries[0].avatarKey) || null;
          const freshHandle = (summaries[0] && summaries[0].handle) || null;
          if (freshAvatar) { for (const it of items) it.avatarKey = freshAvatar; }
          if (freshHandle) { for (const it of items) { it.username = (it.username && it.username !== 'unknown') ? it.username : freshHandle; it.handle = freshHandle; } }
        } catch (e) { console.error('PROFILE avatar/handle hydrate failed', e); }

        // Fetch comment previews for all posts
        try {
          for (const post of items) {
            // First, get the total count of comments
            const countResult = await ddb.send(new QueryCommand({
              TableName: COMMENTS_TABLE,
              KeyConditionExpression: 'pk = :p',
              ExpressionAttributeValues: { ':p': `POST#${post.id}` },
              Select: 'COUNT',
              ConsistentRead: true,
            }));
            const totalCommentCount = countResult.Count || 0;

            // Then fetch first 4 comments for preview
            const commentsResult = await ddb.send(new QueryCommand({
              TableName: COMMENTS_TABLE,
              KeyConditionExpression: 'pk = :p',
              ExpressionAttributeValues: { ':p': `POST#${post.id}` },
              ScanIndexForward: true,
              Limit: 4, // Fetch 4 to detect if there are more than 3
              ConsistentRead: true,
            }));

            const allComments = (commentsResult.Items || []).map(it => ({
              id: it.id,
              userId: it.userId,
              handle: it.userHandle || null,
              text: it.text || '',
              createdAt: it.createdAt || 0,
            }));

            // Take only first 3 for preview
            const comments = allComments.slice(0, 3);

            // Fetch avatarKey for comment authors
            if (comments.length > 0) {
              try {
                const userIds = [...new Set(comments.map(c => c.userId).filter(Boolean))];
                if (userIds.length > 0) {
                  const summaries = await fetchUserSummaries(userIds);
                  const avatarMap = Object.fromEntries(
                    summaries.map(u => [u.userId, u.avatarKey || null])
                  );
                  for (const comment of comments) {
                    if (comment.userId && avatarMap[comment.userId]) {
                      comment.avatarKey = avatarMap[comment.userId];
                    }
                  }
                }
              } catch (e) {
                console.error('Failed to fetch comment avatars:', e);
              }
            }

            post.comments = comments;
            post.commentCount = totalCommentCount;
          }
        } catch (e) {
          console.error('Failed to fetch comment previews for profile:', e);
          // Continue without comment previews if this fails
        }

        return ok({ handle: h,
          userId: targetId,
          exists: !!profile.Item,
          avatarKey: profile.Item?.avatarKey || null,
          fullName: profile.Item?.fullName || null,
          followerCount,
          followingCount,
          followers: followerCount,
          following: followingCount,
          isFollowing: iFollow,
          items,
          posts: items,
          isPrivate,
          isFollowPending, followStatus: (iFollow ? 'following' : (isFollowPending ? 'pending' : 'none')) });
      }

      if (userRoute.kind === 'followers') {
        if (!FOLLOWS_TABLE) return bad('Follows not enabled', 500);
        const scan = await ddb.send(new ScanCommand({
          TableName: FOLLOWS_TABLE,
          FilterExpression: 'sk = :t',
          ExpressionAttributeValues: { ':t': targetId },
          ProjectionExpression: 'pk',
          ConsistentRead: true,
        }));
        const followerIds = (scan.Items || []).map(i => i.pk).filter(Boolean);
        const users = await fetchUserSummaries(followerIds);
        const items = [];
        for (const u of users) {
          let following = false;
          if (FOLLOWS_TABLE && userId) {
            const rel = await ddb.send(new GetCommand({
              TableName: FOLLOWS_TABLE,
              Key: { pk: userId, sk: u.userId },
              ConsistentRead: true,
            }));
            following = !!rel.Item;
          }
          items.push({
            handle: u.handle,
            fullName: u.fullName || null,
            avatarKey: u.avatarKey || null,
            userId: u.userId,
            isFollowing: following,
          });
        }
        return ok({ items, _debugFollowerIdCount: followerIds.length });
      }

      if (userRoute.kind === 'following') {
        if (!FOLLOWS_TABLE) return bad('Follows not enabled', 500);
        const q = await ddb.send(new QueryCommand({
          TableName: FOLLOWS_TABLE,
          KeyConditionExpression: 'pk = :p',
          ExpressionAttributeValues: { ':p': targetId },
          ProjectionExpression: 'sk',
          ConsistentRead: true,
        }));
        const followingIds = (q.Items || []).map(i => i.sk).filter(Boolean);
        const users = await fetchUserSummaries(followingIds);
        const items = [];
        for (const u of users) {
          let viewerFollows = false;
          if (FOLLOWS_TABLE && userId) {
            const rel = await ddb.send(new GetCommand({
              TableName: FOLLOWS_TABLE,
              Key: { pk: userId, sk: u.userId },
              ConsistentRead: true,
            }));
            viewerFollows = !!rel.Item;
          }
          items.push({
            handle: u.handle,
            fullName: u.fullName || null,
            avatarKey: u.avatarKey || null,
            userId: u.userId,
            isFollowing: viewerFollows,
          });
        }
        return ok({ items, _debugFollowingIdCount: followingIds.length });
      }

      if (userRoute.kind === 'posts') {
        // Check if this is the user's own profile
        const isSelf = userId === targetId;

        // Check if viewer is following the profile owner
        const iFollow = await isFollowing(userId, targetId);

        // Private profiles by default: only show posts if viewer is following or viewing own profile
        const canViewPosts = isSelf || iFollow;

        let items = [];
        let isPrivate = false;

        if (canViewPosts) {
          const allPosts = await listPostsByUserId(targetId);
          items = allPosts.slice(offset, offset + limit);
        } else {
          // Profile is private and viewer is not following
          isPrivate = true;
        }
        try {
          const summaries = await fetchUserSummaries([targetId]);
          const fresh = (summaries[0] && summaries[0].avatarKey) || null;
          if (fresh) { for (const it of items) it.avatarKey = fresh; }
        } catch (e) { console.error('USER POSTS avatar hydrate failed', e); }

        // Fetch comment previews for all posts
        try {
          for (const post of items) {
            // First, get the total count of comments
            const countResult = await ddb.send(new QueryCommand({
              TableName: COMMENTS_TABLE,
              KeyConditionExpression: 'pk = :p',
              ExpressionAttributeValues: { ':p': `POST#${post.id}` },
              Select: 'COUNT',
              ConsistentRead: true,
            }));
            const totalCommentCount = countResult.Count || 0;

            // Then fetch first 4 comments for preview
            const commentsResult = await ddb.send(new QueryCommand({
              TableName: COMMENTS_TABLE,
              KeyConditionExpression: 'pk = :p',
              ExpressionAttributeValues: { ':p': `POST#${post.id}` },
              ScanIndexForward: true,
              Limit: 4, // Fetch 4 to detect if there are more than 3
              ConsistentRead: true,
            }));

            const allComments = (commentsResult.Items || []).map(it => ({
              id: it.id,
              userId: it.userId,
              handle: it.userHandle || null,
              text: it.text || '',
              createdAt: it.createdAt || 0,
            }));

            // Take only first 3 for preview
            const comments = allComments.slice(0, 3);

            // Fetch avatarKey for comment authors
            if (comments.length > 0) {
              try {
                const userIds = [...new Set(comments.map(c => c.userId).filter(Boolean))];
                if (userIds.length > 0) {
                  const summaries = await fetchUserSummaries(userIds);
                  const avatarMap = Object.fromEntries(
                    summaries.map(u => [u.userId, u.avatarKey || null])
                  );
                  for (const comment of comments) {
                    if (comment.userId && avatarMap[comment.userId]) {
                      comment.avatarKey = avatarMap[comment.userId];
                    }
                  }
                }
              } catch (e) {
                console.error('Failed to fetch comment avatars:', e);
              }
            }

            post.comments = comments;
            post.commentCount = totalCommentCount;
          }
        } catch (e) {
          console.error('Failed to fetch comment previews for user posts:', e);
          // Continue without comment previews if this fails
        }

        return ok({ items, isPrivate });
      }
    }

    // ----- /search?q=prefix -----
    if (route === 'GET /search') {
      if (!userId) return bad('Unauthorized', 401);

      const qs = event?.queryStringParameters || {};
      const q = String(qs.q || '').replace(/^@/, '').trim().toLowerCase();
      if (!q) return ok({ items: [] });

      let items = [];
      try {
        const qr = await ddb.send(new QueryCommand({
          TableName: USERS_TABLE,
          IndexName: 'byHandle',
          KeyConditionExpression: '#t = :H AND begins_with(#h, :q)',
          ExpressionAttributeNames: { '#t': 'type', '#h': 'handle' },
          ExpressionAttributeValues: { ':H': 'HANDLE', ':q': q },
          Limit: 25,
          // Note: GSIs do not support ConsistentRead - only eventually consistent
        }));
        items = qr.Items || [];
      } catch (e) {
        console.error('GSI byHandle query failed', e);
      }

      const scan = await ddb.send(new ScanCommand({
        TableName: USERS_TABLE,
        ProjectionExpression: 'pk, handle, userId, fullName, avatarKey',
        FilterExpression: 'begins_with(pk, :p)',
        ExpressionAttributeValues: { ':p': 'USER#' },
        Limit: 1000,
        ConsistentRead: true,
      }));
      const extra = (scan.Items || []).filter(it => {
        const h = (it.handle || '').toLowerCase();
        const n = (it.fullName || '').toLowerCase();
        return (h.includes(q) || n.includes(q));
      });
      const byId = new Map();
      for (const it of [...items, ...extra]) {
        const id = it.userId;
        if (id && !byId.has(id)) byId.set(id, it);
      }
      items = Array.from(byId.values()).slice(0, 25);

      const out = [];
      for (const it of items) {
        const handle = it.handle;
        const targetId = it.userId;
        if (!handle || !targetId) continue;

        let following = false;
        if (FOLLOWS_TABLE) {
          const rel = await ddb.send(new GetCommand({
            TableName: FOLLOWS_TABLE,
            Key: { pk: userId, sk: targetId },
            ConsistentRead: true,
          }));
          following = !!rel.Item;
        }

        out.push({ handle, fullName: it.fullName || null, avatarKey: it.avatarKey || null, isFollowing: following });
      }
      return ok({ items: out });
    }

    // ----- /invites (admin only) -----
    if (route === 'POST /invites') {
      if (!userId) return bad('Unauthorized', 401);
      if (!ADMIN_EMAILS.includes(email)) return bad('Forbidden', 403);

      const body = JSON.parse(event.body || '{}');
      const uses = Math.max(1, Math.min(100, Number(body.uses || 1)));
      const code = (crypto.randomUUID().slice(0, 8)).toUpperCase();

      await ddb.send(new PutCommand({
        TableName: INVITES_TABLE,
        Item: { code, usesRemaining: uses },
      }));

      return ok({ code, uses });
    }

    // ----- follow/unfollow (legacy direct follow; you can keep alongside requests) -----
    if (route === 'POST /follow') {
      if (!userId) return bad('Unauthorized', 401);
      const body = JSON.parse(event.body || '{}');
      const handle = String(body.handle || '').trim().toLowerCase();
      const targetId = await userIdFromHandle(handle);
      if (!targetId) return bad('Unknown user', 404);
      if (targetId === userId) return bad('Cannot follow yourself', 400);
      await ddb.send(new PutCommand({
        TableName: FOLLOWS_TABLE,
        Item: { pk: userId, sk: targetId },
      }));
      // Notify the target user about the new follower
      try { if (NOTIFICATIONS_TABLE) { await createNotification(targetId, 'follow', userId, null, 'started following you'); } } catch (e) { console.error('follow notify failed', e); }
      return ok({ ok: true });
    }

    if (route === 'POST /unfollow') {
      if (!userId) return bad('Unauthorized', 401);
      const body = JSON.parse(event.body || '{}');
      const handle = String(body.handle || '').trim().toLowerCase();
      const targetId = await userIdFromHandle(handle);
      if (!targetId) return bad('Unknown user', 404);
      if (targetId === userId) return bad('Cannot unfollow yourself', 400);
      await ddb.send(new DeleteCommand({
        TableName: FOLLOWS_TABLE,
        Key: { pk: userId, sk: targetId },
      }));
      // Remove any existing 'follow' notification
      try { if (NOTIFICATIONS_TABLE && targetId !== userId) { await deleteNotifications(targetId, 'follow', userId, null); } } catch (e) { console.error('unfollow cleanup notify failed', e); }
      return ok({ ok: true });
    }

    // ----- Blocking endpoints -----
    if (route === 'POST /block') {
      if (!BLOCKS_TABLE) return bad('Blocking not enabled', 501);
      if (!userId) return bad('Unauthorized', 401);

      const body = JSON.parse(event.body || '{}');
      const targetUserId = String(body.userId || '').trim();
      if (!targetUserId) return bad('Missing userId', 400);
      if (targetUserId === userId) return bad('Cannot block yourself', 400);

      // Create block record
      await ddb.send(new PutCommand({
        TableName: BLOCKS_TABLE,
        Item: {
          pk: `USER#${userId}`,
          sk: `BLOCKED#${targetUserId}`,
          blockedUserId: targetUserId,
          createdAt: Date.now(),
        },
      }));

      // Remove follow relationships in both directions
      if (FOLLOWS_TABLE) {
        try {
          await Promise.all([
            ddb.send(new DeleteCommand({
              TableName: FOLLOWS_TABLE,
              Key: { pk: userId, sk: targetUserId },
            })),
            ddb.send(new DeleteCommand({
              TableName: FOLLOWS_TABLE,
              Key: { pk: targetUserId, sk: userId },
            })),
          ]);
        } catch (e) {
          console.error('[Blocking] Failed to remove follow relationships:', e);
        }
      }

      return ok({ success: true, blocked: true });
    }

    if (route === 'POST /unblock') {
      if (!BLOCKS_TABLE) return bad('Blocking not enabled', 501);
      if (!userId) return bad('Unauthorized', 401);

      const body = JSON.parse(event.body || '{}');
      const targetUserId = String(body.userId || '').trim();
      if (!targetUserId) return bad('Missing userId', 400);

      await ddb.send(new DeleteCommand({
        TableName: BLOCKS_TABLE,
        Key: { pk: `USER#${userId}`, sk: `BLOCKED#${targetUserId}` },
      }));

      return ok({ success: true, blocked: false });
    }

    if (route === 'GET /blocked') {
      if (!BLOCKS_TABLE) return bad('Blocking not enabled', 501);
      if (!userId) return bad('Unauthorized', 401);

      const result = await ddb.send(new QueryCommand({
        TableName: BLOCKS_TABLE,
        KeyConditionExpression: 'pk = :pk',
        ExpressionAttributeValues: { ':pk': `USER#${userId}` },
        ConsistentRead: true,
      }));

      const blockedUserIds = (result.Items || []).map(item => item.blockedUserId).filter(Boolean);
      const users = await fetchUserSummaries(blockedUserIds);

      return ok({
        items: users.map(u => ({
          userId: u.userId,
          handle: u.handle || null,
          fullName: u.fullName || null,
          avatarKey: u.avatarKey || null,
        }))
      });
    }

    // ----- Reporting endpoints -----
    if (route === 'POST /report') {
      if (!REPORTS_TABLE) return bad('Reporting not enabled', 501);
      if (!userId) return bad('Unauthorized', 401);

      const body = JSON.parse(event.body || '{}');
      const contentType = String(body.contentType || '').trim(); // 'post' or 'comment'
      const contentId = String(body.contentId || '').trim();
      const reason = String(body.reason || '').trim().slice(0, 500);

      if (!contentType || !contentId) return bad('Missing contentType or contentId', 400);
      if (!['post', 'comment'].includes(contentType)) return bad('Invalid contentType', 400);
      if (!reason) return bad('Missing reason', 400);

      const reportId = randomUUID();
      const now = Date.now();

      // Get reported content details
      let reportedUserId = null;
      let contentText = null;

      if (contentType === 'post') {
        try {
          const postResult = await ddb.send(new QueryCommand({
            TableName: POSTS_TABLE,
            IndexName: 'byId',
            KeyConditionExpression: 'id = :id',
            ExpressionAttributeValues: { ':id': contentId },
            Limit: 1,
          }));
          const post = (postResult.Items || [])[0];
          if (post) {
            reportedUserId = post.userId;
            contentText = post.text;
          }
        } catch (e) {
          console.error('[Reporting] Failed to fetch post:', e);
        }
      } else if (contentType === 'comment') {
        try {
          const commentResult = await ddb.send(new ScanCommand({
            TableName: COMMENTS_TABLE,
            FilterExpression: 'id = :id',
            ExpressionAttributeValues: { ':id': contentId },
            Limit: 1,
            ConsistentRead: true,
          }));
          const comment = (commentResult.Items || [])[0];
          if (comment) {
            reportedUserId = comment.userId;
            contentText = comment.text;
          }
        } catch (e) {
          console.error('[Reporting] Failed to fetch comment:', e);
        }
      }

      // Create report record
      await ddb.send(new PutCommand({
        TableName: REPORTS_TABLE,
        Item: {
          pk: `REPORT#${reportId}`,
          sk: String(now),
          reportId,
          reporterId: userId,
          reportedUserId,
          contentType,
          contentId,
          contentText,
          reason,
          status: 'pending', // pending, reviewed, resolved
          createdAt: now,
        },
      }));

      return ok({ success: true, reportId });
    }

    if (route === 'GET /reports') {
      if (!REPORTS_TABLE) return bad('Reporting not enabled', 501);
      if (!userId) return bad('Unauthorized', 401);
      if (!ADMIN_EMAILS.includes(email)) return bad('Forbidden - Admin only', 403);

      const qs = event?.queryStringParameters || {};
      const status = qs.status || 'pending';

      const result = await ddb.send(new ScanCommand({
        TableName: REPORTS_TABLE,
        FilterExpression: '#status = :status',
        ExpressionAttributeNames: { '#status': 'status' },
        ExpressionAttributeValues: { ':status': status },
        ConsistentRead: true,
      }));

      const reports = (result.Items || []).sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));

      // Enrich with reporter and reported user info
      const allUserIds = new Set();
      reports.forEach(r => {
        if (r.reporterId) allUserIds.add(r.reporterId);
        if (r.reportedUserId) allUserIds.add(r.reportedUserId);
      });

      const users = await fetchUserSummaries(Array.from(allUserIds));
      const userMap = new Map(users.map(u => [u.userId, u]));

      const enrichedReports = reports.map(r => ({
        ...r,
        reporter: userMap.get(r.reporterId) || null,
        reportedUser: userMap.get(r.reportedUserId) || null,
      }));

      return ok({ items: enrichedReports });
    }

    if (method === 'POST' && path.startsWith('/reports/')) {
      if (!REPORTS_TABLE) return bad('Reporting not enabled', 501);
      if (!userId) return bad('Unauthorized', 401);
      if (!ADMIN_EMAILS.includes(email)) return bad('Forbidden - Admin only', 403);

      const reportId = path.split('/')[2];
      const action = path.split('/')[3]; // 'action'

      if (action !== 'action') return bad('Invalid endpoint', 400);

      const body = JSON.parse(event.body || '{}');
      const actionType = String(body.action || '').trim(); // 'delete_content', 'ban_user', 'dismiss'

      if (!actionType) return bad('Missing action', 400);
      if (!['delete_content', 'ban_user', 'dismiss'].includes(actionType)) {
        return bad('Invalid action type', 400);
      }

      // Get the report
      const reportResult = await ddb.send(new QueryCommand({
        TableName: REPORTS_TABLE,
        KeyConditionExpression: 'pk = :pk',
        ExpressionAttributeValues: { ':pk': `REPORT#${reportId}` },
        Limit: 1,
        ConsistentRead: true,
      }));

      const report = (reportResult.Items || [])[0];
      if (!report) return bad('Report not found', 404);

      // Perform the action
      if (actionType === 'delete_content') {
        if (report.contentType === 'post') {
          // Delete the post
          try {
            const postResult = await ddb.send(new QueryCommand({
              TableName: POSTS_TABLE,
              IndexName: 'byId',
              KeyConditionExpression: 'id = :id',
              ExpressionAttributeValues: { ':id': report.contentId },
              Limit: 1,
            }));
            const post = (postResult.Items || [])[0];
            if (post) {
              await ddb.send(new DeleteCommand({
                TableName: POSTS_TABLE,
                Key: { pk: post.pk, sk: post.sk },
              }));
            }
          } catch (e) {
            console.error('[Moderation] Failed to delete post:', e);
            return bad('Failed to delete post', 500);
          }
        } else if (report.contentType === 'comment') {
          // Delete the comment
          try {
            const commentResult = await ddb.send(new ScanCommand({
              TableName: COMMENTS_TABLE,
              FilterExpression: 'id = :id',
              ExpressionAttributeValues: { ':id': report.contentId },
              Limit: 1,
              ConsistentRead: true,
            }));
            const comment = (commentResult.Items || [])[0];
            if (comment) {
              await ddb.send(new DeleteCommand({
                TableName: COMMENTS_TABLE,
                Key: { pk: comment.pk, sk: comment.sk },
              }));
            }
          } catch (e) {
            console.error('[Moderation] Failed to delete comment:', e);
            return bad('Failed to delete comment', 500);
          }
        }
      } else if (actionType === 'ban_user') {
        // Ban the user by deleting their Cognito account
        if (report.reportedUserId) {
          try {
            await cognito.send(new AdminDeleteUserCommand({
              UserPoolId: USER_POOL_ID,
              Username: report.reportedUserId,
            }));
          } catch (e) {
            console.error('[Moderation] Failed to ban user:', e);
            return bad('Failed to ban user', 500);
          }
        }
      }

      // Update report status
      await ddb.send(new UpdateCommand({
        TableName: REPORTS_TABLE,
        Key: { pk: report.pk, sk: report.sk },
        UpdateExpression: 'SET #status = :status, reviewedBy = :userId, reviewedAt = :now, actionTaken = :action',
        ExpressionAttributeNames: { '#status': 'status' },
        ExpressionAttributeValues: {
          ':status': 'resolved',
          ':userId': userId,
          ':now': Date.now(),
          ':action': actionType,
        },
      }));

      return ok({ success: true, action: actionType });
    }

    // Check if user is blocked from viewing content
    if (route === 'GET /is-blocked') {
      if (!BLOCKS_TABLE) return bad('Blocking not enabled', 501);
      if (!userId) return bad('Unauthorized', 401);

      const qs = event?.queryStringParameters || {};
      const targetUserId = qs.userId;
      if (!targetUserId) return bad('Missing userId', 400);

      const blocked = await hasBlockBetween(userId, targetUserId);
      return ok({ blocked });
    }

    // ===================== SCOOPS (Stories) =====================

    // Get scoops feed - returns scoops from followed users grouped by user
    if (route === 'GET /scoops/feed') {
      if (!SCOOPS_TABLE) return bad('Scoops not enabled', 501);
      if (!userId) return bad('Unauthorized', 401);

      const now = Date.now();
      const twentyFourHoursAgo = now - (24 * 60 * 60 * 1000);

      // Get users this person follows
      const followedUsers = [];
      if (FOLLOWS_TABLE) {
        const followsResult = await ddb.send(new QueryCommand({
          TableName: FOLLOWS_TABLE,
          KeyConditionExpression: 'pk = :pk',
          ExpressionAttributeValues: { ':pk': `FOLLOWING#${userId}` },
        }));
        for (const item of (followsResult.Items || [])) {
          if (item.followedId) followedUsers.push(item.followedId);
        }
      }

      // Get scoops from each followed user
      const userScoopsMap = new Map();

      for (const followedId of followedUsers) {
        const scoopsResult = await ddb.send(new QueryCommand({
          TableName: SCOOPS_TABLE,
          KeyConditionExpression: 'pk = :pk AND sk > :sk',
          ExpressionAttributeValues: {
            ':pk': `USER#${followedId}`,
            ':sk': `SCOOP#${twentyFourHoursAgo}`,
          },
          ScanIndexForward: false,
        }));

        const scoops = (scoopsResult.Items || [])
          .filter(s => s.expiresAt > now)
          .map(s => ({
            id: s.id,
            userId: s.userId,
            handle: s.handle,
            avatarKey: s.avatarKey,
            mediaKey: s.mediaKey,
            mediaType: s.mediaType,
            mediaAspectRatio: s.mediaAspectRatio,
            textOverlays: s.textOverlays,
            createdAt: s.createdAt,
            expiresAt: s.expiresAt,
            viewCount: s.viewCount || 0,
            viewed: (s.viewers || []).includes(userId),
          }));

        if (scoops.length > 0) {
          const hasUnviewed = scoops.some(s => !s.viewed);
          userScoopsMap.set(followedId, {
            userId: followedId,
            handle: scoops[0].handle,
            avatarKey: scoops[0].avatarKey,
            scoops,
            hasUnviewed,
            latestScoopAt: scoops[0].createdAt,
          });
        }
      }

      // Sort by latest scoop and prioritize unviewed
      const items = Array.from(userScoopsMap.values())
        .sort((a, b) => {
          if (a.hasUnviewed !== b.hasUnviewed) return a.hasUnviewed ? -1 : 1;
          return b.latestScoopAt - a.latestScoopAt;
        });

      return ok({ items });
    }

    // Get my own scoops
    if (route === 'GET /scoops/me') {
      if (!SCOOPS_TABLE) return bad('Scoops not enabled', 501);
      if (!userId) return bad('Unauthorized', 401);

      const now = Date.now();
      const twentyFourHoursAgo = now - (24 * 60 * 60 * 1000);

      const result = await ddb.send(new QueryCommand({
        TableName: SCOOPS_TABLE,
        KeyConditionExpression: 'pk = :pk AND sk > :sk',
        ExpressionAttributeValues: {
          ':pk': `USER#${userId}`,
          ':sk': `SCOOP#${twentyFourHoursAgo}`,
        },
        ScanIndexForward: false,
      }));

      const items = (result.Items || [])
        .filter(s => s.expiresAt > now)
        .map(s => ({
          id: s.id,
          userId: s.userId,
          handle: s.handle,
          avatarKey: s.avatarKey,
          mediaKey: s.mediaKey,
          mediaType: s.mediaType,
          mediaAspectRatio: s.mediaAspectRatio,
          textOverlays: s.textOverlays,
          createdAt: s.createdAt,
          expiresAt: s.expiresAt,
          viewCount: s.viewCount || 0,
        }));

      return ok({ items });
    }

    // Get scoops for a specific user
    if (method === 'GET' && path.startsWith('/scoops/user/')) {
      if (!SCOOPS_TABLE) return bad('Scoops not enabled', 501);
      if (!userId) return bad('Unauthorized', 401);

      const targetUserId = path.split('/')[3];
      if (!targetUserId) return bad('Missing userId', 400);

      const now = Date.now();
      const twentyFourHoursAgo = now - (24 * 60 * 60 * 1000);

      const result = await ddb.send(new QueryCommand({
        TableName: SCOOPS_TABLE,
        KeyConditionExpression: 'pk = :pk AND sk > :sk',
        ExpressionAttributeValues: {
          ':pk': `USER#${targetUserId}`,
          ':sk': `SCOOP#${twentyFourHoursAgo}`,
        },
        ScanIndexForward: false,
      }));

      const items = (result.Items || [])
        .filter(s => s.expiresAt > now)
        .map(s => ({
          id: s.id,
          userId: s.userId,
          handle: s.handle,
          avatarKey: s.avatarKey,
          mediaKey: s.mediaKey,
          mediaType: s.mediaType,
          mediaAspectRatio: s.mediaAspectRatio,
          textOverlays: s.textOverlays,
          createdAt: s.createdAt,
          expiresAt: s.expiresAt,
          viewCount: s.viewCount || 0,
          viewed: (s.viewers || []).includes(userId),
        }));

      return ok({ items });
    }

    // Create a new scoop
    if (route === 'POST /scoops') {
      if (!SCOOPS_TABLE) return bad('Scoops not enabled', 501);
      if (!userId) return bad('Unauthorized', 401);

      const body = JSON.parse(event.body || '{}');
      const { mediaKey, mediaType, mediaAspectRatio, textOverlays } = body;

      if (!mediaKey) return bad('Missing mediaKey', 400);
      if (!mediaType || !['image', 'video'].includes(mediaType)) {
        return bad('Invalid mediaType', 400);
      }

      const now = Date.now();
      const id = randomUUID();
      const expiresAt = now + (24 * 60 * 60 * 1000); // 24 hours from now

      // Get user info
      const handle = await getHandleForUserId(userId);
      const userInfo = await ddb.send(new GetCommand({
        TableName: USERS_TABLE,
        Key: { pk: `USER#${userId}` },
      }));
      const avatarKey = userInfo.Item?.avatarKey || null;

      const item = {
        pk: `USER#${userId}`,
        sk: `SCOOP#${now}#${id}`,
        id,
        userId,
        handle,
        avatarKey,
        mediaKey,
        mediaType,
        mediaAspectRatio: mediaAspectRatio || null,
        textOverlays: textOverlays || [],
        createdAt: now,
        expiresAt,
        viewCount: 0,
        viewers: [],
      };

      await ddb.send(new PutCommand({
        TableName: SCOOPS_TABLE,
        Item: item,
      }));

      return ok({
        id,
        userId,
        handle,
        avatarKey,
        mediaKey,
        mediaType,
        mediaAspectRatio,
        textOverlays,
        createdAt: now,
        expiresAt,
        viewCount: 0,
      });
    }

    // Get a single scoop by ID
    if (method === 'GET' && path.match(/^\/scoops\/[^\/]+$/) && !path.includes('/user/')) {
      if (!SCOOPS_TABLE) return bad('Scoops not enabled', 501);

      const scoopId = path.split('/')[2];
      if (!scoopId || scoopId === 'feed' || scoopId === 'me') {
        return bad('Not found', 404);
      }

      // Scan to find scoop by ID (since we don't know the user)
      const result = await ddb.send(new ScanCommand({
        TableName: SCOOPS_TABLE,
        FilterExpression: 'id = :id',
        ExpressionAttributeValues: { ':id': scoopId },
        Limit: 1,
      }));

      const scoop = (result.Items || [])[0];
      if (!scoop) return bad('Scoop not found', 404);

      return ok({
        id: scoop.id,
        userId: scoop.userId,
        handle: scoop.handle,
        avatarKey: scoop.avatarKey,
        mediaKey: scoop.mediaKey,
        mediaType: scoop.mediaType,
        mediaAspectRatio: scoop.mediaAspectRatio,
        textOverlays: scoop.textOverlays,
        createdAt: scoop.createdAt,
        expiresAt: scoop.expiresAt,
        viewCount: scoop.viewCount || 0,
        viewed: userId ? (scoop.viewers || []).includes(userId) : false,
      });
    }

    // Delete a scoop
    if (method === 'DELETE' && path.startsWith('/scoops/')) {
      if (!SCOOPS_TABLE) return bad('Scoops not enabled', 501);
      if (!userId) return bad('Unauthorized', 401);

      const scoopId = path.split('/')[2];
      if (!scoopId) return bad('Missing scoopId', 400);

      // Find the scoop
      const result = await ddb.send(new ScanCommand({
        TableName: SCOOPS_TABLE,
        FilterExpression: 'id = :id',
        ExpressionAttributeValues: { ':id': scoopId },
        Limit: 1,
      }));

      const scoop = (result.Items || [])[0];
      if (!scoop) return bad('Scoop not found', 404);
      if (scoop.userId !== userId) return bad('Forbidden', 403);

      // Delete from S3
      if (scoop.mediaKey) {
        try {
          await s3.send(new DeleteObjectCommand({
            Bucket: MEDIA_BUCKET,
            Key: scoop.mediaKey,
          }));
        } catch (e) {
          console.warn('Failed to delete scoop media from S3:', e);
        }
      }

      // Delete from DynamoDB
      await ddb.send(new DeleteCommand({
        TableName: SCOOPS_TABLE,
        Key: { pk: scoop.pk, sk: scoop.sk },
      }));

      return ok({ success: true });
    }

    // Mark a scoop as viewed
    if (method === 'POST' && path.match(/^\/scoops\/[^\/]+\/view$/)) {
      if (!SCOOPS_TABLE) return bad('Scoops not enabled', 501);
      if (!userId) return bad('Unauthorized', 401);

      const scoopId = path.split('/')[2];
      if (!scoopId) return bad('Missing scoopId', 400);

      // Find the scoop
      const result = await ddb.send(new ScanCommand({
        TableName: SCOOPS_TABLE,
        FilterExpression: 'id = :id',
        ExpressionAttributeValues: { ':id': scoopId },
        Limit: 1,
      }));

      const scoop = (result.Items || [])[0];
      if (!scoop) return bad('Scoop not found', 404);

      // Don't track views on own scoops
      if (scoop.userId === userId) {
        return ok({ success: true });
      }

      // Check if already viewed
      const viewers = scoop.viewers || [];
      if (viewers.includes(userId)) {
        return ok({ success: true });
      }

      // Add viewer and increment count
      await ddb.send(new UpdateCommand({
        TableName: SCOOPS_TABLE,
        Key: { pk: scoop.pk, sk: scoop.sk },
        UpdateExpression: 'SET viewers = list_append(if_not_exists(viewers, :empty), :viewer), viewCount = if_not_exists(viewCount, :zero) + :one',
        ExpressionAttributeValues: {
          ':viewer': [userId],
          ':empty': [],
          ':zero': 0,
          ':one': 1,
        },
      }));

      return ok({ success: true });
    }

    // Get scoop viewers
    if (method === 'GET' && path.match(/^\/scoops\/[^\/]+\/viewers$/)) {
      if (!SCOOPS_TABLE) return bad('Scoops not enabled', 501);
      if (!userId) return bad('Unauthorized', 401);

      const scoopId = path.split('/')[2];
      if (!scoopId) return bad('Missing scoopId', 400);

      // Find the scoop
      const result = await ddb.send(new ScanCommand({
        TableName: SCOOPS_TABLE,
        FilterExpression: 'id = :id',
        ExpressionAttributeValues: { ':id': scoopId },
        Limit: 1,
      }));

      const scoop = (result.Items || [])[0];
      if (!scoop) return bad('Scoop not found', 404);

      // Only owner can see viewers
      if (scoop.userId !== userId) return bad('Forbidden', 403);

      const viewerIds = scoop.viewers || [];

      // Fetch viewer details
      const items = [];
      for (const viewerId of viewerIds) {
        const userResult = await ddb.send(new GetCommand({
          TableName: USERS_TABLE,
          Key: { pk: `USER#${viewerId}` },
        }));
        const user = userResult.Item;
        if (user) {
          items.push({
            userId: viewerId,
            handle: user.handle || null,
            avatarKey: user.avatarKey || null,
            viewedAt: Date.now(), // We're not tracking exact view time, using now as placeholder
          });
        }
      }

      return ok({ items });
    }

    // ----- default -----
    if (method === 'DELETE') {
      console.error(`[404] DELETE request not matched: route="${route}", path="${path}"`);
    }
    return bad('Not found', 404);

  } catch (err) {
    console.error(err);
    return bad('Server error', 500);
  }
};
