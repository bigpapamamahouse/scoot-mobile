/**
 * Shared Lambda Layer - Main Entry Point
 *
 * Usage in Lambda functions:
 *   const shared = require('/opt/nodejs/index');
 *   // or import specific modules:
 *   const { ddb, tables } = require('/opt/nodejs/db-client');
 *   const { ok, bad } = require('/opt/nodejs/response');
 */

const dbClient = require('./db-client');
const response = require('./response');
const auth = require('./auth');
const utils = require('./utils');

module.exports = {
  // Database
  ...dbClient,

  // Response helpers
  ...response,

  // Auth helpers
  ...auth,

  // Utilities
  ...utils,
};
