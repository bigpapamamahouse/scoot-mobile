/**
 * Social Service - Handles follows, blocks, and reports
 *
 * Routes:
 *   POST   /follow                    - Follow user
 *   POST   /unfollow                  - Unfollow user
 *   POST   /follow-request            - Send follow request
 *   POST   /follow-cancel             - Cancel follow request
 *   POST   /follow-accept             - Accept follow request
 *   POST   /follow-decline            - Decline follow request
 *   POST   /block                     - Block user
 *   POST   /unblock                   - Unblock user
 *   GET    /blocked                   - Get blocked users
 *   GET    /is-blocked                - Check if blocked
 *   POST   /report                    - Report content
 *   GET    /reports                   - Get reports (admin)
 *   POST   /reports/:id/action        - Take action on report
 *   GET    /u/:handle                 - Get user profile
 *   GET    /u/:handle/followers       - Get followers
 *   GET    /u/:handle/following       - Get following
 *   GET    /u/:handle/posts           - Get user posts
 *
 * Memory: 128 MB (lightweight operations)
 * Timeout: 10 seconds
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
const { normalizePath, getUserFromEvent, isAdmin } = require('/opt/nodejs/auth');
const { userIdFromHandle, fetchUserSummaries } = require('/opt/nodejs/utils');

const { USERS_TABLE, FOLLOWS_TABLE, BLOCKS_TABLE, REPORTS_TABLE, POSTS_TABLE, NOTIFICATIONS_TABLE } = tables;

// Helper: Create notification
async function createNotification(targetUserId, type, fromUserId, postId = null, message = '') {
  if (!NOTIFICATIONS_TABLE || !targetUserId || targetUserId === fromUserId) return;

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
}

// Route handlers
async function follow(event, user) {
  if (!FOLLOWS_TABLE) return bad(event, 'Follows not enabled', 501);

  const body = JSON.parse(event.body || '{}');
  const targetHandle = String(body.handle || '').trim().toLowerCase();

  if (!targetHandle) return bad(event, 'Handle required', 400);

  const targetId = await userIdFromHandle(targetHandle);
  if (!targetId) return bad(event, 'User not found', 404);
  if (targetId === user.userId) return bad(event, 'Cannot follow yourself', 400);

  await ddb.send(new PutCommand({
    TableName: FOLLOWS_TABLE,
    Item: { pk: user.userId, sk: targetId, createdAt: Date.now() },
  }));

  await createNotification(targetId, 'follow', user.userId);

  return ok(event, { success: true, following: true });
}

async function unfollow(event, user) {
  if (!FOLLOWS_TABLE) return bad(event, 'Follows not enabled', 501);

  const body = JSON.parse(event.body || '{}');
  const targetHandle = String(body.handle || '').trim().toLowerCase();

  if (!targetHandle) return bad(event, 'Handle required', 400);

  const targetId = await userIdFromHandle(targetHandle);
  if (!targetId) return bad(event, 'User not found', 404);

  await ddb.send(new DeleteCommand({
    TableName: FOLLOWS_TABLE,
    Key: { pk: user.userId, sk: targetId },
  }));

  return ok(event, { success: true, following: false });
}

async function block(event, user) {
  if (!BLOCKS_TABLE) return bad(event, 'Blocking not enabled', 501);

  const body = JSON.parse(event.body || '{}');
  const targetHandle = String(body.handle || '').trim().toLowerCase();

  if (!targetHandle) return bad(event, 'Handle required', 400);

  const targetId = await userIdFromHandle(targetHandle);
  if (!targetId) return bad(event, 'User not found', 404);
  if (targetId === user.userId) return bad(event, 'Cannot block yourself', 400);

  await ddb.send(new PutCommand({
    TableName: BLOCKS_TABLE,
    Item: {
      pk: `USER#${user.userId}`,
      sk: `BLOCKED#${targetId}`,
      blockedUserId: targetId,
      blockedHandle: targetHandle,
      createdAt: Date.now(),
    },
  }));

  // Also unfollow
  if (FOLLOWS_TABLE) {
    await ddb.send(new DeleteCommand({
      TableName: FOLLOWS_TABLE,
      Key: { pk: user.userId, sk: targetId },
    })).catch(() => {});
    await ddb.send(new DeleteCommand({
      TableName: FOLLOWS_TABLE,
      Key: { pk: targetId, sk: user.userId },
    })).catch(() => {});
  }

  return ok(event, { success: true, blocked: true });
}

async function unblock(event, user) {
  if (!BLOCKS_TABLE) return bad(event, 'Blocking not enabled', 501);

  const body = JSON.parse(event.body || '{}');
  const targetHandle = String(body.handle || '').trim().toLowerCase();

  if (!targetHandle) return bad(event, 'Handle required', 400);

  const targetId = await userIdFromHandle(targetHandle);
  if (!targetId) return bad(event, 'User not found', 404);

  await ddb.send(new DeleteCommand({
    TableName: BLOCKS_TABLE,
    Key: { pk: `USER#${user.userId}`, sk: `BLOCKED#${targetId}` },
  }));

  return ok(event, { success: true, blocked: false });
}

async function getBlocked(event, user) {
  if (!BLOCKS_TABLE) return bad(event, 'Blocking not enabled', 501);

  const result = await ddb.send(new QueryCommand({
    TableName: BLOCKS_TABLE,
    KeyConditionExpression: 'pk = :pk',
    ExpressionAttributeValues: { ':pk': `USER#${user.userId}` },
  }));

  const items = (result.Items || []).map(item => ({
    userId: item.blockedUserId,
    handle: item.blockedHandle,
    createdAt: item.createdAt,
  }));

  return ok(event, { items });
}

async function checkBlocked(event, user) {
  const qs = event?.queryStringParameters || {};
  const targetHandle = String(qs.handle || '').trim().toLowerCase();

  if (!targetHandle) return bad(event, 'Handle required', 400);

  const targetId = await userIdFromHandle(targetHandle);
  if (!targetId) return ok(event, { blocked: false });

  if (!BLOCKS_TABLE) return ok(event, { blocked: false });

  const result = await ddb.send(new GetCommand({
    TableName: BLOCKS_TABLE,
    Key: { pk: `USER#${user.userId}`, sk: `BLOCKED#${targetId}` },
  }));

  return ok(event, { blocked: !!result.Item });
}

async function report(event, user) {
  if (!REPORTS_TABLE) return bad(event, 'Reporting not enabled', 501);

  const body = JSON.parse(event.body || '{}');
  const { type, targetId, postId, reason } = body;

  if (!type || !reason) {
    return bad(event, 'Type and reason required', 400);
  }

  const reportId = randomUUID();
  const now = Date.now();

  await ddb.send(new PutCommand({
    TableName: REPORTS_TABLE,
    Item: {
      pk: `REPORT#${reportId}`,
      sk: String(now),
      id: reportId,
      type,
      targetId,
      postId,
      reason,
      reporterId: user.userId,
      status: 'pending',
      createdAt: now,
    },
  }));

  return ok(event, { success: true, reportId }, 201);
}

async function getReports(event, user) {
  if (!isAdmin(user.email)) return bad(event, 'Forbidden', 403);
  if (!REPORTS_TABLE) return bad(event, 'Reporting not enabled', 501);

  const result = await ddb.send(new ScanCommand({
    TableName: REPORTS_TABLE,
    FilterExpression: 'begins_with(pk, :p)',
    ExpressionAttributeValues: { ':p': 'REPORT#' },
    Limit: 100,
  }));

  const items = (result.Items || []).sort((a, b) => b.createdAt - a.createdAt);

  return ok(event, { items });
}

async function getUserProfile(event, user, handle) {
  const targetId = await userIdFromHandle(handle);
  if (!targetId) return bad(event, 'User not found', 404);

  const userRec = await ddb.send(new GetCommand({
    TableName: USERS_TABLE,
    Key: { pk: `USER#${targetId}` },
  }));

  if (!userRec.Item) return bad(event, 'User not found', 404);

  let isFollowing = false;
  let followsMe = false;

  if (FOLLOWS_TABLE && user.userId !== targetId) {
    const [f1, f2] = await Promise.all([
      ddb.send(new GetCommand({ TableName: FOLLOWS_TABLE, Key: { pk: user.userId, sk: targetId } })),
      ddb.send(new GetCommand({ TableName: FOLLOWS_TABLE, Key: { pk: targetId, sk: user.userId } })),
    ]);
    isFollowing = !!f1.Item;
    followsMe = !!f2.Item;
  }

  // Count followers/following
  let followersCount = 0;
  let followingCount = 0;

  if (FOLLOWS_TABLE) {
    const [followers, following] = await Promise.all([
      ddb.send(new ScanCommand({
        TableName: FOLLOWS_TABLE,
        FilterExpression: 'sk = :t',
        ExpressionAttributeValues: { ':t': targetId },
        Select: 'COUNT',
      })),
      ddb.send(new QueryCommand({
        TableName: FOLLOWS_TABLE,
        KeyConditionExpression: 'pk = :t',
        ExpressionAttributeValues: { ':t': targetId },
        Select: 'COUNT',
      })),
    ]);
    followersCount = followers.Count || 0;
    followingCount = following.Count || 0;
  }

  return ok(event, {
    userId: targetId,
    handle: userRec.Item.handle,
    fullName: userRec.Item.fullName || null,
    avatarKey: userRec.Item.avatarKey || null,
    isFollowing,
    followsMe,
    followersCount,
    followingCount,
    isMe: user.userId === targetId,
  });
}

async function getFollowers(event, user, handle) {
  if (!FOLLOWS_TABLE) return bad(event, 'Follows not enabled', 501);

  const targetId = await userIdFromHandle(handle);
  if (!targetId) return bad(event, 'User not found', 404);

  const result = await ddb.send(new ScanCommand({
    TableName: FOLLOWS_TABLE,
    FilterExpression: 'sk = :t',
    ExpressionAttributeValues: { ':t': targetId },
    Limit: 100,
  }));

  const followerIds = (result.Items || []).map(i => i.pk);
  const summaries = await fetchUserSummaries(followerIds);

  return ok(event, { items: summaries });
}

async function getFollowing(event, user, handle) {
  if (!FOLLOWS_TABLE) return bad(event, 'Follows not enabled', 501);

  const targetId = await userIdFromHandle(handle);
  if (!targetId) return bad(event, 'User not found', 404);

  const result = await ddb.send(new QueryCommand({
    TableName: FOLLOWS_TABLE,
    KeyConditionExpression: 'pk = :t',
    ExpressionAttributeValues: { ':t': targetId },
    Limit: 100,
  }));

  const followingIds = (result.Items || []).map(i => i.sk);
  const summaries = await fetchUserSummaries(followingIds);

  return ok(event, { items: summaries });
}

async function getUserPosts(event, user, handle) {
  const targetId = await userIdFromHandle(handle);
  if (!targetId) return bad(event, 'User not found', 404);

  const result = await ddb.send(new QueryCommand({
    TableName: POSTS_TABLE,
    KeyConditionExpression: 'pk = :pk',
    ExpressionAttributeValues: { ':pk': `USER#${targetId}` },
    ScanIndexForward: false,
    Limit: 50,
  }));

  const items = (result.Items || []).map(i => ({
    id: i.id,
    userId: i.userId,
    username: i.username || 'unknown',
    handle: i.handle || null,
    text: i.text || '',
    imageKey: i.imageKey || null,
    imageAspectRatio: i.imageAspectRatio || null,
    images: i.images || null,
    avatarKey: i.avatarKey || null,
    createdAt: i.createdAt,
  }));

  return ok(event, { items });
}

// Main handler
exports.handler = async (event) => {
  if ((event?.requestContext?.http?.method || event?.httpMethod) === 'OPTIONS') {
    return handleOptions(event);
  }

  const { method, path, route } = normalizePath(event);
  const user = getUserFromEvent(event);

  console.log('[social-service]', route, user.userId ? `user:${user.userId.slice(0, 8)}` : 'anonymous');

  if (!user.userId) {
    return bad(event, 'Unauthorized', 401);
  }

  try {
    // Static routes
    switch (route) {
      case 'POST /follow': return await follow(event, user);
      case 'POST /unfollow': return await unfollow(event, user);
      case 'POST /block': return await block(event, user);
      case 'POST /unblock': return await unblock(event, user);
      case 'GET /blocked': return await getBlocked(event, user);
      case 'GET /is-blocked': return await checkBlocked(event, user);
      case 'POST /report': return await report(event, user);
      case 'GET /reports': return await getReports(event, user);
    }

    // User profile routes /u/:handle
    const userMatch = path.match(/^\/u\/([^\/]+)$/);
    if (userMatch && method === 'GET') {
      return await getUserProfile(event, user, decodeURIComponent(userMatch[1]));
    }

    const followersMatch = path.match(/^\/u\/([^\/]+)\/followers$/);
    if (followersMatch && method === 'GET') {
      return await getFollowers(event, user, decodeURIComponent(followersMatch[1]));
    }

    const followingMatch = path.match(/^\/u\/([^\/]+)\/following$/);
    if (followingMatch && method === 'GET') {
      return await getFollowing(event, user, decodeURIComponent(followingMatch[1]));
    }

    const postsMatch = path.match(/^\/u\/([^\/]+)\/posts$/);
    if (postsMatch && method === 'GET') {
      return await getUserPosts(event, user, decodeURIComponent(postsMatch[1]));
    }

    return bad(event, 'Not found', 404);
  } catch (error) {
    console.error('[social-service] Error:', error);
    return bad(event, 'Internal server error', 500);
  }
};
