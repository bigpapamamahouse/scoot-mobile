# AWS Console Deployment Guide

This guide walks you through deploying the ScooterBooter microservices entirely from the AWS Console.

## Prerequisites

Run the packaging script first to create ZIP files:

```bash
cd backend/microservices
./scripts/package-for-console.sh
```

This creates ZIP files in `dist/`:
- `layer-shared.zip` - Shared Lambda Layer
- `service-users.zip` - Users service
- `service-posts.zip` - Posts service
- `service-social.zip` - Social service
- `service-media.zip` - Media service
- `service-notifications.zip` - Notifications service
- `service-scoops.zip` - Scoops service

---

## Step 1: Create the Shared Lambda Layer

1. **Go to Lambda Console**
   - URL: https://console.aws.amazon.com/lambda
   - Select region: **US East (N. Virginia) us-east-1**

2. **Create Layer**
   - Left sidebar → **Layers** → **Create layer**

3. **Configure Layer**
   | Field | Value |
   |-------|-------|
   | Name | `scooterbooter-shared-prod` |
   | Description | `Shared utilities for ScooterBooter microservices` |
   | Upload | Select `dist/layer-shared.zip` |
   | Compatible architectures | ☑️ `arm64` |
   | Compatible runtimes | ☑️ `Node.js 20.x` |

4. **Click Create**

