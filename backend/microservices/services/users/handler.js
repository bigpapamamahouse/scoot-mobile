/**
 * Users Service - Handles user profile and account management
 *
 * Routes:
 *   GET    /me                        - Get current user profile
 *   PATCH  /me                        - Update profile (fullName, handle)
 *   POST   /me                        - Update fullName (alias)
 *   DELETE /me                        - Delete account
 *   POST   /me/avatar                 - Set avatar
 *   GET    /me/notification-preferences  - Get notification prefs
 *   PATCH  /me/notification-preferences  - Update notification prefs
 *   POST   /me/accept-terms           - Accept terms of service
 *   GET    /me/invite                 - Get invite code
 *   POST   /me/invite                 - Generate invite code
 *   GET    /me/invites                - List invites
 *   POST   /username                  - Set username/handle
 *   GET    /search                    - Search users
 *
 * Memory: 128 MB (lightweight operations)
 * Timeout: 10 seconds
 */

const crypto = require('crypto');
const {
  ddb,
  tables,
  GetCommand,
  PutCommand,
  QueryCommand,
  ScanCommand,
  DeleteCommand,
  UpdateCommand,
} = require('/opt/nodejs/db-client');
const { ok, bad, handleOptions } = require('/opt/nodejs/response');
const { normalizePath, getUserFromEvent, isAdmin } = require('/opt/nodejs/auth');

const { USERS_TABLE, INVITES_TABLE, FOLLOWS_TABLE, POSTS_TABLE, COMMENTS_TABLE, REACTIONS_TABLE, NOTIFICATIONS_TABLE, PUSH_TOKENS_TABLE, BLOCKS_TABLE, SCOOPS_TABLE, USER_POOL_ID } = tables;

// Cognito client - lazy loaded
let cognitoClient = null;
async function getCognito() {
  if (!cognitoClient) {
    const { CognitoIdentityProviderClient } = require('@aws-sdk/client-cognito-identity-provider');
    cognitoClient = new CognitoIdentityProviderClient({});
  }
  return cognitoClient;
}

/**
 * Generate or retrieve invite code for user
 */
async function generateUserInviteCode(userId) {
  if (!INVITES_TABLE || !userId) return null;

  try {
    // Check for existing invite via GSI
    const existing = await ddb.send(new QueryCommand({
      TableName: INVITES_TABLE,
      IndexName: 'byUserId',
      KeyConditionExpression: 'userId = :uid',
      ExpressionAttributeValues: { ':uid': userId },
      Limit: 1,
    }));

    if (existing.Items && existing.Items[0]) {
      return existing.Items[0].code;
    }
  } catch (e) {
    // Try scan fallback
    try {
      const scanResult = await ddb.send(new ScanCommand({
        TableName: INVITES_TABLE,
        FilterExpression: 'userId = :uid',
        ExpressionAttributeValues: { ':uid': userId },
        Limit: 10,
      }));

      if (scanResult.Items && scanResult.Items.length > 0) {
        return scanResult.Items[0].code;
      }
    } catch (scanError) {
      console.error('[Invites] Scan fallback failed:', scanError.message);
    }
  }

  // Generate new code
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
    return code;
  } catch (e) {
    console.error('[Invites] Failed to create invite code:', e);
    return null;
  }
}

/**
 * Get user notification preferences
 */
async function getUserNotificationPreferences(userId) {
  const defaults = { mentions: true, comments: true, reactions: true };
  if (!USERS_TABLE || !userId) return defaults;

  try {
    const r = await ddb.send(new GetCommand({
      TableName: USERS_TABLE,
      Key: { pk: `USER#${userId}` },
      ProjectionExpression: 'notificationPreferences',
    }));
    return r.Item?.notificationPreferences || defaults;
  } catch (e) {
    console.error('[Preferences] Failed to get notification preferences:', e);
    return defaults;
  }
}

