# ScooterBooter Microservices Architecture

This directory contains the microservices implementation of the ScooterBooter backend, designed for improved performance, cost efficiency, and independent scaling.

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────┐
│                         API Gateway (HTTP API)                       │
│                    Cognito JWT Authorizer                           │
└─────────────────────────────────────────────────────────────────────┘
       │          │           │          │          │          │
       ▼          ▼           ▼          ▼          ▼          ▼
   ┌───────┐  ┌───────┐  ┌────────┐  ┌───────┐  ┌───────┐  ┌─────────┐
   │ Users │  │ Posts │  │ Social │  │ Media │  │Notifs │  │ Scoops  │
   │ 128MB │  │ 256MB │  │ 128MB  │  │1024MB │  │ 128MB │  │ 512MB   │
   └───────┘  └───────┘  └────────┘  └───────┘  └───────┘  └─────────┘
       │          │           │          │          │          │
       └──────────┴───────────┴──────────┴──────────┴──────────┘
                              │
                    ┌─────────┴─────────┐
                    │  Shared Layer     │
                    │  (db, auth, utils)│
                    └───────────────────┘
```

## Services

| Service | Memory | Timeout | Description |
|---------|--------|---------|-------------|
| **users** | 128 MB | 10s | Profile, account, invites, search |
| **posts** | 256 MB | 15s | Feed, posts, comments, reactions |
| **social** | 128 MB | 10s | Follows, blocks, reports, user profiles |
| **media** | 1024 MB | 60s | File uploads, video processing (FFmpeg) |
| **notifications** | 128 MB | 10s | Notifications, push tokens |
| **scoops** | 512 MB | 30s | Ephemeral stories |

## Performance Benefits

### Cold Start Improvement

| Scenario | Monolith | Microservice | Improvement |
|----------|----------|--------------|-------------|
| GET /me | 800-1200ms | 150-300ms | **4-5x faster** |
| GET /feed | 800-1200ms | 200-400ms | **3-4x faster** |
| POST /upload-url | 800-1200ms | 300-500ms | **2-3x faster** |

### Estimated Monthly Savings

Based on optimized memory allocation:
- Users service: 128MB vs 1024MB = ~87% memory reduction
- Posts service: 256MB vs 1024MB = ~75% memory reduction
- Social service: 128MB vs 1024MB = ~87% memory reduction

**Estimated savings: $50-100/month** (varies with usage)

## Directory Structure

```
microservices/
├── template.yaml              # SAM template (Infrastructure as Code)
├── samconfig.toml            # SAM CLI configuration
├── env.json                  # Local environment variables
├── README.md                 # This file
│
├── layers/
│   └── shared/
│       └── nodejs/
│           ├── index.js      # Main export
│           ├── db-client.js  # DynamoDB client
│           ├── response.js   # HTTP response helpers
│           ├── auth.js       # Authentication helpers
│           ├── utils.js      # Common utilities
│           └── package.json
│
├── services/
│   ├── users/
│   │   └── handler.js
│   ├── posts/
│   │   └── handler.js
│   ├── social/
│   │   └── handler.js
│   ├── media/
│   │   └── handler.js
│   ├── notifications/
│   │   └── handler.js
│   └── scoops/
│       └── handler.js
│
├── events/                   # Sample events for local testing
│   └── get-me.json
│
└── scripts/
    ├── deploy.sh            # Deployment script
    └── local.sh             # Local development script
```

## Prerequisites

1. **AWS SAM CLI** - [Installation Guide](https://docs.aws.amazon.com/serverless-application-model/latest/developerguide/install-sam-cli.html)
   ```bash
   pip install aws-sam-cli
   ```

2. **AWS CLI** configured with credentials
   ```bash
   aws configure
   ```

3. **Node.js 20.x** for local development

## Quick Start

### Deploy to AWS

```bash
# First deployment (guided)
./scripts/deploy.sh prod --guided

# Subsequent deployments
./scripts/deploy.sh prod
```

### Local Development

```bash
# Start local API
./scripts/local.sh api

