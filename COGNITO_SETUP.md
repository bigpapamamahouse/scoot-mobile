# AWS Cognito Configuration Fix

## Problem
You're seeing this error: `"name": "Unknown", "underlyingError": {}`

This means your Cognito User Pool App Client doesn't have the correct authentication flows enabled.

## Solution: Enable Required Auth Flows

### Step 1: Access AWS Cognito Console
1. Go to: https://console.aws.amazon.com/cognito/
2. Select **User Pools**
3. Click on your User Pool: **us-east-1_XV8NWV6Qi**

### Step 2: Update App Client Settings
1. Click on **App integration** tab (or **App clients** in older console)
2. Find your app client: **e9l2smd2r9amitgt846in4eno**
3. Click **Edit** on the app client

### Step 3: Enable Authentication Flows
Make sure these authentication flows are **ENABLED** (checked):
- ✅ **ALLOW_USER_PASSWORD_AUTH** (REQUIRED - this is the most important one!)
- ✅ **ALLOW_REFRESH_TOKEN_AUTH** (recommended)
- ✅ **ALLOW_CUSTOM_AUTH** (optional)
- ✅ **ALLOW_USER_SRP_AUTH** (optional but recommended)

### Step 4: Save Changes
Click **Save changes** at the bottom

### Step 5: Test Again
After enabling these flows, restart your app and try logging in again.

## What These Flows Do

- **ALLOW_USER_PASSWORD_AUTH**: Allows direct username/password authentication (required for your app)
- **ALLOW_REFRESH_TOKEN_AUTH**: Allows refreshing auth tokens without re-login
- **ALLOW_USER_SRP_AUTH**: Secure Remote Password protocol (more secure, optional)
- **ALLOW_CUSTOM_AUTH**: Custom authentication challenges (optional)

## Alternative: Use SRP Auth (More Secure)

If you want to use the more secure SRP authentication flow instead, the code is already set up to handle it. Just make sure **ALLOW_USER_SRP_AUTH** is enabled instead.

## Verification

After making these changes, you should see successful authentication instead of the "Unknown" error.
