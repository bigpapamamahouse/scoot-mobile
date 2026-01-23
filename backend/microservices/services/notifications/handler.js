/**
 * Notifications Service - Handles notifications and push tokens
 *
 * Routes:
 *   GET    /notifications             - Get user notifications
 *   POST   /push/register             - Register push token
 *   DELETE /push/unregister           - Unregister push token
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
  DeleteCommand,
  UpdateCommand,
} = require('/opt/nodejs/db-client');
const { ok, bad, handleOptions } = require('/opt/nodejs/response');
const { normalizePath, getUserFromEvent } = require('/opt/nodejs/auth');
const { fetchUserSummaries } = require('/opt/nodejs/utils');

const { NOTIFICATIONS_TABLE, PUSH_TOKENS_TABLE } = tables;

// Send push notification via Expo
async function sendPushNotification(userId, title, body, data = {}) {
  if (!PUSH_TOKENS_TABLE || !userId) return;

  try {
    const tokensQuery = await ddb.send(new QueryCommand({
      TableName: PUSH_TOKENS_TABLE,
      KeyConditionExpression: 'pk = :p',
      ExpressionAttributeValues: { ':p': `USER#${userId}` },
    }));

    const tokens = (tokensQuery.Items || []).map(item => item.token).filter(Boolean);
    if (tokens.length === 0) return;

    const messages = tokens.map(token => ({
      to: token,
      sound: 'default',
      title,
      body,
      data,
      priority: 'high',
      channelId: 'default',
    }));

    const response = await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(messages),
    });

    const result = await response.json();
    console.log(`[Push] Sent to ${tokens.length} device(s):`, result);
  } catch (error) {
    console.error('[Push] Error:', error);
  }
}

// Route handlers
async function getNotifications(event, user) {
  if (!NOTIFICATIONS_TABLE) return bad(event, 'Notifications not enabled', 501);

  const qs = event?.queryStringParameters || {};
  const markRead = qs.markRead === '1';

  const result = await ddb.send(new QueryCommand({
    TableName: NOTIFICATIONS_TABLE,
    KeyConditionExpression: 'pk = :p',
    ExpressionAttributeValues: { ':p': `USER#${user.userId}` },
    ScanIndexForward: false,
    Limit: 50,
  }));

  const items = result.Items || [];

  // Mark as read if requested
  if (markRead) {
    for (const item of items) {
      await ddb.send(new UpdateCommand({
        TableName: NOTIFICATIONS_TABLE,
        Key: { pk: `USER#${user.userId}`, sk: item.sk },
        UpdateExpression: 'SET #r = :t',
        ExpressionAttributeNames: { '#r': 'read' },
        ExpressionAttributeValues: { ':t': true },
      }));
    }
  }

  // Enrich with user info
  const fromIds = items.map(it => it.fromUserId).filter(Boolean);
  let summaries = [];
  try {
    summaries = await fetchUserSummaries(fromIds);
  } catch (e) {}

  const byId = Object.fromEntries(summaries.map(s => [String(s.userId), s]));

  const enriched = items.map(it => {
    const prof = byId[String(it.fromUserId)] || {};
    const handle = prof.handle || null;
    return {
      ...it,
      fromHandle: handle,
      avatarKey: prof.avatarKey || null,
      userUrl: handle ? `/u/${handle}` : undefined,
      postUrl: it.postId ? `/p/${encodeURIComponent(String(it.postId))}` : undefined,
    };
  });

  return ok(event, { items: enriched });
}

async function registerPushToken(event, user) {
  if (!PUSH_TOKENS_TABLE) return bad(event, 'Push notifications not enabled', 501);

  const body = JSON.parse(event.body || '{}');
  const token = String(body.token || '').trim();
  const platform = String(body.platform || 'ios').toLowerCase();

  if (!token) return bad(event, 'Token required', 400);

  const tokenHash = crypto.createHash('sha256').update(token).digest('hex').slice(0, 16);

  await ddb.send(new PutCommand({
    TableName: PUSH_TOKENS_TABLE,
    Item: {
      pk: `USER#${user.userId}`,
      sk: `TOKEN#${tokenHash}`,
      token,
      platform,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    },
  }));

  return ok(event, { success: true });
}

async function unregisterPushToken(event, user) {
  if (!PUSH_TOKENS_TABLE) return bad(event, 'Push notifications not enabled', 501);

  const body = JSON.parse(event.body || '{}');
  const token = String(body.token || '').trim();

  if (!token) return bad(event, 'Token required', 400);

  const tokenHash = crypto.createHash('sha256').update(token).digest('hex').slice(0, 16);

  await ddb.send(new DeleteCommand({
    TableName: PUSH_TOKENS_TABLE,
    Key: { pk: `USER#${user.userId}`, sk: `TOKEN#${tokenHash}` },
  }));

  return ok(event, { success: true });
}

// Main handler
exports.handler = async (event) => {
  if ((event?.requestContext?.http?.method || event?.httpMethod) === 'OPTIONS') {
    return handleOptions(event);
  }

  const { route } = normalizePath(event);
  const user = getUserFromEvent(event);

  console.log('[notifications-service]', route, user.userId ? `user:${user.userId.slice(0, 8)}` : 'anonymous');

  if (!user.userId) {
    return bad(event, 'Unauthorized', 401);
  }

  try {
    switch (route) {
      case 'GET /notifications':
        return await getNotifications(event, user);
      case 'POST /push/register':
        return await registerPushToken(event, user);
      case 'DELETE /push/unregister':
        return await unregisterPushToken(event, user);
      default:
        return bad(event, 'Not found', 404);
    }
  } catch (error) {
    console.error('[notifications-service] Error:', error);
    return bad(event, 'Internal server error', 500);
  }
};

// Export for use by other services
module.exports.sendPushNotification = sendPushNotification;
