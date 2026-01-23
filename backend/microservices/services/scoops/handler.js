/**
 * Scoops Service - Handles ephemeral stories/scoops
 *
 * Routes:
 *   GET    /scoops/feed               - Get scoops feed
 *   GET    /scoops/me                 - Get my scoops
 *   POST   /scoops                    - Create scoop
 *   GET    /scoops/user/:userId       - Get user's scoops
 *   GET    /scoops/:id                - Get single scoop
 *   DELETE /scoops/:id                - Delete scoop
 *   POST   /scoops/:id/view           - Record view
 *   GET    /scoops/:id/viewers        - Get viewers
 *
 * Memory: 512 MB (handles video scoops)
 * Timeout: 30 seconds
 */

const { randomUUID } = require('crypto');
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
const { normalizePath, getUserFromEvent } = require('/opt/nodejs/auth');
const { fetchUserSummaries, getHandleForUserId } = require('/opt/nodejs/utils');

const { SCOOPS_TABLE, FOLLOWS_TABLE, BLOCKS_TABLE, USERS_TABLE } = tables;

// Scoop expiry: 24 hours
const SCOOP_TTL_MS = 24 * 60 * 60 * 1000;

// Helper: Get blocked user IDs
async function getBlockedUserIds(userId) {
  if (!BLOCKS_TABLE || !userId) return [];
  try {
    const result = await ddb.send(new QueryCommand({
      TableName: BLOCKS_TABLE,
      KeyConditionExpression: 'pk = :pk',
      ExpressionAttributeValues: { ':pk': `USER#${userId}` },
    }));
    return (result.Items || []).map(item => item.blockedUserId).filter(Boolean);
  } catch (e) {
    return [];
  }
}

// Filter expired scoops
function filterExpired(scoops) {
  const now = Date.now();
  return scoops.filter(s => (now - (s.createdAt || 0)) < SCOOP_TTL_MS);
}

// Route handlers
async function getScoopsFeed(event, user) {
  if (!SCOOPS_TABLE) return bad(event, 'Scoops not enabled', 501);

  // Get following list
  let followIds = new Set([user.userId]);

  if (FOLLOWS_TABLE) {
    const following = await ddb.send(new QueryCommand({
      TableName: FOLLOWS_TABLE,
      KeyConditionExpression: 'pk = :me',
      ExpressionAttributeValues: { ':me': user.userId },
      ProjectionExpression: 'sk',
      Limit: 500,
    }));
    (following.Items || []).forEach(i => followIds.add(i.sk));
  }

  // Get blocked users
  const blockedIds = new Set(await getBlockedUserIds(user.userId));

  // Fetch scoops for each followed user
  const allScoops = [];
  for (const fid of followIds) {
    if (blockedIds.has(fid)) continue;

    const result = await ddb.send(new QueryCommand({
      TableName: SCOOPS_TABLE,
      KeyConditionExpression: 'pk = :pk',
      ExpressionAttributeValues: { ':pk': `USER#${fid}` },
      ScanIndexForward: false,
      Limit: 10,
    }));

    const validScoops = filterExpired(result.Items || []);
    allScoops.push(...validScoops);
  }

  // Group by user
  const byUser = new Map();
  for (const scoop of allScoops) {
    const uid = scoop.userId;
    if (!byUser.has(uid)) {
      byUser.set(uid, []);
    }
    byUser.get(uid).push(scoop);
  }

  // Get user info
  const userIds = Array.from(byUser.keys());
  const summaries = await fetchUserSummaries(userIds);
  const userMap = Object.fromEntries(summaries.map(s => [s.userId, s]));

  // Build feed grouped by user
  const feed = [];
  for (const [uid, scoops] of byUser) {
    const userInfo = userMap[uid] || {};
    feed.push({
      userId: uid,
      handle: userInfo.handle || null,
      avatarKey: userInfo.avatarKey || null,
      fullName: userInfo.fullName || null,
      scoops: scoops.sort((a, b) => a.createdAt - b.createdAt).map(s => ({
        id: s.id,
        mediaKey: s.mediaKey,
        mediaType: s.mediaType,
        caption: s.caption || null,
        createdAt: s.createdAt,
        viewCount: s.viewCount || 0,
      })),
      latestAt: Math.max(...scoops.map(s => s.createdAt)),
    });
  }

  // Sort by most recent scoop
  feed.sort((a, b) => b.latestAt - a.latestAt);

  return ok(event, { items: feed });
}