# Test locally
curl http://127.0.0.1:3000/me -H "Authorization: Bearer <token>"
```

### Build Only

```bash
sam build --parallel
```

## Configuration

### Using Existing Tables

If you're migrating from the monolith and want to reuse existing DynamoDB tables, pass them as parameters:

```bash
sam deploy --parameter-overrides \
  ExistingPostsTable=your-existing-posts-table \
  ExistingUsersTable=your-existing-users-table \
  # ... other tables
```

### Environment Variables

Environment variables are configured in `env.json` for local development and in the SAM template for deployed functions.

Required parameters for deployment:
- `CognitoUserPoolId` - Your Cognito User Pool ID
- `CognitoUserPoolArn` - Your Cognito User Pool ARN
- `AdminEmails` - Comma-separated admin email addresses (optional)

## Migration Strategy

### Phase 1: Deploy Alongside Monolith
1. Deploy microservices with new API Gateway endpoint
2. Test with a subset of users
3. Compare performance metrics

### Phase 2: Gradual Traffic Shift
1. Use API Gateway stage variables to route traffic
2. Shift 10% → 25% → 50% → 100%
3. Monitor error rates and latency

### Phase 3: Deprecate Monolith
1. Remove monolith from API Gateway
2. Update frontend to use new endpoint
3. Decommission monolith Lambda

## Monitoring

### CloudWatch Dashboards

Each function automatically logs to CloudWatch. Recommended metrics to monitor:
- `Duration` - Execution time
- `ConcurrentExecutions` - Scaling behavior
- `Errors` - Error rate
- `Throttles` - If hitting limits

### X-Ray Tracing

X-Ray is enabled by default. View traces in the AWS X-Ray console to:
- Identify bottlenecks
- Track cross-service calls
- Debug latency issues

## Troubleshooting

### Cold Starts
If experiencing slow cold starts:
1. Enable Provisioned Concurrency for critical functions
2. Keep functions warm with CloudWatch scheduled events
3. Review package size (smaller = faster)

### Memory Errors
If a function runs out of memory:
1. Check CloudWatch logs for memory usage
2. Increase `MemorySize` in template.yaml
3. Optimize code to reduce memory footprint

### Timeout Errors
If functions timeout:
1. Increase `Timeout` in template.yaml
2. Check for slow database queries
3. Consider breaking into smaller operations

## API Routes

### Users Service (`/me`, `/username`, `/search`)
- `GET /me` - Get current user profile
- `PATCH /me` - Update profile
- `DELETE /me` - Delete account
- `POST /me/avatar` - Update avatar
- `GET/PATCH /me/notification-preferences` - Notification settings
- `POST /me/accept-terms` - Accept ToS
- `GET/POST /me/invite` - Invite codes
- `POST /username` - Set handle
- `GET /search` - Search users

### Posts Service (`/feed`, `/posts`, `/comments`, `/reactions`)
- `GET /feed` - Get feed
- `POST /posts` - Create post
- `GET/DELETE /posts/:id` - Get/delete post
- `GET/POST /comments/:postId` - Get/add comments
- `GET/POST /reactions/:postId` - Get/toggle reactions

### Social Service (`/follow`, `/block`, `/u/:handle`)
- `POST /follow` - Follow user
- `POST /unfollow` - Unfollow user
- `POST /block` - Block user
- `POST /unblock` - Unblock user
- `GET /blocked` - List blocked users
- `POST /report` - Report content
- `GET /u/:handle` - User profile
- `GET /u/:handle/followers` - User's followers
- `GET /u/:handle/following` - User's following
- `GET /u/:handle/posts` - User's posts

### Media Service (`/upload-url`, `/avatar-url`)
- `POST /upload-url` - Get upload presigned URL
- `POST /avatar-url` - Get avatar upload URL
- `POST /process-video` - Process video
- `DELETE /media/:key` - Delete media

### Notifications Service (`/notifications`, `/push`)
- `GET /notifications` - Get notifications
- `POST /push/register` - Register push token
- `DELETE /push/unregister` - Unregister push token

### Scoops Service (`/scoops`)
- `GET /scoops/feed` - Get scoops feed
- `GET /scoops/me` - Get my scoops
- `POST /scoops` - Create scoop
- `GET /scoops/user/:userId` - User's scoops
- `GET/DELETE /scoops/:id` - Get/delete scoop
- `POST /scoops/:id/view` - Record view
- `GET /scoops/:id/viewers` - Get viewers
