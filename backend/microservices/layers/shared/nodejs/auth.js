/**
 * Shared authentication helpers
 */

const ADMIN_EMAILS = (process.env.ADMIN_EMAILS || '')
  .split(',')
  .map(s => s.trim().toLowerCase())
  .filter(Boolean);

/**
 * Extract JWT claims from API Gateway event
 * Supports both API Gateway v1 (REST) and v2 (HTTP) payloads
 */
function claimsFrom(event) {
  return event?.requestContext?.authorizer?.jwt?.claims || {};
}

/**
 * Normalize path from API Gateway event
 * Handles both REST and HTTP API payloads
 */
function normalizePath(event) {
  const method = (event?.httpMethod || event?.requestContext?.http?.method || '').toUpperCase();
  const rawPath = event?.path || event?.rawPath || event?.requestContext?.http?.path || '';
  const stage = event?.requestContext?.stage || '';

  let path = rawPath || '/';
  // Strip stage if it's part of the path
  if (stage && path.startsWith(`/${stage}`)) {
    path = path.slice(stage.length + 1);
  }

  // Clean up the path
  path = ('/' + path.split('?')[0]).replace(/\/{2,}/g, '/').replace(/\/+$/g, '') || '/';

  return { method, rawPath, stage, path, route: `${method} ${path}` };
}

/**
 * Check if user is an admin
 */
function isAdmin(email) {
  return ADMIN_EMAILS.includes((email || '').toLowerCase());
}

/**
 * Extract user info from event
 */
function getUserFromEvent(event) {
  const claims = claimsFrom(event);
  return {
    userId: claims.sub,
    email: (claims.email || '').toLowerCase(),
    username: claims['cognito:username'] || claims.email || claims.sub || 'user',
    isAdmin: isAdmin(claims.email),
  };
}

module.exports = {
  claimsFrom,
  normalizePath,
  isAdmin,
  getUserFromEvent,
  ADMIN_EMAILS,
};