// Route handlers
async function getMe(event, user) {
  const r = await ddb.send(new GetCommand({
    TableName: USERS_TABLE,
    Key: { pk: `USER#${user.userId}` },
    ConsistentRead: true,
  }));

  let inviteCode = r.Item?.inviteCode ?? null;
  if (!inviteCode) {
    try {
      inviteCode = await generateUserInviteCode(user.userId);
      if (inviteCode) {
        await ddb.send(new UpdateCommand({
          TableName: USERS_TABLE,
          Key: { pk: `USER#${user.userId}` },
          UpdateExpression: 'SET inviteCode = :code',
          ExpressionAttributeValues: { ':code': inviteCode },
        }));
      }
    } catch (e) {
      console.error('[Invites] Failed to get invite code:', e);
    }
  }

  return ok(event, {
    userId: user.userId,
    handle: r.Item?.handle ?? null,
    email: user.email,
    avatarKey: r.Item?.avatarKey ?? null,
    fullName: r.Item?.fullName ?? null,
    termsAccepted: r.Item?.termsAccepted ?? false,
    inviteCode,
  });
}

async function patchMe(event, user) {
  const body = JSON.parse(event.body || '{}');

  const rawFullName = (body.fullName ?? '').toString().trim();
  const fullName = rawFullName ? rawFullName.slice(0, 80) : null;

  const rawHandle = (body.handle || body.username || '').toString().trim().toLowerCase();
  const handle = rawHandle ? rawHandle.slice(0, 20) : null;

  if (handle && !/^[a-z0-9_]{3,20}$/.test(handle)) {
    return bad(event, 'Handle must be 3-20 chars, letters/numbers/underscore', 400);
  }

  // Check if handle is taken
  if (handle) {
    const existing = await ddb.send(new GetCommand({
      TableName: USERS_TABLE,
      Key: { pk: `HANDLE#${handle}` },
      ConsistentRead: true,
    }));
    if (existing.Item && existing.Item.userId !== user.userId) {
      return bad(event, 'Handle already taken', 409);
    }
  }

  // Build update
  const updates = ['#uid = :u'];
  const names = { '#uid': 'userId' };
  const values = { ':u': user.userId };

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

  await ddb.send(new UpdateCommand({
    TableName: USERS_TABLE,
    Key: { pk: `USER#${user.userId}` },
    UpdateExpression: `SET ${updates.join(', ')}`,
    ExpressionAttributeNames: names,
    ExpressionAttributeValues: values,
  }));

  if (handle) {
    await ddb.send(new PutCommand({
      TableName: USERS_TABLE,
      Item: { pk: `HANDLE#${handle}`, userId: user.userId, type: 'HANDLE', handle },
    }));
  }

  return ok(event, { ok: true, fullName, handle });
}

async function postMe(event, user) {
  const body = JSON.parse(event.body || '{}');
  const raw = (body.fullName ?? '').toString().trim();
  const fullName = raw ? raw.slice(0, 80) : null;

  await ddb.send(new UpdateCommand({
    TableName: USERS_TABLE,
    Key: { pk: `USER#${user.userId}` },
    UpdateExpression: 'SET #uid = :u, #fn = :n',
    ExpressionAttributeNames: { '#uid': 'userId', '#fn': 'fullName' },
    ExpressionAttributeValues: { ':u': user.userId, ':n': fullName },
  }));

  return ok(event, { ok: true, fullName });
}

async function postAvatar(event, user) {
  const { key } = JSON.parse(event.body || '{}');
  if (!key) return bad(event, 'Missing key', 400);

  await ddb.send(new UpdateCommand({
    TableName: USERS_TABLE,
    Key: { pk: `USER#${user.userId}` },
    UpdateExpression: 'SET avatarKey = :key, userId = :uid',
    ExpressionAttributeValues: { ':key': key, ':uid': user.userId },
  }));

  const u = await ddb.send(new GetCommand({ TableName: USERS_TABLE, Key: { pk: `USER#${user.userId}` } }));
  if (u.Item?.handle) {
    await ddb.send(new UpdateCommand({
      TableName: USERS_TABLE,
      Key: { pk: `HANDLE#${u.Item.handle}` },
      UpdateExpression: 'SET avatarKey = :key, userId = :uid',
      ExpressionAttributeValues: { ':key': key, ':uid': user.userId },
    }));
  }

  return ok(event, { success: true, avatarKey: key });
}

