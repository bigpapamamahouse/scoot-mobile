# AWS Cognito Configuration Fix

## Problem
You're seeing this error: `"name": "Unknown", "underlyingError": {}`

This indicates a configuration issue with your Cognito User Pool App Client.

## Checklist: Verify These Settings

### Step 1: Access AWS Cognito Console
1. Go to: https://console.aws.amazon.com/cognito/
2. Select **User Pools**
3. Click on your User Pool: **us-east-1_XV8NWV6Qi**

### Step 2: Check App Client Settings
1. Click on **App integration** tab (or **App clients** in older console)
2. Find your app client: **e9l2smd2r9amitgt846in4eno**
3. Click on it to view details

### Step 3: Verify Authentication Flows ✅
Make sure these authentication flows are **ENABLED** (checked):
- ✅ **ALLOW_USER_PASSWORD_AUTH** (REQUIRED!)
- ✅ **ALLOW_REFRESH_TOKEN_AUTH** (recommended)
- ✅ **ALLOW_USER_SRP_AUTH** (recommended)

### Step 4: Check App Client Secret ⚠️
**CRITICAL**: Check if your app client has a secret:
- Look for **App client secret** field
- If it says "Show" or has a secret value, this is the problem!
- **Mobile apps should NOT have a client secret**

**To fix if secret exists:**
1. You need to create a NEW app client WITHOUT a secret
2. Or contact AWS support to remove the secret (not always possible)
3. Update your `env.ts` with the new client ID

**Why**: React Native/Expo apps cannot securely store client secrets. The secret would be visible in your app bundle.

### Step 5: Verify User Exists and is Confirmed ✅
1. Go to **Users** tab in your User Pool
2. Find your test user
3. Check that **Account status** is "CONFIRMED" (not "FORCE_CHANGE_PASSWORD" or "UNCONFIRMED")
4. If unconfirmed, select the user and click **Confirm account**

### Step 6: Check Required Attributes
1. Go to **Sign-up experience** tab
2. Check **Required attributes**
3. Make sure all required attributes are set for your test user

### Step 7: Check Password Policy
1. Go to **Sign-up experience** tab
2. Look at **Password policy**
3. Verify your test password meets all requirements:
   - Minimum length
   - Special characters
   - Numbers
   - Uppercase/lowercase

## What These Flows Do

- **ALLOW_USER_PASSWORD_AUTH**: Allows direct username/password authentication (required for your app)
- **ALLOW_REFRESH_TOKEN_AUTH**: Allows refreshing auth tokens without re-login
- **ALLOW_USER_SRP_AUTH**: Secure Remote Password protocol (more secure, optional)
- **ALLOW_CUSTOM_AUTH**: Custom authentication challenges (optional)

## Alternative: Use SRP Auth (More Secure)

If you want to use the more secure SRP authentication flow instead, the code is already set up to handle it. Just make sure **ALLOW_USER_SRP_AUTH** is enabled instead.

## Verification

After making these changes, you should see successful authentication instead of the "Unknown" error.
