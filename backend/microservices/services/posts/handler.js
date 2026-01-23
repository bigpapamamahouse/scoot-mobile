/**
 * Posts Service - Handles posts, feed, comments, and reactions
 *
 * Routes:
 *   GET    /feed                      - Get feed
 *   POST   /posts                     - Create post
 *   GET    /posts/:id                 - Get single post
 *   PATCH  /posts/:id                 - Update post
 *   DELETE /posts/:id                 - Delete post
 *   GET    /comments/:postId          - Get comments
 *   POST   /comments/:postId          - Add comment
 *   PATCH  /comments/:postId          - Update comment
 *   DELETE /comments/:postId          - Delete comment
 *   GET    /reactions/:postId         - Get reactions
 *   POST   /reactions/:postId         - Toggle reaction
 *
 * Memory: 256 MB (handles feed aggregation)
 * Timeout: 15 seconds
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
  BatchGetCommand,
} = require('/opt/nodejs/db-client');
const { ok, bad, handleOptions } = require('/opt/nodejs/response');
const { normalizePath, getUserFromEvent } = require('/opt/nodejs/auth');
const { fetchUserSummaries, getHandleForUserId } = require('/opt/nodejs/utils');

const { POSTS_TABLE, USERS_TABLE, FOLLOWS_TABLE, COMMENTS_TABLE, REACTIONS_TABLE, NOTIFICATIONS_TABLE, BLOCKS_TABLE, PUSH_TOKENS_TABLE } = tables;

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

// Helper: Check bidirectional block
async function hasBlockBetween(userA, userB) {
  if (!userA || !userB || !BLOCKS_TABLE) return false;
  const [aBlocksB, bBlocksA] = await Promise.all([
    ddb.send(new GetCommand({ TableName: BLOCKS_TABLE, Key: { pk: `USER#${userA}`, sk: `BLOCKED#${userB}` } })).then(r => !!r.Item).catch(() => false),
    ddb.send(new GetCommand({ TableName: BLOCKS_TABLE, Key: { pk: `USER#${userB}`, sk: `BLOCKED#${userA}` } })).then(r => !!r.Item).catch(() => false),
  ]);
  return aBlocksB || bBlocksA;
}

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
async function getFeed(event, user) {
  const qs = event?.queryStringParameters || {};
  const limit = Math.min(parseInt(qs.limit) || 20, 100);
  const offset = Math.max(parseInt(qs.offset) || 0, 0);

  try {
    if (FOLLOWS_TABLE) {
      const following = await ddb.send(new QueryCommand({
        TableName: FOLLOWS_TABLE,
        KeyConditionExpression: 'pk = :me',
        ExpressionAttributeValues: { ':me': user.userId },
        ProjectionExpression: 'sk',
        Limit: 500,
      }));

      const followIds = new Set((following.Items || []).map(i => i.sk));
      followIds.add(user.userId);

      if (followIds.size > 0) {
        const results = [];
        for (const fid of followIds) {
          const r = await ddb.send(new QueryCommand({
            TableName: POSTS_TABLE,
            KeyConditionExpression: 'pk = :p',
            ExpressionAttributeValues: { ':p': `USER#${fid}` },
            ScanIndexForward: false,
            Limit: 50,
          }));
          (r.Items || []).forEach(i => results.push(i));
        }

        results.sort((a, b) => Number(b.createdAt || 0) - Number(a.createdAt || 0));

        let items = results.slice(offset, offset + limit).map(i => ({
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

        // Filter blocked users
        if (BLOCKS_TABLE) {
          const blockedUserIds = await getBlockedUserIds(user.userId);
          if (blockedUserIds.length > 0) {
            const blockedSet = new Set(blockedUserIds);
            items = items.filter(p => !blockedSet.has(p.userId));
          }
        }

        return ok(event, { items, hasMore: results.length > offset + limit });
      }
    }

    // Fallback: global feed
    const scan = await ddb.send(new ScanCommand({
      TableName: POSTS_TABLE,
      Limit: 200,
    }));

    const all = (scan.Items || [])
      .filter(i => i.pk?.startsWith('USER#'))
      .sort((a, b) => Number(b.createdAt || 0) - Number(a.createdAt || 0));

    const items = all.slice(offset, offset + limit).map(i => ({
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

    return ok(event, { items, hasMore: all.length > offset + limit });
  } catch (error) {
    console.error('[Feed] Error:', error);
    return bad(event, 'Failed to fetch feed', 500);
  }
}

async function createPost(event, user) {
  const body = JSON.parse(event.body || '{}');
  const text = String(body.text || '').trim().slice(0, 5000);
  const imageKey = body.imageKey || null;
  const imageAspectRatio = body.imageAspectRatio || null;
  const images = body.images || null;

  if (!text && !imageKey && !images) {
    return bad(event, 'Post must have text or image', 400);
  }

  // Get user info
  const userRec = await ddb.send(new GetCommand({
    TableName: USERS_TABLE,
    Key: { pk: `USER#${user.userId}` },
  }));

  const handle = userRec.Item?.handle || null;
  const avatarKey = userRec.Item?.avatarKey || null;

  const now = Date.now();
  const postId = randomUUID();

  const item = {
    pk: `USER#${user.userId}`,
    sk: `POST#${now}#${postId}`,
    id: postId,
    userId: user.userId,
    username: user.username,
    handle,
    text,
    imageKey,
    imageAspectRatio,
    images,
    avatarKey,
    createdAt: now,
    updatedAt: now,
  };

  await ddb.send(new PutCommand({ TableName: POSTS_TABLE, Item: item }));

  return ok(event, {
    id: postId,
    userId: user.userId,
    username: user.username,
    handle,
    text,
    imageKey,
    imageAspectRatio,
    images,
    avatarKey,
    createdAt: now,
  }, 201);
}

async function getPost(event, user, postId) {
  // Try to find the post
  const scan = await ddb.send(new ScanCommand({
    TableName: POSTS_TABLE,
    FilterExpression: 'id = :id',
    ExpressionAttributeValues: { ':id': postId },
    Limit: 1,
  }));

  const post = scan.Items?.[0];
  if (!post) return bad(event, 'Post not found', 404);

  // Check for blocks
  if (await hasBlockBetween(user.userId, post.userId)) {
    return bad(event, 'Post not found', 404);
  }

  return ok(event, {
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

async function deletePost(event, user, postId) {
  // Find the post
  const posts = await ddb.send(new QueryCommand({
    TableName: POSTS_TABLE,
    KeyConditionExpression: 'pk = :pk',
    ExpressionAttributeValues: { ':pk': `USER#${user.userId}` },
  }));

  const post = (posts.Items || []).find(p => p.id === postId);
  if (!post) return bad(event, 'Post not found', 404);

  await ddb.send(new DeleteCommand({
    TableName: POSTS_TABLE,
    Key: { pk: post.pk, sk: post.sk },
  }));

  return ok(event, { success: true });
}

async function getComments(event, user, postId) {
  if (!COMMENTS_TABLE) return bad(event, 'Comments not enabled', 501);

  const result = await ddb.send(new QueryCommand({
    TableName: COMMENTS_TABLE,
    KeyConditionExpression: 'pk = :pk',
    ExpressionAttributeValues: { ':pk': `POST#${postId}` },
    ScanIndexForward: true,
    Limit: 100,
  }));

  const items = result.Items || [];
  const userIds = items.map(c => c.userId).filter(Boolean);
  const summaries = await fetchUserSummaries(userIds);
  const byId = Object.fromEntries(summaries.map(s => [s.userId, s]));

  const comments = items.map(c => ({
    id: c.id,
    postId,
    userId: c.userId,
    text: c.text,
    parentId: c.parentId || null,
    handle: byId[c.userId]?.handle || null,
    avatarKey: byId[c.userId]?.avatarKey || null,
    createdAt: c.createdAt,
  }));

  return ok(event, { items: comments });
}

async function createComment(event, user, postId) {
  if (!COMMENTS_TABLE) return bad(event, 'Comments not enabled', 501);

  const body = JSON.parse(event.body || '{}');
  const text = String(body.text || '').trim().slice(0, 2000);
  const parentId = body.parentId || null;

  if (!text) return bad(event, 'Comment text required', 400);

  const now = Date.now();
  const commentId = randomUUID();

  await ddb.send(new PutCommand({
    TableName: COMMENTS_TABLE,
    Item: {
      pk: `POST#${postId}`,
      sk: `C#${now}#${commentId}`,
      id: commentId,
      postId,
      userId: user.userId,
      text,
      parentId,
      createdAt: now,
    },
  }));

  // Get post owner for notification
  const postScan = await ddb.send(new ScanCommand({
    TableName: POSTS_TABLE,
    FilterExpression: 'id = :id',
    ExpressionAttributeValues: { ':id': postId },
    Limit: 1,
  }));

  const post = postScan.Items?.[0];
  if (post && post.userId !== user.userId) {
    await createNotification(post.userId, 'comment', user.userId, postId);
  }

  const handle = await getHandleForUserId(user.userId);

  return ok(event, {
    id: commentId,
    postId,
    userId: user.userId,
    text,
    parentId,
    handle,
    createdAt: now,
  }, 201);
}

async function getReactions(event, user, postId) {
  if (!REACTIONS_TABLE) return bad(event, 'Reactions not enabled', 501);

  const result = await ddb.send(new QueryCommand({
    TableName: REACTIONS_TABLE,
    KeyConditionExpression: 'pk = :pk',
    ExpressionAttributeValues: { ':pk': `POST#${postId}` },
  }));

  const counts = {};
  let userReaction = null;
  const reactedUsers = [];

  for (const item of (result.Items || [])) {
    if (item.sk.startsWith('COUNT#')) {
      const emoji = item.sk.replace('COUNT#', '');
      counts[emoji] = item.count || 0;
    } else if (item.sk === `USER#${user.userId}`) {
      userReaction = item.emoji;
    } else if (item.sk.startsWith('USER#')) {
      reactedUsers.push({ userId: item.sk.replace('USER#', ''), emoji: item.emoji });
    }
  }

  return ok(event, { counts, userReaction, reactedUsers: reactedUsers.slice(0, 20) });
}

async function toggleReaction(event, user, postId) {
  if (!REACTIONS_TABLE) return bad(event, 'Reactions not enabled', 501);

  const body = JSON.parse(event.body || '{}');
  const emoji = String(body.emoji || '').trim();

  if (!emoji) return bad(event, 'Emoji required', 400);

  // Check current reaction
  const current = await ddb.send(new GetCommand({
    TableName: REACTIONS_TABLE,
    Key: { pk: `POST#${postId}`, sk: `USER#${user.userId}` },
  }));

  const existingEmoji = current.Item?.emoji;

  if (existingEmoji === emoji) {
    // Remove reaction
    await ddb.send(new DeleteCommand({
      TableName: REACTIONS_TABLE,
      Key: { pk: `POST#${postId}`, sk: `USER#${user.userId}` },
    }));
    await ddb.send(new UpdateCommand({
      TableName: REACTIONS_TABLE,
      Key: { pk: `POST#${postId}`, sk: `COUNT#${emoji}` },
      UpdateExpression: 'ADD #c :neg',
      ExpressionAttributeNames: { '#c': 'count' },
      ExpressionAttributeValues: { ':neg': -1 },
    }));
    return ok(event, { action: 'removed', emoji });
  }

  // Remove old reaction if exists
  if (existingEmoji) {
    await ddb.send(new UpdateCommand({
      TableName: REACTIONS_TABLE,
      Key: { pk: `POST#${postId}`, sk: `COUNT#${existingEmoji}` },
      UpdateExpression: 'ADD #c :neg',
      ExpressionAttributeNames: { '#c': 'count' },
      ExpressionAttributeValues: { ':neg': -1 },
    }));
  }

  // Add new reaction
  await ddb.send(new PutCommand({
    TableName: REACTIONS_TABLE,
    Item: {
      pk: `POST#${postId}`,
      sk: `USER#${user.userId}`,
      emoji,
      createdAt: Date.now(),
    },
  }));

  await ddb.send(new UpdateCommand({
    TableName: REACTIONS_TABLE,
    Key: { pk: `POST#${postId}`, sk: `COUNT#${emoji}` },
    UpdateExpression: 'ADD #c :one',
    ExpressionAttributeNames: { '#c': 'count' },
    ExpressionAttributeValues: { ':one': 1 },
  }));

  // Notify post owner
  const postScan = await ddb.send(new ScanCommand({
    TableName: POSTS_TABLE,
    FilterExpression: 'id = :id',
    ExpressionAttributeValues: { ':id': postId },
    Limit: 1,
  }));

  const post = postScan.Items?.[0];
  if (post && post.userId !== user.userId) {
    await createNotification(post.userId, 'reaction', user.userId, postId);
  }

  return ok(event, { action: 'added', emoji });
}

// Main handler
exports.handler = async (event) => {
  if ((event?.requestContext?.http?.method || event?.httpMethod) === 'OPTIONS') {
    return handleOptions(event);
  }

  const { method, path, route } = normalizePath(event);
  const user = getUserFromEvent(event);

  console.log('[posts-service]', route, user.userId ? `user:${user.userId.slice(0, 8)}` : 'anonymous');

  if (!user.userId) {
    return bad(event, 'Unauthorized', 401);
  }

  try {
    // Static routes
    if (route === 'GET /feed') return await getFeed(event, user);
    if (route === 'POST /posts') return await createPost(event, user);

    // Dynamic routes
    const postMatch = path.match(/^\/posts\/([^\/]+)$/);
    if (postMatch) {
      const postId = postMatch[1];
      if (method === 'GET') return await getPost(event, user, postId);
      if (method === 'DELETE') return await deletePost(event, user, postId);
    }

    const commentsMatch = path.match(/^\/comments\/([^\/]+)$/);
    if (commentsMatch) {
      const postId = commentsMatch[1];
      if (method === 'GET') return await getComments(event, user, postId);
      if (method === 'POST') return await createComment(event, user, postId);
    }

    const reactionsMatch = path.match(/^\/reactions\/([^\/]+)$/);
    if (reactionsMatch) {
      const postId = reactionsMatch[1];
      if (method === 'GET') return await getReactions(event, user, postId);
      if (method === 'POST') return await toggleReaction(event, user, postId);
    }

    return bad(event, 'Not found', 404);
  } catch (error) {
    console.error('[posts-service] Error:', error);
    return bad(event, 'Internal server error', 500);
  }
};
