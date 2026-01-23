/**
 * Shared DynamoDB client configuration
 * Optimized with request timeout and retry settings
 */
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

// Configure DynamoDB client with optimized settings
const ddbClient = new DynamoDBClient({
  requestHandler: {
    requestTimeout: 3000, // 3 second timeout per request
  },
  maxAttempts: 2, // Reduce retries to prevent timeout cascade
});

const ddb = DynamoDBDocumentClient.from(ddbClient, {
  marshallOptions: { removeUndefinedValues: true },
});

// Table names from environment
const tables = {
  POSTS_TABLE: process.env.POSTS_TABLE,
  USERS_TABLE: process.env.USERS_TABLE,
  INVITES_TABLE: process.env.INVITES_TABLE,
  FOLLOWS_TABLE: process.env.FOLLOWS_TABLE,
  MEDIA_BUCKET: process.env.MEDIA_BUCKET,
  COMMENTS_TABLE: process.env.COMMENTS_TABLE,
  REACTIONS_TABLE: process.env.REACTIONS_TABLE,
  NOTIFICATIONS_TABLE: process.env.NOTIFICATIONS_TABLE,
  PUSH_TOKENS_TABLE: process.env.PUSH_TOKENS_TABLE,
  REPORTS_TABLE: process.env.REPORTS_TABLE,
  BLOCKS_TABLE: process.env.BLOCKS_TABLE,
  SCOOPS_TABLE: process.env.SCOOPS_TABLE,
  USER_POOL_ID: process.env.USER_POOL_ID,
};

module.exports = {
  ddb,
  ddbClient,
  tables,
  // Re-export commands for convenience
  GetCommand,
  PutCommand,
  QueryCommand,
  ScanCommand,
  DeleteCommand,
  UpdateCommand,
  BatchGetCommand,
};
