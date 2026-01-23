/**
 * Shared response helpers with CORS support
 */

const ALLOWED_ORIGINS = new Set([
  'https://app.scooterbooter.com',
  'http://localhost:5173',
]);

/**
 * Generate CORS headers for the request origin
 */
function corsFor(event) {
  const origin = event?.headers?.origin || event?.headers?.Origin || '';
  const allow = ALLOWED_ORIGINS.has(origin) ? origin : 'https://app.scooterbooter.com';

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

/**
 * Create a success response
 */
function ok(event, body, status = 200, extraHeaders = {}) {
  return {
    statusCode: status,
    headers: {
      ...corsFor(event),
      'Content-Type': 'application/json; charset=utf-8',
      ...extraHeaders,
    },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  };
}

/**
 * Create an error response
 */
function bad(event, message = 'Bad Request', status = 400) {
  return ok(event, { message }, status);
}

/**
 * Handle OPTIONS preflight requests
 */
function handleOptions(event) {
  return ok(event, {});
}

module.exports = {
  ok,
  bad,
  corsFor,
  handleOptions,
  ALLOWED_ORIGINS,
};
