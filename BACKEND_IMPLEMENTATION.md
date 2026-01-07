# DynamoDB Backend Implementation for Multi-Image Posts

Complete backend implementation guide for AWS Lambda + DynamoDB + API Gateway.

## Table of Contents
1. [DynamoDB Schema](#dynamodb-schema)
2. [Lambda Functions](#lambda-functions)
3. [Deployment Steps](#deployment-steps)
4. [Testing](#testing)

---

## DynamoDB Schema

### Table Structure

**Table Name:** `scoot-mobile-posts` (or your existing table name)

**Primary Key:**
- **PK** (String): Partition Key
- **SK** (String): Sort Key

**Global Secondary Indexes:**
- **GSI1:** For querying user posts
  - GSI1PK (String): Partition Key
  - GSI1SK (String): Sort Key

**Example Items:**

```javascript
// Post with multiple images (NEW)
{
  PK: "POST#abc123",
  SK: "POST#abc123",
  GSI1PK: "USER#user456",
  GSI1SK: "POST#2025-01-06T10:00:00Z",

  id: "abc123",
  userId: "user456",
  handle: "johndoe",
  text: "Check out my photos!",

  // NEW: Array of images
  images: [
    {
      key: "uploads/user456/img1.jpg",
      aspectRatio: 1.5,
      width: 1920,
      height: 1280,
      order: 0
    },
    {
      key: "uploads/user456/img2.jpg",
      aspectRatio: 0.75,
      width: 1280,
      height: 1920,
      order: 1
    }
  ],

  // For backward compatibility
  imageKey: "uploads/user456/img1.jpg",
  imageAspectRatio: 1.5,

  createdAt: "2025-01-06T10:00:00Z",
  reactionCount: 0,
  commentCount: 0,
  type: "post"
}

// Legacy post with single image (STILL WORKS)
{
  PK: "POST#xyz789",
  SK: "POST#xyz789",
  GSI1PK: "USER#user456",
  GSI1SK: "POST#2025-01-05T15:30:00Z",

  id: "xyz789",
  userId: "user456",
  handle: "johndoe",
  text: "Old post",
  imageKey: "uploads/user456/old.jpg",
  imageAspectRatio: 1.33,

  createdAt: "2025-01-05T15:30:00Z",
  reactionCount: 5,
  commentCount: 2,
  type: "post"
}
```

---

## Lambda Functions

### 1. Create Post (POST /posts)

**File:** `lambda/createPost.js`

```javascript
const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, PutCommand } = require('@aws-sdk/lib-dynamodb');
const { v4: uuidv4 } = require('uuid');

const client = new DynamoDBClient({});
const dynamodb = DynamoDBDocumentClient.from(client);

const TABLE_NAME = process.env.TABLE_NAME || 'scoot-mobile-posts';

exports.handler = async (event) => {
  console.log('Event:', JSON.stringify(event, null, 2));

  try {
    // Parse request body
    const body = JSON.parse(event.body || '{}');
    const { text, images, imageKey, imageAspectRatio } = body;

    // Get user from authorizer context
    const userId = event.requestContext?.authorizer?.claims?.sub;
    const userHandle = event.requestContext?.authorizer?.claims?.['cognito:username'];

    if (!userId) {
      return {
        statusCode: 401,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: 'Unauthorized' }),
      };
    }

    // Validation
    if (!text?.trim() && !images?.length && !imageKey) {
      return {
        statusCode: 400,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          error: 'Post must contain text or at least one image',
        }),
      };
    }

    if (text && text.length > 500) {
      return {
        statusCode: 400,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: 'Text cannot exceed 500 characters' }),
      };
    }

    // Validate images array
    if (images) {
      if (!Array.isArray(images) || images.length > 10) {
        return {
          statusCode: 400,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            error: 'Images must be an array with max 10 items',
          }),
        };
      }

      // Validate each image
      for (const img of images) {
        if (!img.key || typeof img.aspectRatio !== 'number') {
          return {
            statusCode: 400,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              error: 'Each image must have key and aspectRatio',
            }),
          };
        }

        // Security: Verify image key belongs to this user
        const expectedPrefix = `uploads/${userId}/`;
        if (!img.key.startsWith(expectedPrefix)) {
          return {
            statusCode: 403,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ error: 'Unauthorized image key' }),
          };
        }
      }
    }

    // Create post item
    const postId = uuidv4();
    const now = new Date().toISOString();

    const postItem = {
      PK: `POST#${postId}`,
      SK: `POST#${postId}`,
      GSI1PK: `USER#${userId}`,
      GSI1SK: `POST#${now}`,

      id: postId,
      userId: userId,
      handle: userHandle,
      text: text?.trim() || '',
      createdAt: now,
      reactionCount: 0,
      commentCount: 0,
      type: 'post',
    };

    // Add images (new format)
    if (images && images.length > 0) {
      postItem.images = images;
      // Set first image for backward compatibility
      postItem.imageKey = images[0].key;
      postItem.imageAspectRatio = images[0].aspectRatio;

      console.log(`Creating post with ${images.length} images`);
    }
    // Legacy single image
    else if (imageKey) {
      postItem.imageKey = imageKey;
      if (imageAspectRatio) {
        postItem.imageAspectRatio = imageAspectRatio;
      }

      console.log('Creating post with single imageKey (legacy)');
    }

    // Save to DynamoDB
    await dynamodb.send(
      new PutCommand({
        TableName: TABLE_NAME,
        Item: postItem,
      })
    );

    console.log('Post created successfully:', postId);

    // Format response
    const response = formatPostResponse(postItem);

    return {
      statusCode: 201,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
      body: JSON.stringify(response),
    };
  } catch (error) {
    console.error('Error creating post:', error);
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'Failed to create post' }),
    };
  }
};

