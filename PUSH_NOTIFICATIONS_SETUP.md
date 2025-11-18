# Push Notifications Setup Guide

This guide explains how to complete the push notification setup for your iOS app.

## What Was Implemented

The following push notification functionality has been added:

1. **Backend Endpoint**: `POST /push/register` - Registers device push tokens
2. **Push Notification Sending**: Automatically sends push notifications when:
   - Someone comments on your post
   - Someone reacts to your post
   - Someone mentions you in a post or comment
   - Someone follows you
   - Someone sends a follow request
   - Someone accepts/declines your follow request
3. **Expo Push Service Integration**: Uses Expo's free push notification service

## Required AWS Infrastructure Setup

You need to create one additional DynamoDB table:

### PUSH_TOKENS Table

**Table Name**: `scooterbooter-push-tokens` (or your preferred name)

**Primary Key**:
- Partition Key (pk): `String`
- Sort Key (sk): `String`

**Attributes**:
- `pk`: `USER#<userId>`
- `sk`: `TOKEN#<platform>#<tokenHash>`
- `token`: String (the Expo push token)
- `platform`: String (`ios` or `android`)
- `registeredAt`: Number (timestamp)
- `lastUsedAt`: Number (timestamp)

**Example Item**:
```json
{
  "pk": "USER#abc123-def456",
  "sk": "TOKEN#ios#a1b2c3d4e5f6",
  "token": "ExponentPushToken[xxxxxxxxxxxxxxxxxxxxxx]",
  "platform": "ios",
  "registeredAt": 1700000000000,
  "lastUsedAt": 1700000000000
}
```

### Creating the Table via AWS Console

1. Go to AWS Console → DynamoDB
2. Click "Create table"
3. Table name: `scooterbooter-push-tokens`
4. Partition key: `pk` (String)
5. Sort key: `sk` (String)
6. Use default settings
7. Click "Create table"

### Creating the Table via AWS CLI

```bash
aws dynamodb create-table \
  --table-name scooterbooter-push-tokens \
  --attribute-definitions \
    AttributeName=pk,AttributeType=S \
    AttributeName=sk,AttributeType=S \
  --key-schema \
    AttributeName=pk,KeyType=HASH \
    AttributeName=sk,KeyType=RANGE \
  --billing-mode PAY_PER_REQUEST \
  --region us-east-1
```

## Lambda Configuration

Update your Lambda function's environment variables to include:

```
PUSH_TOKENS_TABLE=scooterbooter-push-tokens
```

### Steps:
1. Go to AWS Console → Lambda
2. Find your Lambda function
3. Go to Configuration → Environment variables
4. Click "Edit"
5. Add new variable: `PUSH_TOKENS_TABLE` = `scooterbooter-push-tokens`
6. Click "Save"

## IAM Permissions

Ensure your Lambda execution role has permissions to access the new table:

```json
{
  "Effect": "Allow",
  "Action": [
    "dynamodb:PutItem",
    "dynamodb:GetItem",
    "dynamodb:Query",
    "dynamodb:DeleteItem"
  ],
  "Resource": "arn:aws:dynamodb:us-east-1:*:table/scooterbooter-push-tokens"
}
```

## Testing the Implementation

### 1. Check Token Registration

After deploying the backend changes:

1. Open your app on TestFlight
2. Grant notification permissions when prompted
3. Check CloudWatch logs for your Lambda function
4. You should see: `[Push] Registered token for user <userId> on ios`

### 2. Test Push Notifications

1. Have another user comment on your post
2. You should receive a push notification on your device
3. Check CloudWatch logs for: `[Push] Sent to X device(s) for user <userId>`

### 3. Troubleshooting

**Not receiving notifications?**

1. Check CloudWatch logs for errors
2. Verify `PUSH_TOKENS_TABLE` environment variable is set
3. Verify the DynamoDB table exists
4. Check Lambda IAM permissions
5. Verify app has notification permissions in iOS Settings

**Token registration failing?**

1. Check if `POST /push/register` endpoint returns 200
2. Verify the token is being stored in DynamoDB
3. Check Lambda logs for errors

## Frontend Changes

No frontend changes are required! The existing code already:
- Requests notification permissions
- Gets Expo push tokens
- Calls `POST /push/register` to register tokens
- Handles notification taps

## How It Works

```
1. User opens app
   ↓
2. App requests notification permissions
   ↓
3. App gets Expo push token
   ↓
4. App calls POST /push/register
   ↓
5. Backend stores token in PUSH_TOKENS table

---

When notification is created:
1. createNotification() saves to NOTIFICATIONS_TABLE
   ↓
2. Looks up user's push tokens from PUSH_TOKENS_TABLE
   ↓
3. Sends push notification to Expo Push Service
   ↓
4. Expo delivers notification to user's device
```

## Cost Considerations

- **Expo Push Service**: Free for unlimited notifications
- **DynamoDB**: Pay per request (very cheap - likely <$1/month)
- **Lambda**: Negligible increase in execution time

## Production Recommendations

1. **Token Cleanup**: Add a Lambda function to periodically remove expired tokens
2. **Error Handling**: Track failed push notifications and remove invalid tokens
3. **Rate Limiting**: Consider limiting notifications to prevent spam
4. **Batching**: For high-volume apps, batch push notifications

## Support

If you encounter issues:
1. Check CloudWatch logs for the Lambda function
2. Verify all environment variables are set
3. Check DynamoDB table for stored tokens
4. Test with Expo's push notification tool: https://expo.dev/notifications
