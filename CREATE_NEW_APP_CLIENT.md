# Create a New Cognito App Client (Without Secret)

If your current app client has a secret, you need to create a new one. Here's how:

## Step 1: Create New App Client

1. Go to AWS Cognito Console: https://console.aws.amazon.com/cognito/
2. Select your User Pool: **us-east-1_XV8NWV6Qi**
3. Click **App integration** tab
4. Scroll down to **App clients and analytics**
5. Click **Create app client**

## Step 2: Configure the New App Client

### Basic Settings:
- **App client name**: `scooterbooter-mobile-app` (or any name you prefer)
- **App type**: Select **Public client** (THIS IS CRITICAL!)

### Authentication flows:
Enable these checkboxes:
- ✅ **ALLOW_USER_PASSWORD_AUTH**
- ✅ **ALLOW_REFRESH_TOKEN_AUTH**
- ✅ **ALLOW_USER_SRP_AUTH**

### Authentication flow session duration:
- Leave default (3 minutes)

### Token expiration:
- Leave defaults or adjust as needed

### Advanced settings (expand if needed):
- **Generate client secret**: **UNCHECK THIS** ⚠️ (Most important!)
- **Enable token revocation**: Check (recommended)
- **Prevent user existence errors**: Check (recommended for security)

## Step 3: Save and Get the Client ID

1. Click **Create app client**
2. Copy the new **Client ID** (it will look like: `abc123def456ghi789jkl`)

## Step 4: Update Your App

Update the client ID in your `src/lib/env.ts` file:

```typescript
const rawEnv = {
  EXPO_PUBLIC_API_URL: "https://xb7l24zhn0.execute-api.us-east-1.amazonaws.com/prod",
  EXPO_PUBLIC_USER_POOL_ID: "us-east-1_XV8NWV6Qi",
  EXPO_PUBLIC_USER_POOL_CLIENT_ID: "YOUR_NEW_CLIENT_ID_HERE", // ← UPDATE THIS
  EXPO_PUBLIC_MEDIA_BASE_URL: "d1ixzryozy81x4.cloudfront.net",
  REGION: "us-east-1"
} as const;
```

## Step 5: Test Again

Restart your app and try logging in with the new client ID.

## Why This Matters

- **Public clients** = No secret (suitable for mobile/web apps)
- **Confidential clients** = Has a secret (only for server-side apps)

Mobile apps like yours cannot securely store secrets, so you MUST use a public client without a secret.

## Verify It Worked

In the AWS Console, when you view your new app client:
- You should see "Show" next to "App client secret" but no actual secret value, OR
- The "App client secret" field should be empty or say "N/A"

If you see an actual secret value, you need to recreate the client and make sure "Generate client secret" is UNCHECKED.