function formatPostResponse(item) {
  return {
    id: item.id,
    userId: item.userId,
    handle: item.handle || null,
    text: item.text,

    // Multi-image support
    images: item.images || null,

    // Legacy fields for backward compatibility
    imageKey: item.imageKey || null,
    imageAspectRatio: item.imageAspectRatio || null,

    createdAt: item.createdAt,
    updatedAt: item.updatedAt || null,
    reactionCount: item.reactionCount || 0,
    commentCount: item.commentCount || 0,
  };
}
```

---

### 2. Get Feed (GET /feed)

**File:** `lambda/getFeed.js`

```javascript
const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, QueryCommand } = require('@aws-sdk/lib-dynamodb');

const client = new DynamoDBClient({});
const dynamodb = DynamoDBDocumentClient.from(client);

const TABLE_NAME = process.env.TABLE_NAME || 'scoot-mobile-posts';

exports.handler = async (event) => {
  console.log('Event:', JSON.stringify(event, null, 2));

  try {
    // Get user from authorizer
    const userId = event.requestContext?.authorizer?.claims?.sub;

    if (!userId) {
      return {
        statusCode: 401,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: 'Unauthorized' }),
      };
    }

    // Parse query parameters
    const limit = parseInt(event.queryStringParameters?.limit || '20');
    const cursor = event.queryStringParameters?.cursor;

    // Step 1: Get list of users this user follows
    const followsResult = await dynamodb.send(
      new QueryCommand({
        TableName: TABLE_NAME,
        KeyConditionExpression: 'PK = :pk AND begins_with(SK, :sk)',
        ExpressionAttributeValues: {
          ':pk': `USER#${userId}`,
          ':sk': 'FOLLOWS#',
        },
      })
    );

    const followedUserIds = followsResult.Items?.map((item) =>
      item.SK.replace('FOLLOWS#USER#', '')
    ) || [];

    // Add own userId to see own posts in feed
    followedUserIds.push(userId);

    console.log(`Fetching feed for ${followedUserIds.length} users`);

    // Step 2: Query posts from each followed user
    const postQueries = followedUserIds.slice(0, 100).map((followedUserId) =>
      dynamodb.send(
        new QueryCommand({
          TableName: TABLE_NAME,
          IndexName: 'GSI1',
          KeyConditionExpression: 'GSI1PK = :pk AND begins_with(GSI1SK, :sk)',
          ExpressionAttributeValues: {
            ':pk': `USER#${followedUserId}`,
            ':sk': 'POST#',
          },
          ScanIndexForward: false, // Newest first
          Limit: 5, // Get recent 5 posts per user
        })
      )
    );

    const results = await Promise.all(postQueries);

    // Step 3: Merge and sort all posts
    const allPosts = results.flatMap((result) => result.Items || []);
    allPosts.sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );

    // Step 4: Take top N posts
    const posts = allPosts.slice(0, limit).map(formatPostResponse);

    console.log(`Returning ${posts.length} posts`);

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
      body: JSON.stringify({ posts }),
    };
  } catch (error) {
    console.error('Error fetching feed:', error);
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'Failed to fetch feed' }),
    };
  }
};