async function deleteMe(event, user) {
  console.log(`[DELETE /me] Starting account deletion for user ${user.userId}`);

  try {
    // Get user's handle
    const userRecord = await ddb.send(new GetCommand({
      TableName: USERS_TABLE,
      Key: { pk: `USER#${user.userId}` },
      ConsistentRead: true,
    }));
    const userHandle = userRecord.Item?.handle || null;

    // Delete posts
    if (POSTS_TABLE) {
      const posts = await ddb.send(new QueryCommand({
        TableName: POSTS_TABLE,
        KeyConditionExpression: 'pk = :p',
        ExpressionAttributeValues: { ':p': `USER#${user.userId}` },
      }));
      for (const post of (posts.Items || [])) {
        await ddb.send(new DeleteCommand({ TableName: POSTS_TABLE, Key: { pk: post.pk, sk: post.sk } }));
      }
    }

    // Delete notifications
    if (NOTIFICATIONS_TABLE) {
      const notifs = await ddb.send(new QueryCommand({
        TableName: NOTIFICATIONS_TABLE,
        KeyConditionExpression: 'pk = :p',
        ExpressionAttributeValues: { ':p': `USER#${user.userId}` },
      }));
      for (const n of (notifs.Items || [])) {
        await ddb.send(new DeleteCommand({ TableName: NOTIFICATIONS_TABLE, Key: { pk: n.pk, sk: n.sk } }));
      }
    }

    // Delete follows
    if (FOLLOWS_TABLE) {
      const follows = await ddb.send(new QueryCommand({
        TableName: FOLLOWS_TABLE,
        KeyConditionExpression: 'pk = :p',
        ExpressionAttributeValues: { ':p': user.userId },
      }));
      for (const f of (follows.Items || [])) {
        await ddb.send(new DeleteCommand({ TableName: FOLLOWS_TABLE, Key: { pk: f.pk, sk: f.sk } }));
      }
    }

    // Delete push tokens
    if (PUSH_TOKENS_TABLE) {
      const tokens = await ddb.send(new QueryCommand({
        TableName: PUSH_TOKENS_TABLE,
        KeyConditionExpression: 'pk = :p',
        ExpressionAttributeValues: { ':p': `USER#${user.userId}` },
      }));
      for (const t of (tokens.Items || [])) {
        await ddb.send(new DeleteCommand({ TableName: PUSH_TOKENS_TABLE, Key: { pk: t.pk, sk: t.sk } }));
      }
    }

    // Delete HANDLE mapping
    if (userHandle) {
      await ddb.send(new DeleteCommand({ TableName: USERS_TABLE, Key: { pk: `HANDLE#${userHandle}` } }));
    }

    // Delete user record
    await ddb.send(new DeleteCommand({ TableName: USERS_TABLE, Key: { pk: `USER#${user.userId}` } }));

    // Delete Cognito user
    if (USER_POOL_ID) {
      try {
        const cognito = await getCognito();
        const { AdminDeleteUserCommand } = require('@aws-sdk/client-cognito-identity-provider');
        await cognito.send(new AdminDeleteUserCommand({
          UserPoolId: USER_POOL_ID,
          Username: user.userId,
        }));
      } catch (e) {
        console.error('[DELETE /me] Failed to delete Cognito user:', e);
      }
    }

    return ok(event, { success: true, message: 'Account deleted' });
  } catch (e) {
    console.error('[DELETE /me] Error:', e);
    return bad(event, 'Failed to delete account', 500);
  }
}

async function getNotificationPreferences(event, user) {
  const prefs = await getUserNotificationPreferences(user.userId);
  return ok(event, prefs);
}