5. **Copy the Layer ARN** (you'll need this for each function)
   - Format: `arn:aws:lambda:us-east-1:ACCOUNT_ID:layer:scooterbooter-shared-prod:1`

---

## Step 2: Create IAM Role for Lambda Functions

1. **Go to IAM Console**
   - URL: https://console.aws.amazon.com/iam

2. **Create Role**
   - **Roles** → **Create role**
   - Trusted entity: **AWS service**
   - Use case: **Lambda**
   - Click **Next**

3. **Attach Policies**
   - Search and select:
     - ☑️ `AmazonDynamoDBFullAccess`
     - ☑️ `AmazonS3FullAccess`
     - ☑️ `AmazonCognitoPowerUser`
     - ☑️ `AWSXRayDaemonWriteAccess`
     - ☑️ `CloudWatchLogsFullAccess`
   - Click **Next**

4. **Name the Role**
   - Role name: `scooterbooter-lambda-role`
   - Click **Create role**

5. **Copy the Role ARN**
   - Format: `arn:aws:iam::ACCOUNT_ID:role/scooterbooter-lambda-role`

---

## Step 3: Create Lambda Functions

Create each function following this process:

### 3.1 Users Service (128 MB)

1. **Lambda Console** → **Create function**

2. **Basic Configuration**
   | Field | Value |
   |-------|-------|
   | Function name | `scooterbooter-users-prod` |
   | Runtime | `Node.js 20.x` |
   | Architecture | `arm64` |
   | Execution role | Use existing: `scooterbooter-lambda-role` |

3. **Click Create function**

4. **Upload Code**
   - **Code** tab → **Upload from** → **.zip file**
   - Upload `dist/service-users.zip`
   - Click **Save**

5. **Update Handler**
   - **Code** tab → **Runtime settings** → **Edit**
   - Handler: `handler.handler`
   - Click **Save**

6. **Add Layer**
   - **Code** tab → scroll to **Layers** → **Add a layer**
   - Select **Custom layers**
   - Choose `scooterbooter-shared-prod` version 1
   - Click **Add**

7. **Configure Memory & Timeout**
   - **Configuration** tab → **General configuration** → **Edit**
   | Field | Value |
   |-------|-------|
   | Memory | `128 MB` |
   | Timeout | `10 seconds` |
   - Click **Save**

8. **Add Environment Variables**
   - **Configuration** tab → **Environment variables** → **Edit**
   - Add these variables (use your actual table names):

   | Key | Value |
   |-----|-------|
   | `POSTS_TABLE` | `your-posts-table-name` |
   | `USERS_TABLE` | `your-users-table-name` |
   | `INVITES_TABLE` | `your-invites-table-name` |
   | `FOLLOWS_TABLE` | `your-follows-table-name` |
   | `COMMENTS_TABLE` | `your-comments-table-name` |
   | `REACTIONS_TABLE` | `your-reactions-table-name` |
   | `NOTIFICATIONS_TABLE` | `your-notifications-table-name` |
   | `PUSH_TOKENS_TABLE` | `your-push-tokens-table-name` |
   | `REPORTS_TABLE` | `your-reports-table-name` |
   | `BLOCKS_TABLE` | `your-blocks-table-name` |
   | `SCOOPS_TABLE` | `your-scoops-table-name` |
   | `MEDIA_BUCKET` | `your-media-bucket-name` |
   | `USER_POOL_ID` | `us-east-1_XV8NWV6Qi` |

   - Click **Save**

9. **Enable X-Ray (Optional)**
   - **Configuration** tab → **Monitoring and operations tools** → **Edit**
   - ☑️ Active tracing
   - Click **Save**

---

### 3.2 Posts Service (256 MB)

Repeat Step 3.1 with these changes:

| Field | Value |
|-------|-------|
| Function name | `scooterbooter-posts-prod` |
| Upload | `dist/service-posts.zip` |
| Memory | `256 MB` |
| Timeout | `15 seconds` |

---

### 3.3 Social Service (128 MB)

Repeat Step 3.1 with these changes:

| Field | Value |
|-------|-------|
| Function name | `scooterbooter-social-prod` |
| Upload | `dist/service-social.zip` |
| Memory | `128 MB` |
| Timeout | `10 seconds` |

---

### 3.4 Media Service (1024 MB)

Repeat Step 3.1 with these changes:

| Field | Value |
|-------|-------|
| Function name | `scooterbooter-media-prod` |
| Upload | `dist/service-media.zip` |
| Memory | `1024 MB` |
| Timeout | `60 seconds` |

Additional environment variable:
| Key | Value |
|-----|-------|
| `FFMPEG_PATH` | `/opt/bin/ffmpeg` |

**Note:** For video processing, you'll also need to add an FFmpeg layer. You can use a public one like `arn:aws:lambda:us-east-1:678705476278:layer:ffmpeg:1` or build your own.

---

### 3.5 Notifications Service (128 MB)

Repeat Step 3.1 with these changes:

| Field | Value |
|-------|-------|
| Function name | `scooterbooter-notifications-prod` |
| Upload | `dist/service-notifications.zip` |
| Memory | `128 MB` |
| Timeout | `10 seconds` |

---

### 3.6 Scoops Service (512 MB)

Repeat Step 3.1 with these changes:

| Field | Value |
|-------|-------|
| Function name | `scooterbooter-scoops-prod` |
| Upload | `dist/service-scoops.zip` |
| Memory | `512 MB` |
| Timeout | `30 seconds` |

---

## Step 4: Create API Gateway

1. **Go to API Gateway Console**
   - URL: https://console.aws.amazon.com/apigateway

2. **Create API**
   - Click **Create API**
   - Choose **HTTP API** → **Build**

3. **Configure API**
   | Field | Value |
   |-------|-------|
   | API name | `scooterbooter-api-prod` |

4. **Add Integrations** (do this later, click **Next** for now)

5. **Configure Routes** (skip for now, click **Next**)

6. **Configure Stages**
   - Stage name: `prod`
   - Click **Next** → **Create**

---

## Step 5: Add Cognito Authorizer

1. **In API Gateway**, select your API

2. **Left sidebar** → **Authorization**

3. **Manage authorizers** → **Create**

4. **Configure Authorizer**
   | Field | Value |
   |-------|-------|
   | Authorizer type | `JWT` |
   | Name | `CognitoAuthorizer` |
   | Identity source | `$request.header.Authorization` |
   | Issuer URL | `https://cognito-idp.us-east-1.amazonaws.com/us-east-1_XV8NWV6Qi` |
   | Audience | `us-east-1_XV8NWV6Qi` |

5. **Click Create**

---

## Step 6: Create Routes and Integrations

For each route, you need to:
1. Create the route
2. Attach the Lambda integration
3. Attach the authorizer

### Users Service Routes

| Method | Path | Lambda |
|--------|------|--------|
| GET | `/me` | `scooterbooter-users-prod` |
| PATCH | `/me` | `scooterbooter-users-prod` |
| POST | `/me` | `scooterbooter-users-prod` |
| DELETE | `/me` | `scooterbooter-users-prod` |
| POST | `/me/avatar` | `scooterbooter-users-prod` |
| GET | `/me/notification-preferences` | `scooterbooter-users-prod` |
| PATCH | `/me/notification-preferences` | `scooterbooter-users-prod` |
| POST | `/me/accept-terms` | `scooterbooter-users-prod` |
| GET | `/me/invite` | `scooterbooter-users-prod` |
| POST | `/me/invite` | `scooterbooter-users-prod` |
| GET | `/me/invites` | `scooterbooter-users-prod` |
| POST | `/username` | `scooterbooter-users-prod` |
| GET | `/search` | `scooterbooter-users-prod` |

### Posts Service Routes

| Method | Path | Lambda |
|--------|------|--------|
| GET | `/feed` | `scooterbooter-posts-prod` |
| POST | `/posts` | `scooterbooter-posts-prod` |
| GET | `/posts/{id}` | `scooterbooter-posts-prod` |
| DELETE | `/posts/{id}` | `scooterbooter-posts-prod` |
| GET | `/comments/{postId}` | `scooterbooter-posts-prod` |
| POST | `/comments/{postId}` | `scooterbooter-posts-prod` |
| GET | `/reactions/{postId}` | `scooterbooter-posts-prod` |
| POST | `/reactions/{postId}` | `scooterbooter-posts-prod` |

### Social Service Routes

| Method | Path | Lambda |
|--------|------|--------|
| POST | `/follow` | `scooterbooter-social-prod` |
| POST | `/unfollow` | `scooterbooter-social-prod` |
| POST | `/follow-request` | `scooterbooter-social-prod` |
| POST | `/follow-cancel` | `scooterbooter-social-prod` |
| POST | `/follow-accept` | `scooterbooter-social-prod` |
| POST | `/follow-decline` | `scooterbooter-social-prod` |
| POST | `/block` | `scooterbooter-social-prod` |
| POST | `/unblock` | `scooterbooter-social-prod` |
| GET | `/blocked` | `scooterbooter-social-prod` |
| GET | `/is-blocked` | `scooterbooter-social-prod` |
| POST | `/report` | `scooterbooter-social-prod` |
| GET | `/reports` | `scooterbooter-social-prod` |
| GET | `/u/{handle}` | `scooterbooter-social-prod` |
| GET | `/u/{handle}/followers` | `scooterbooter-social-prod` |
| GET | `/u/{handle}/following` | `scooterbooter-social-prod` |
| GET | `/u/{handle}/posts` | `scooterbooter-social-prod` |

### Media Service Routes

| Method | Path | Lambda |
|--------|------|--------|
| POST | `/upload-url` | `scooterbooter-media-prod` |
| POST | `/avatar-url` | `scooterbooter-media-prod` |
| POST | `/process-video` | `scooterbooter-media-prod` |
| DELETE | `/media/{key+}` | `scooterbooter-media-prod` |

### Notifications Service Routes

| Method | Path | Lambda |
|--------|------|--------|
| GET | `/notifications` | `scooterbooter-notifications-prod` |
| POST | `/push/register` | `scooterbooter-notifications-prod` |
| DELETE | `/push/unregister` | `scooterbooter-notifications-prod` |

### Scoops Service Routes

| Method | Path | Lambda |
|--------|------|--------|
| GET | `/scoops/feed` | `scooterbooter-scoops-prod` |
| GET | `/scoops/me` | `scooterbooter-scoops-prod` |
| POST | `/scoops` | `scooterbooter-scoops-prod` |
| GET | `/scoops/user/{userId}` | `scooterbooter-scoops-prod` |
| GET | `/scoops/{id}` | `scooterbooter-scoops-prod` |
| DELETE | `/scoops/{id}` | `scooterbooter-scoops-prod` |
| POST | `/scoops/{id}/view` | `scooterbooter-scoops-prod` |
| GET | `/scoops/{id}/viewers` | `scooterbooter-scoops-prod` |

---

### How to Create Each Route

1. **Left sidebar** → **Routes** → **Create**

2. **Configure Route**
   - Method: `GET` (or appropriate method)
   - Path: `/me` (or appropriate path)
   - Click **Create**

3. **Attach Integration**
   - Click on the route
   - **Attach integration** → **Create and attach an integration**
   - Integration type: `Lambda function`
   - Lambda function: Select the appropriate function
   - Click **Create**

4. **Attach Authorizer**
   - Click on the route
   - **Attach authorization**
   - Authorizer: `CognitoAuthorizer`
   - Click **Attach**

5. **Repeat** for all routes

---

## Step 7: Configure CORS

1. **Left sidebar** → **CORS** → **Configure**

2. **Settings**
   | Field | Value |
   |-------|-------|
   | Access-Control-Allow-Origin | `https://app.scooterbooter.com`, `http://localhost:5173` |
   | Access-Control-Allow-Headers | `Content-Type, Authorization, X-Requested-With, X-Ignore-Auth-Redirect` |
   | Access-Control-Allow-Methods | `GET, POST, PATCH, DELETE, OPTIONS` |
   | Access-Control-Allow-Credentials | `Yes` |
   | Access-Control-Max-Age | `86400` |

3. **Click Save**

---

## Step 8: Deploy and Test

1. **Get your API URL**
   - **Left sidebar** → **Stages** → **prod**
   - Copy the **Invoke URL** (e.g., `https://abc123.execute-api.us-east-1.amazonaws.com/prod`)

2. **Test with curl**
   ```bash
   API_URL="https://YOUR_API_ID.execute-api.us-east-1.amazonaws.com/prod"
   TOKEN="your-cognito-jwt-token"

   curl -H "Authorization: Bearer $TOKEN" "$API_URL/me"
   ```

3. **Update your app** with the new API URL

---

## Quick Reference: Function Settings

| Function | Memory | Timeout | ZIP File |
|----------|--------|---------|----------|
| `scooterbooter-users-prod` | 128 MB | 10s | `service-users.zip` |
| `scooterbooter-posts-prod` | 256 MB | 15s | `service-posts.zip` |
| `scooterbooter-social-prod` | 128 MB | 10s | `service-social.zip` |
| `scooterbooter-media-prod` | 1024 MB | 60s | `service-media.zip` |
| `scooterbooter-notifications-prod` | 128 MB | 10s | `service-notifications.zip` |
| `scooterbooter-scoops-prod` | 512 MB | 30s | `service-scoops.zip` |

---

## Troubleshooting

| Issue | Solution |
|-------|----------|
| "Unable to import module 'handler'" | Check handler is set to `handler.handler` |
| "Cannot find module '/opt/nodejs/...'" | Verify the shared layer is attached |
| "Task timed out" | Increase timeout in General configuration |
| "AccessDeniedException" | Check IAM role has correct policies |
| CORS errors | Verify CORS settings in API Gateway |
| 401 Unauthorized | Check Cognito authorizer configuration |