function formatPostResponse(item) {
  return {
    id: item.id,
    userId: item.userId,
    handle: item.handle || null,
    text: item.text,
    images: item.images || null,
    imageKey: item.imageKey || null,
    imageAspectRatio: item.imageAspectRatio || null,
    createdAt: item.createdAt,
    updatedAt: item.updatedAt || null,
    reactionCount: item.reactionCount || 0,
    commentCount: item.commentCount || 0,
  };
}
```

---

### 3. Get Single Post (GET /posts/:id or GET /p/:id)

**File:** `lambda/getPost.js`

```javascript
const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, GetCommand } = require('@aws-sdk/lib-dynamodb');

const client = new DynamoDBClient({});
const dynamodb = DynamoDBDocumentClient.from(client);

const TABLE_NAME = process.env.TABLE_NAME || 'scoot-mobile-posts';

exports.handler = async (event) => {
  console.log('Event:', JSON.stringify(event, null, 2));

  try {
    // Get post ID from path parameters
    const postId = event.pathParameters?.id || event.pathParameters?.postId;

    if (!postId) {
      return {
        statusCode: 400,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: 'Post ID required' }),
      };
    }

    // Get post from DynamoDB
    const result = await dynamodb.send(
      new GetCommand({
        TableName: TABLE_NAME,
        Key: {
          PK: `POST#${postId}`,
          SK: `POST#${postId}`,
        },
      })
    );

    if (!result.Item) {
      return {
        statusCode: 404,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: 'Post not found' }),
      };
    }

    const post = formatPostResponse(result.Item);

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
      body: JSON.stringify(post),
    };
  } catch (error) {
    console.error('Error fetching post:', error);
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'Failed to fetch post' }),
    };
  }
};

function formatPostResponse(item) {
  return {
    id: item.id,
    userId: item.userId,
    handle: item.handle || null,
    text: item.text,
    images: item.images || null,
    imageKey: item.imageKey || null,
    imageAspectRatio: item.imageAspectRatio || null,
    createdAt: item.createdAt,
    updatedAt: item.updatedAt || null,
    reactionCount: item.reactionCount || 0,
    commentCount: item.commentCount || 0,
  };
}
```

---

## Deployment Steps

### Prerequisites

1. AWS Account with:
   - DynamoDB table created
   - API Gateway configured
   - Cognito User Pool for authentication
   - IAM roles for Lambda

### Step 1: Install Dependencies

```bash
# In each lambda function directory
npm init -y
npm install @aws-sdk/client-dynamodb @aws-sdk/lib-dynamodb uuid
```

### Step 2: Package Lambda Functions

```bash
# For each function
cd lambda/createPost
zip -r createPost.zip .
cd ../..

cd lambda/getFeed
zip -r getFeed.zip .
cd ../..

cd lambda/getPost
zip -r getPost.zip .
cd ../..
```

### Step 3: Deploy to AWS Lambda

**Using AWS CLI:**

```bash
# Create or update createPost function
aws lambda create-function \
  --function-name scoot-createPost \
  --runtime nodejs20.x \
  --role arn:aws:iam::YOUR_ACCOUNT:role/lambda-dynamodb-role \
  --handler index.handler \
  --zip-file fileb://lambda/createPost/createPost.zip \
  --environment Variables="{TABLE_NAME=scoot-mobile-posts}" \
  --timeout 10