async function getMyScoops(event, user) {
  if (!SCOOPS_TABLE) return bad(event, 'Scoops not enabled', 501);

  const result = await ddb.send(new QueryCommand({
    TableName: SCOOPS_TABLE,
    KeyConditionExpression: 'pk = :pk',
    ExpressionAttributeValues: { ':pk': `USER#${user.userId}` },
    ScanIndexForward: false,
    Limit: 20,
  }));

  const scoops = filterExpired(result.Items || []).map(s => ({
    id: s.id,
    mediaKey: s.mediaKey,
    mediaType: s.mediaType,
    caption: s.caption || null,
    createdAt: s.createdAt,
    viewCount: s.viewCount || 0,
  }));

  return ok(event, { items: scoops });
}

async function createScoop(event, user) {
  if (!SCOOPS_TABLE) return bad(event, 'Scoops not enabled', 501);

  const body = JSON.parse(event.body || '{}');
  const { mediaKey, mediaType, caption } = body;

  if (!mediaKey) return bad(event, 'Media key required', 400);

  const now = Date.now();
  const scoopId = randomUUID();

  const item = {
    pk: `USER#${user.userId}`,
    sk: `SCOOP#${now}#${scoopId}`,
    id: scoopId,
    userId: user.userId,
    mediaKey,
    mediaType: mediaType || 'image',
    caption: caption ? String(caption).slice(0, 500) : null,
    createdAt: now,
    viewCount: 0,
    viewers: [],
    ttl: Math.floor((now + SCOOP_TTL_MS) / 1000), // DynamoDB TTL
  };

  await ddb.send(new PutCommand({ TableName: SCOOPS_TABLE, Item: item }));

  return ok(event, {
    id: scoopId,
    mediaKey,
    mediaType: item.mediaType,
    caption: item.caption,
    createdAt: now,
  }, 201);
}

async function getUserScoops(event, user, targetUserId) {
  if (!SCOOPS_TABLE) return bad(event, 'Scoops not enabled', 501);

  // Check blocks
  const blockedIds = await getBlockedUserIds(user.userId);
  if (blockedIds.includes(targetUserId)) {
    return ok(event, { items: [] });
  }

  const result = await ddb.send(new QueryCommand({
    TableName: SCOOPS_TABLE,
    KeyConditionExpression: 'pk = :pk',
    ExpressionAttributeValues: { ':pk': `USER#${targetUserId}` },
    ScanIndexForward: false,
    Limit: 20,
  }));

  const scoops = filterExpired(result.Items || []).map(s => ({
    id: s.id,
    mediaKey: s.mediaKey,
    mediaType: s.mediaType,
    caption: s.caption || null,
    createdAt: s.createdAt,
    viewCount: s.viewCount || 0,
  }));

  return ok(event, { items: scoops });
}

async function getScoop(event, user, scoopId) {
  if (!SCOOPS_TABLE) return bad(event, 'Scoops not enabled', 501);

  // Find the scoop
  const scan = await ddb.send(new ScanCommand({
    TableName: SCOOPS_TABLE,
    FilterExpression: 'id = :id',
    ExpressionAttributeValues: { ':id': scoopId },
    Limit: 1,
  }));

  const scoop = scan.Items?.[0];
  if (!scoop) return bad(event, 'Scoop not found', 404);

  // Check if expired
  if (Date.now() - scoop.createdAt >= SCOOP_TTL_MS) {
    return bad(event, 'Scoop expired', 404);
  }

  // Get creator info
  const handle = await getHandleForUserId(scoop.userId);

  return ok(event, {
    id: scoop.id,
    userId: scoop.userId,
    handle,
    mediaKey: scoop.mediaKey,
    mediaType: scoop.mediaType,
    caption: scoop.caption || null,
    createdAt: scoop.createdAt,
    viewCount: scoop.viewCount || 0,
    isOwner: scoop.userId === user.userId,
  });
}

async function deleteScoop(event, user, scoopId) {
  if (!SCOOPS_TABLE) return bad(event, 'Scoops not enabled', 501);

  // Find user's scoop
  const result = await ddb.send(new QueryCommand({
    TableName: SCOOPS_TABLE,
    KeyConditionExpression: 'pk = :pk',
    ExpressionAttributeValues: { ':pk': `USER#${user.userId}` },
  }));

  const scoop = (result.Items || []).find(s => s.id === scoopId);
  if (!scoop) return bad(event, 'Scoop not found', 404);

  await ddb.send(new DeleteCommand({
    TableName: SCOOPS_TABLE,
    Key: { pk: scoop.pk, sk: scoop.sk },
  }));

  return ok(event, { success: true });
}

