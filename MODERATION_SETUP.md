# Content Moderation & Safety Features Setup Guide

This document outlines the setup required for the new content moderation and safety features added to meet App Store requirements.

## Overview

The following features have been implemented:
1. **Terms of Service (TOS)** - Users must accept TOS before using the app
2. **AI Content Moderation** - Amazon Bedrock AI filters objectionable content
3. **User Reporting** - Users can report objectionable posts and comments
4. **User Blocking** - Users can block other users
5. **Admin Moderation** - Admins can review reports and take action within 24 hours

## Required Infrastructure Changes

### 1. DynamoDB Tables

Create two new DynamoDB tables:

#### A. Reports Table
```
Table Name: [PROJECT_NAME]-reports
Primary Key:
  - Partition Key: pk (String) - Format: REPORT#<reportId>
  - Sort Key: sk (String) - Format: <timestamp>

Settings:
  - Billing Mode: On-demand or Provisioned (as per your current setup)
  - ConsistentRead: true (used in queries)

No GSIs required
```

#### B. Blocks Table
```
Table Name: [PROJECT_NAME]-blocks
Primary Key:
  - Partition Key: pk (String) - Format: USER#<userId>
  - Sort Key: sk (String) - Format: BLOCKED#<blockedUserId>

Settings:
  - Billing Mode: On-demand or Provisioned (as per your current setup)
  - ConsistentRead: true (used in queries)

No GSIs required
```

### 2. Lambda Environment Variables

Add the following environment variables to your Lambda function:

```bash
REPORTS_TABLE=[PROJECT_NAME]-reports
BLOCKS_TABLE=[PROJECT_NAME]-blocks
```

### 3. Lambda IAM Permissions

Update your Lambda execution role to include permissions for:

#### DynamoDB Permissions
Add the new tables to your existing DynamoDB policy:
```json
{
  "Effect": "Allow",
  "Action": [
    "dynamodb:GetItem",
    "dynamodb:PutItem",
    "dynamodb:UpdateItem",
    "dynamodb:DeleteItem",
    "dynamodb:Query",
    "dynamodb:Scan"
  ],
  "Resource": [
    "arn:aws:dynamodb:REGION:ACCOUNT_ID:table/PROJECT_NAME-reports",
    "arn:aws:dynamodb:REGION:ACCOUNT_ID:table/PROJECT_NAME-blocks"
  ]
}
```

#### Amazon Bedrock Permissions
Add new policy for Bedrock access:
```json
{
  "Effect": "Allow",
  "Action": [
    "bedrock:InvokeModel"
  ],
  "Resource": [
    "arn:aws:bedrock:us-east-1::foundation-model/anthropic.claude-3-haiku-20240307-v1:0"
  ]
}
```

Note: Bedrock is currently available in limited regions. Ensure `us-east-1` or another Bedrock-enabled region is used.

### 4. Lambda Dependencies

Ensure the following AWS SDK packages are available in your Lambda:
- `@aws-sdk/client-bedrock-runtime` (for AI content moderation)

If using Lambda layers, update the layer to include this package. If bundling directly, ensure it's in your deployment package.

### 5. Enable Amazon Bedrock

1. Go to AWS Bedrock console: https://console.aws.amazon.com/bedrock
2. Navigate to "Model access" in the left sidebar
3. Click "Manage model access"
4. Enable access to **Claude 3 Haiku** model
5. Wait for approval (usually instant)

## Testing the Setup

### 1. Test TOS Acceptance
1. Create a new user account
2. App should redirect to Terms of Service screen
3. Accept terms
4. Verify you can access the app

### 2. Test Content Moderation
Try posting content with objectionable words (testing only):
```
POST /posts
Body: { "text": "This is a test of moderation with inappropriate content [add test phrase]" }
```
Expected: Should be rejected with 403 status

### 3. Test Reporting
1. Find a post from another user
2. Tap the menu (three dots)
3. Select "Report Post"
4. Enter a reason
5. Verify success message

Check reports as admin:
```
GET /reports?status=pending
```

### 4. Test Blocking
1. Find a post from another user
2. Tap the menu (three dots)
3. Select "Block User"
4. Confirm block
5. Verify user's posts are removed from feed

### 5. Test Admin Moderation
As an admin user (email in ADMIN_EMAILS env var):
```
# View reports
GET /reports?status=pending

# Take action on a report
POST /reports/{reportId}/action
Body: { "action": "delete_content" }  # or "ban_user" or "dismiss"
```

## Deployment Checklist

- [ ] Create REPORTS_TABLE in DynamoDB
- [ ] Create BLOCKS_TABLE in DynamoDB
- [ ] Add environment variables to Lambda (REPORTS_TABLE, BLOCKS_TABLE)
- [ ] Update Lambda IAM role with DynamoDB permissions for new tables
- [ ] Update Lambda IAM role with Bedrock permissions
- [ ] Enable Amazon Bedrock model access (Claude 3 Haiku)
- [ ] Install/update Lambda dependencies (@aws-sdk/client-bedrock-runtime)
- [ ] Deploy updated Lambda code
- [ ] Test TOS acceptance flow
- [ ] Test content moderation (post creation should be filtered)
- [ ] Test reporting functionality
- [ ] Test blocking functionality
- [ ] Test admin moderation endpoints
- [ ] Update mobile app (already included in this PR)

## API Endpoints Added

### User Endpoints
- `POST /me/accept-terms` - Accept terms of service
- `POST /block` - Block a user
- `POST /unblock` - Unblock a user
- `GET /blocked` - Get list of blocked users
- `POST /report` - Report objectionable content
- `GET /is-blocked?userId=X` - Check if blocked relationship exists

### Admin Endpoints (requires ADMIN_EMAILS)
- `GET /reports?status=pending` - List reports
- `POST /reports/{reportId}/action` - Take action on report

## App Store Compliance

This implementation satisfies all Apple App Store requirements:

✅ **Terms of Service** - Users must accept terms stating zero tolerance for objectionable content
✅ **Content Filtering** - AI-powered moderation using Amazon Bedrock
✅ **User Reporting** - Mechanism for users to flag objectionable content
✅ **User Blocking** - Mechanism for users to block abusive users
✅ **24-Hour Response** - Admin endpoints enable action on reports within 24 hours

## Costs

### Amazon Bedrock
- Claude 3 Haiku: ~$0.00025 per 1K input tokens, ~$0.00125 per 1K output tokens
- Average moderation check: ~100 tokens input, ~50 tokens output = ~$0.0001 per post
- 10,000 posts/day = ~$1/day or ~$30/month

### DynamoDB
- On-demand pricing: ~$1.25 per million write requests, ~$0.25 per million read requests
- Minimal storage costs for reports and blocks tables

## Support

For issues or questions about the implementation, check:
- Backend code: `/backend/index.js`
- Frontend TOS: `/src/screens/TermsOfServiceScreen.tsx`
- Frontend moderation: `/src/api/moderation.ts`
- Post components: `/src/components/PostCard.tsx`