# Create or update getFeed function
aws lambda create-function \
  --function-name scoot-getFeed \
  --runtime nodejs20.x \
  --role arn:aws:iam::YOUR_ACCOUNT:role/lambda-dynamodb-role \
  --handler index.handler \
  --zip-file fileb://lambda/getFeed/getFeed.zip \
  --environment Variables="{TABLE_NAME=scoot-mobile-posts}" \
  --timeout 10

# Create or update getPost function
aws lambda create-function \
  --function-name scoot-getPost \
  --runtime nodejs20.x \
  --role arn:aws:iam::YOUR_ACCOUNT:role/lambda-dynamodb-role \
  --handler index.handler \
  --zip-file fileb://lambda/getPost/getPost.zip \
  --environment Variables="{TABLE_NAME=scoot-mobile-posts}" \
  --timeout 10
```

### Step 4: Configure API Gateway

**Routes:**
- `POST /posts` → `scoot-createPost` Lambda
- `GET /feed` → `scoot-getFeed` Lambda
- `GET /posts/{id}` → `scoot-getPost` Lambda
- `GET /p/{id}` → `scoot-getPost` Lambda

**Enable CORS for all routes:**
```json
{
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET,POST,PUT,DELETE,OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type,Authorization"
}
```

---

## Testing

### Test 1: Create Post with Multiple Images

```bash
curl -X POST https://your-api.execute-api.us-east-1.amazonaws.com/posts \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -d '{
    "text": "Test post with 3 images",
    "images": [
      {
        "key": "uploads/user123/img1.jpg",
        "aspectRatio": 1.5,
        "width": 1920,
        "height": 1280,
        "order": 0
      },
      {
        "key": "uploads/user123/img2.jpg",
        "aspectRatio": 0.75,
        "width": 1280,
        "height": 1920,
        "order": 1
      },
      {
        "key": "uploads/user123/img3.jpg",
        "aspectRatio": 1.0,
        "width": 1080,
        "height": 1080,
        "order": 2
      }
    ]
  }'
```

**Expected Response:**
```json
{
  "id": "abc-123-def",
  "userId": "user123",
  "handle": "johndoe",
  "text": "Test post with 3 images",
  "images": [
    {
      "key": "uploads/user123/img1.jpg",
      "aspectRatio": 1.5,
      "width": 1920,
      "height": 1280,
      "order": 0
    },
    {
      "key": "uploads/user123/img2.jpg",
      "aspectRatio": 0.75,
      "width": 1280,
      "height": 1920,
      "order": 1
    },
    {
      "key": "uploads/user123/img3.jpg",
      "aspectRatio": 1.0,
      "width": 1080,
      "height": 1080,
      "order": 2
    }
  ],
  "imageKey": "uploads/user123/img1.jpg",
  "imageAspectRatio": 1.5,
  "createdAt": "2025-01-06T...",
  "reactionCount": 0,
  "commentCount": 0
}
```

### Test 2: Get Feed

```bash
curl -X GET "https://your-api.execute-api.us-east-1.amazonaws.com/feed?limit=20" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

**Expected Response:**
```json
{
  "posts": [
    {
      "id": "abc-123",
      "text": "Post with images",
      "images": [...],
      "imageKey": "uploads/user123/img1.jpg",
      "imageAspectRatio": 1.5,
      "createdAt": "2025-01-06T..."
    },
    ...
  ]
}
```

### Test 3: Get Single Post

```bash
curl -X GET "https://your-api.execute-api.us-east-1.amazonaws.com/p/abc-123" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

---

## CloudWatch Logs Debugging

Check Lambda logs for debugging:

```bash
aws logs tail /aws/lambda/scoot-createPost --follow
aws logs tail /aws/lambda/scoot-getFeed --follow
```

Look for these log messages:
- `Creating post with X images`
- `Post created successfully: <postId>`
- `Fetching feed for X users`
- `Returning X posts`

---

## Next Steps

1. ✅ Deploy all three Lambda functions
2. ✅ Configure API Gateway routes
3. ✅ Test with Postman or curl
4. ✅ Test with mobile app
5. ✅ Monitor CloudWatch logs

The mobile app is already ready and will start showing images as soon as these Lambda functions are deployed!