async function patchNotificationPreferences(event, user) {
  const body = JSON.parse(event.body || '{}');
  const validKeys = ['mentions', 'comments', 'reactions'];
  const updates = {};

  for (const key of validKeys) {
    if (key in body && typeof body[key] === 'boolean') {
      updates[key] = body[key];
    }
  }

  if (Object.keys(updates).length === 0) {
    return bad(event, 'No valid preferences provided', 400);
  }

  const currentPrefs = await getUserNotificationPreferences(user.userId);
  const newPrefs = { ...currentPrefs, ...updates };

  await ddb.send(new UpdateCommand({
    TableName: USERS_TABLE,
    Key: { pk: `USER#${user.userId}` },
    UpdateExpression: 'SET notificationPreferences = :prefs',
    ExpressionAttributeValues: { ':prefs': newPrefs },
  }));

  return ok(event, newPrefs);
}

async function acceptTerms(event, user) {
  await ddb.send(new UpdateCommand({
    TableName: USERS_TABLE,
    Key: { pk: `USER#${user.userId}` },
    UpdateExpression: 'SET termsAccepted = :true, termsAcceptedAt = :now',
    ExpressionAttributeValues: { ':true': true, ':now': Date.now() },
  }));
  return ok(event, { success: true, termsAccepted: true });
}

async function getInvite(event, user) {
  if (!INVITES_TABLE) return bad(event, 'Invites not enabled', 501);

  const inviteCode = await generateUserInviteCode(user.userId);
  if (!inviteCode) return bad(event, 'Failed to generate invite code', 500);

  const invite = await ddb.send(new GetCommand({
    TableName: INVITES_TABLE,
    Key: { code: inviteCode },
  }));

  return ok(event, {
    code: inviteCode,
    usesRemaining: invite.Item?.usesRemaining ?? 10,
    inviteCode,
  });
}

async function postInvite(event, user) {
  if (!INVITES_TABLE) return bad(event, 'Invites not enabled', 501);

  const body = JSON.parse(event.body || '{}');
  const uses = Math.max(1, Math.min(100, Number(body.uses || 10)));
  const inviteCode = await generateUserInviteCode(user.userId);

  if (!inviteCode) return bad(event, 'Failed to generate invite code', 500);

  return ok(event, { code: inviteCode, uses, inviteCode });
}

async function getInvites(event, user) {
  if (!INVITES_TABLE) return bad(event, 'Invites not enabled', 501);

  try {
    const result = await ddb.send(new QueryCommand({
      TableName: INVITES_TABLE,
      IndexName: 'byUserId',
      KeyConditionExpression: 'userId = :uid',
      ExpressionAttributeValues: { ':uid': user.userId },
    }));

    const items = (result.Items || []).map(it => ({
      code: it.code,
      usesRemaining: it.usesRemaining ?? 0,
      createdAt: it.createdAt ?? null,
    }));

    if (items.length === 0) {
      const code = await generateUserInviteCode(user.userId);
      if (code) {
        return ok(event, {
          items: [{ code, usesRemaining: 10, createdAt: Date.now() }],
          inviteCode: code,
        });
      }
    }

    return ok(event, { items, inviteCode: items[0]?.code ?? null });
  } catch (e) {
    console.error('[Invites] Failed to list invites:', e);
    const code = await generateUserInviteCode(user.userId);
    if (code) {
      return ok(event, {
        items: [{ code, usesRemaining: 10, createdAt: Date.now() }],
        inviteCode: code,
      });
    }
    return bad(event, 'Failed to retrieve invites', 500);
  }
}