async function recordView(event, user, scoopId) {
  if (!SCOOPS_TABLE) return bad(event, 'Scoops not enabled', 501);

  // Find the scoop
  const scan = await ddb.send(new ScanCommand({
    TableName: SCOOPS_TABLE,
    FilterExpression: 'id = :id',
    ExpressionAttributeValues: { ':id': scoopId },
    Limit: 1,
  }));

  const scoop = scan.Items?.[0];
  if (!scoop) return bad(event, 'Scoop not found', 404);

  // Don't count self-views
  if (scoop.userId === user.userId) {
    return ok(event, { success: true, viewCount: scoop.viewCount || 0 });
  }

  // Update view count and add viewer
  const viewers = scoop.viewers || [];
  if (!viewers.includes(user.userId)) {
    viewers.push(user.userId);
  }

  await ddb.send(new UpdateCommand({
    TableName: SCOOPS_TABLE,
    Key: { pk: scoop.pk, sk: scoop.sk },
    UpdateExpression: 'SET viewCount = viewCount + :one, viewers = :v',
    ExpressionAttributeValues: { ':one': 1, ':v': viewers },
  }));

  return ok(event, { success: true, viewCount: (scoop.viewCount || 0) + 1 });
}

async function getViewers(event, user, scoopId) {
  if (!SCOOPS_TABLE) return bad(event, 'Scoops not enabled', 501);

  // Find user's scoop
  const result = await ddb.send(new QueryCommand({
    TableName: SCOOPS_TABLE,
    KeyConditionExpression: 'pk = :pk',
    ExpressionAttributeValues: { ':pk': `USER#${user.userId}` },
  }));

  const scoop = (result.Items || []).find(s => s.id === scoopId);
  if (!scoop) return bad(event, 'Scoop not found or not yours', 404);

  const viewerIds = scoop.viewers || [];
  const summaries = await fetchUserSummaries(viewerIds);

  return ok(event, {
    items: summaries,
    viewCount: scoop.viewCount || 0,
  });
}

// Main handler
exports.handler = async (event) => {
  if ((event?.requestContext?.http?.method || event?.httpMethod) === 'OPTIONS') {
    return handleOptions(event);
  }

  const { method, path, route } = normalizePath(event);
  const user = getUserFromEvent(event);

  console.log('[scoops-service]', route, user.userId ? `user:${user.userId.slice(0, 8)}` : 'anonymous');

  if (!user.userId) {
    return bad(event, 'Unauthorized', 401);
  }

  try {
    // Static routes
    if (route === 'GET /scoops/feed') return await getScoopsFeed(event, user);
    if (route === 'GET /scoops/me') return await getMyScoops(event, user);
    if (route === 'POST /scoops') return await createScoop(event, user);

    // /scoops/user/:userId
    if (method === 'GET' && path.startsWith('/scoops/user/')) {
      const targetUserId = path.replace('/scoops/user/', '');
      return await getUserScoops(event, user, targetUserId);
    }

    // /scoops/:id/view
    const viewMatch = path.match(/^\/scoops\/([^\/]+)\/view$/);
    if (viewMatch && method === 'POST') {
      return await recordView(event, user, viewMatch[1]);
    }

    // /scoops/:id/viewers
    const viewersMatch = path.match(/^\/scoops\/([^\/]+)\/viewers$/);
    if (viewersMatch && method === 'GET') {
      return await getViewers(event, user, viewersMatch[1]);
    }

    // /scoops/:id (GET or DELETE)
    const scoopMatch = path.match(/^\/scoops\/([^\/]+)$/);
    if (scoopMatch && !path.includes('/user/')) {
      const scoopId = scoopMatch[1];
      if (method === 'GET') return await getScoop(event, user, scoopId);
      if (method === 'DELETE') return await deleteScoop(event, user, scoopId);
    }

    return bad(event, 'Not found', 404);
  } catch (error) {
    console.error('[scoops-service] Error:', error);
    return bad(event, 'Internal server error', 500);
  }
};
