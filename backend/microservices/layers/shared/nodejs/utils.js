/**
 * Shared utility functions
 */
const { ddb, tables, GetCommand, QueryCommand, BatchGetCommand } = require('./db-client');

/**
 * Get handle for a user ID
 */
async function getHandleForUserId(userId) {
  const r = await ddb.send(new GetCommand({
    TableName: tables.USERS_TABLE,
    Key: { pk: `USER#${userId}` },
    ConsistentRead: true,
  }));
  return r.Item?.handle || null;
}

/**
 * Resolve a userId from a handle
 */
async function userIdFromHandle(handle) {
  if (!handle) return null;
  const h = String(handle).trim().toLowerCase();

  // Primary: HANDLE mapping row -> USER id
  try {
    const r = await ddb.send(new GetCommand({
      TableName: tables.USERS_TABLE,
      Key: { pk: `HANDLE#${h}` },
      ProjectionExpression: 'userId',
      ConsistentRead: true,
    }));
    if (r.Item && r.Item.userId) return String(r.Item.userId);
  } catch (e) {}

  // Optional fallback via GSI if present
  try {
    const qr = await ddb.send(new QueryCommand({
      TableName: tables.USERS_TABLE,
      IndexName: 'byHandle',
      KeyConditionExpression: '#t = :t AND #h = :h',
      ExpressionAttributeNames: { '#t': 'type', '#h': 'handle' },
      ExpressionAttributeValues: { ':t': 'HANDLE', ':h': h },
      Limit: 1,
    }));
    const it = (qr.Items || [])[0];
    if (it && it.userId) return String(it.userId);
  } catch (e) {}

  return null;
}

/**
 * Get handle + avatarKey for a list of userIds
 */
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
        [tables.USERS_TABLE]: {
          Keys: ids.map(id => ({ pk: `USER#${id}` })),
          ProjectionExpression: 'pk, handle, userId, avatarKey, fullName',
        }
      }
    }));
    const rows = (resp.Responses?.[tables.USERS_TABLE] || []);
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

  // Limited fallback for individual lookups
  if (out.length === 0 && unique.length > 0) {
    console.warn(`[fetchUserSummaries] BatchGet returned 0 results for ${unique.length} users - using limited fallback`);
    const limit = Math.min(unique.length, 5);
    for (let i = 0; i < limit; i++) {
      const id = unique[i];
      try {
        const r = await ddb.send(new GetCommand({
          TableName: tables.USERS_TABLE,
          Key: { pk: `USER#${id}` },
          ProjectionExpression: 'pk, handle, userId, avatarKey, fullName',
          ConsistentRead: false,
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
      }
    }
  }
  return out;
}

/**
 * Parse JSON body from event safely
 */
function parseBody(event) {
  try {
    return JSON.parse(event.body || '{}');
  } catch (e) {
    return {};
  }
}

/**
 * Get query string parameters safely
 */
function getQueryParams(event) {
  return event?.queryStringParameters || {};
}

module.exports = {
  getHandleForUserId,
  userIdFromHandle,
  fetchUserSummaries,
  parseBody,
  getQueryParams,
};