async function postUsername(event, user) {
  const body = JSON.parse(event.body || '{}');
  const candidate = String(body.handle || '').trim().toLowerCase();

  if (!/^[a-z0-9_]{3,20}$/.test(candidate)) {
    return bad(event, 'Handle must be 3-20 chars, letters/numbers/underscore', 400);
  }

  const taken = await ddb.send(new GetCommand({
    TableName: USERS_TABLE,
    Key: { pk: `HANDLE#${candidate}` },
    ConsistentRead: true,
  }));

  if (taken.Item) return bad(event, 'Handle already taken', 409);

  await ddb.send(new PutCommand({
    TableName: USERS_TABLE,
    Item: { pk: `HANDLE#${candidate}`, userId: user.userId },
    ConditionExpression: 'attribute_not_exists(pk)',
  }));

  await ddb.send(new PutCommand({
    TableName: USERS_TABLE,
    Item: { pk: `USER#${user.userId}`, handle: candidate, type: 'HANDLE', userId: user.userId },
    ConditionExpression: 'attribute_not_exists(pk)',
  }));

  return ok(event, { handle: candidate });
}

async function getSearch(event, user) {
  const qs = event?.queryStringParameters || {};
  const q = String(qs.q || '').replace(/^@/, '').trim().toLowerCase();

  if (!q) return ok(event, { items: [] });

  let items = [];

  // Try GSI first
  try {
    const qr = await ddb.send(new QueryCommand({
      TableName: USERS_TABLE,
      IndexName: 'byHandle',
      KeyConditionExpression: '#t = :H AND begins_with(#h, :q)',
      ExpressionAttributeNames: { '#t': 'type', '#h': 'handle' },
      ExpressionAttributeValues: { ':H': 'HANDLE', ':q': q },
      Limit: 25,
    }));
    items = qr.Items || [];
  } catch (e) {
    console.error('GSI query failed:', e);
  }

  // Scan fallback
  const scan = await ddb.send(new ScanCommand({
    TableName: USERS_TABLE,
    ProjectionExpression: 'pk, handle, userId, fullName, avatarKey',
    FilterExpression: 'begins_with(pk, :p)',
    ExpressionAttributeValues: { ':p': 'USER#' },
    Limit: 1000,
  }));

  const extra = (scan.Items || []).filter(it => {
    const h = (it.handle || '').toLowerCase();
    const n = (it.fullName || '').toLowerCase();
    return h.includes(q) || n.includes(q);
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
        Key: { pk: user.userId, sk: targetId },
      }));
      following = !!rel.Item;
    }

    out.push({
      handle,
      fullName: it.fullName || null,
      avatarKey: it.avatarKey || null,
      isFollowing: following,
    });
  }

  return ok(event, { items: out });
}

// Main handler
exports.handler = async (event) => {
  // Handle OPTIONS preflight
  if ((event?.requestContext?.http?.method || event?.httpMethod) === 'OPTIONS') {
    return handleOptions(event);
  }

  const { route } = normalizePath(event);
  const user = getUserFromEvent(event);

  console.log('[users-service]', route, user.userId ? `user:${user.userId.slice(0, 8)}` : 'anonymous');

  // Auth check for all routes
  if (!user.userId) {
    return bad(event, 'Unauthorized', 401);
  }

  try {
    switch (route) {
      case 'GET /me':
        return await getMe(event, user);
      case 'PATCH /me':
        return await patchMe(event, user);
      case 'POST /me':
        return await postMe(event, user);
      case 'POST /me/avatar':
        return await postAvatar(event, user);
      case 'DELETE /me':
        return await deleteMe(event, user);
      case 'GET /me/notification-preferences':
        return await getNotificationPreferences(event, user);
      case 'PATCH /me/notification-preferences':
        return await patchNotificationPreferences(event, user);
      case 'POST /me/accept-terms':
        return await acceptTerms(event, user);
      case 'GET /me/invite':
        return await getInvite(event, user);
      case 'POST /me/invite':
        return await postInvite(event, user);
      case 'GET /me/invites':
        return await getInvites(event, user);
      case 'POST /username':
        return await postUsername(event, user);
      case 'GET /search':
        return await getSearch(event, user);
      default:
        return bad(event, 'Not found', 404);
    }
  } catch (error) {
    console.error('[users-service] Error:', error);
    return bad(event, 'Internal server error', 500);
  }
};
