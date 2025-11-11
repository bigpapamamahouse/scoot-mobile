# iOS Build and Deployment Guide

This guide covers building and deploying the ScooterBooter mobile app to the Apple App Store using Expo Application Services (EAS).

## Prerequisites

Before you begin, ensure you have:

1. ✅ Apple Developer Account (you already have this)
2. ✅ App Store Connect access (you're already logged in)
3. ☐ Node.js installed (v18 or higher recommended)
4. ☐ EAS CLI installed globally
5. ☐ Expo account (free)

## Step 1: Install EAS CLI

```bash
npm install -g eas-cli
```

## Step 2: Login to EAS

```bash
eas login
```

If you don't have an Expo account, create one at https://expo.dev

## Step 3: Configure Your Project

First, link your project to EAS:

```bash
eas build:configure
```

This will create an `eas.json` file. Replace its contents with the following configuration:

```json
{
  "cli": {
    "version": ">= 5.2.0"
  },
  "build": {
    "development": {
      "developmentClient": true,
      "distribution": "internal",
      "ios": {
        "simulator": true
      }
    },
    "preview": {
      "distribution": "internal",
      "ios": {
        "simulator": false
      }
    },
    "production": {
      "ios": {
        "simulator": false
      }
    }
  },
  "submit": {
    "production": {
      "ios": {
        "appleId": "your-apple-id@example.com",
        "ascAppId": "YOUR_APP_STORE_CONNECT_APP_ID",
        "appleTeamId": "YOUR_APPLE_TEAM_ID"
      }
    }
  }
}
```

## Step 4: Update App Configuration

Open `app.json` and ensure the following iOS-specific fields are set:

```json
{
  "expo": {
    "name": "ScooterBooter",
    "slug": "scooterbooter-mobile",
    "version": "0.1.0",
    "ios": {
      "supportsTablet": true,
      "bundleIdentifier": "com.scooterbooter.app",
      "buildNumber": "1",
      "infoPlist": {
        "NSCameraUsageDescription": "This app uses the camera to scan QR codes on scooters.",
        "NSPhotoLibraryUsageDescription": "This app needs access to your photo library.",
        "NSLocationWhenInUseUsageDescription": "This app uses your location to find nearby scooters."
      }
    }
  }
}
```

## Step 5: Prepare Your Apple Developer Account

### A. Create an App ID in Apple Developer Portal

1. Go to https://developer.apple.com/account
2. Navigate to **Certificates, Identifiers & Profiles**
3. Click **Identifiers** → **+** button
4. Select **App IDs** → **Continue**
5. Select **App** → **Continue**
6. Configure:
   - **Description**: ScooterBooter
   - **Bundle ID**: `com.scooterbooter.app` (must match your app.json)
   - **Capabilities**: Enable any needed (Push Notifications, etc.)
7. Click **Continue** → **Register**

### B. Create an App in App Store Connect

1. Go to https://appstoreconnect.apple.com
2. Click **My Apps** → **+** → **New App**
3. Fill in:
   - **Platform**: iOS
   - **Name**: ScooterBooter
   - **Primary Language**: English (or your preference)
   - **Bundle ID**: Select `com.scooterbooter.app` from dropdown
   - **SKU**: `scooterbooter-001` (or any unique identifier)
4. Click **Create**
5. Note your **App Store Connect App ID** (found in App Information, looks like: 1234567890)

### C. Get Your Apple Team ID

1. Go to https://developer.apple.com/account
2. Click **Membership** in the sidebar
3. Note your **Team ID** (looks like: ABC123XYZ4)

## Step 6: Build for Production

### First Build (with credential generation)

For your first build, EAS will help generate iOS certificates and provisioning profiles:

```bash
eas build --platform ios --profile production
```

EAS will ask several questions:

1. **"Generate a new Apple Distribution Certificate?"** → Yes
2. **"Generate a new Apple Provisioning Profile?"** → Yes
3. **Apple ID**: Enter your Apple Developer account email
4. **Apple ID Password**: Use an app-specific password (see below)

### Creating an App-Specific Password

1. Go to https://appleid.apple.com
2. Sign in with your Apple ID
3. In **Security** section, click **App-Specific Passwords**
4. Click **Generate Password**
5. Name it "EAS CLI" or similar
6. Copy the generated password (you'll need it for EAS)

### Monitor Your Build

After starting the build:
- You'll get a link to view build progress on Expo's servers
- Build typically takes 10-20 minutes
- You'll receive the `.ipa` file when complete

## Step 7: Submit to App Store

Once your build completes successfully:

```bash
eas submit --platform ios --latest
```

This will:
1. Upload your build to App Store Connect
2. Process it for TestFlight and App Store Review

Alternatively, you can manually submit:
1. Download the `.ipa` from your build page
2. Use **Transporter** app (download from Mac App Store)
3. Drag `.ipa` into Transporter and upload

## Step 8: Prepare Your App Store Listing

In App Store Connect:

1. Go to your app → **App Store** tab
2. Fill in required information:
   - **App Information**
     - Name: ScooterBooter
     - Subtitle (optional)
     - Category: Navigation or Transportation
   - **Pricing and Availability**
     - Price: Free or set price
     - Availability: Select countries
   - **1.0 Prepare for Submission**
     - Screenshots (required for various iPhone sizes)
     - App Preview (optional video)
     - Description
     - Keywords
     - Support URL
     - Marketing URL (optional)
     - Privacy Policy URL (use your PRIVACY_POLICY.md)

### Screenshot Requirements

You'll need screenshots for:
- 6.7" display (iPhone 15 Pro Max): 1290 x 2796 pixels
- 6.5" display (iPhone 11 Pro Max): 1242 x 2688 pixels

Generate these using:
```bash
# Run in iOS Simulator with appropriate device
xcrun simctl io booted screenshot screenshot.png
```

Or use design tools to create mockups.

## Step 9: Submit for Review

1. In App Store Connect, select your app
2. Scroll to **Build** section
3. Click **+** and select your uploaded build
4. Complete all required fields (red badges)
5. Fill out **App Privacy** questionnaire
6. Click **Submit for Review**

### App Review Information

Provide:
- Demo account credentials (if app requires login)
- Notes for reviewer explaining how to test the app
- Contact information

## Step 10: Subsequent Builds

For future updates:

1. **Update version** in `app.json`:
   ```json
   "version": "0.2.0",
   "ios": {
     "buildNumber": "2"
   }
   ```

2. **Build new version**:
   ```bash
   eas build --platform ios --profile production
   ```

3. **Submit update**:
   ```bash
   eas submit --platform ios --latest
   ```

4. **Create new version in App Store Connect**:
   - Click **+** next to **iOS App**
   - Enter new version number
   - Add "What's New" description
   - Select new build
   - Submit for review

## Common Commands

```bash
# Check build status
eas build:list

# View build details
eas build:view [BUILD_ID]

# Cancel a running build
eas build:cancel

# View credentials
eas credentials

# Update app configuration
eas update:configure

# View all available commands
eas --help
```

## Troubleshooting

### Build Fails - Code Signing

**Problem**: Certificate or provisioning profile issues

**Solution**:
```bash
eas credentials
```
Select iOS → Production → Manage credentials manually → Remove and regenerate

### Build Fails - Dependencies

**Problem**: Native module compilation errors

**Solution**:
```bash
# Clear node modules and reinstall
rm -rf node_modules
npm install

# Clear Expo cache
npx expo start -c
```

### Submit Fails - Invalid Binary

**Problem**: "Invalid binary" or "Missing compliance"

**Solution**: In App Store Connect, go to TestFlight → App Privacy → Encryption, answer the export compliance questions

### App Rejected - Missing Privacy Policy

**Problem**: Apple requires privacy policy

**Solution**: Host your `PRIVACY_POLICY.md` file (convert to HTML) or use a simple service like GitHub Pages:

```bash
# In your repo
echo "# Privacy Policy\n$(cat PRIVACY_POLICY.md)" > docs/index.md
```

Enable GitHub Pages in repository settings, point to `/docs` folder.

## Environment Variables

Ensure your `.env` file is properly configured before building:

```bash
EXPO_PUBLIC_API_URL=https://your-backend-api.com
# Add other environment variables as needed
```

These will be embedded in the build. For sensitive values, consider using EAS Secrets:

```bash
eas secret:create --scope project --name API_URL --value https://your-api.com
```

## Resources

- [EAS Build Documentation](https://docs.expo.dev/build/introduction/)
- [EAS Submit Documentation](https://docs.expo.dev/submit/introduction/)
- [App Store Review Guidelines](https://developer.apple.com/app-store/review/guidelines/)
- [App Store Connect Help](https://help.apple.com/app-store-connect/)

## Quick Reference Checklist

- [ ] EAS CLI installed (`npm install -g eas-cli`)
- [ ] Logged into EAS (`eas login`)
- [ ] Project configured (`eas build:configure`)
- [ ] App ID created in Apple Developer Portal
- [ ] App created in App Store Connect
- [ ] Team ID and App Store Connect ID noted
- [ ] `eas.json` configured with correct IDs
- [ ] `app.json` has correct bundle identifier and version
- [ ] Environment variables set in `.env`
- [ ] App-specific password generated for Apple ID
- [ ] First production build created (`eas build --platform ios --profile production`)
- [ ] Build submitted to App Store Connect (`eas submit --platform ios --latest`)
- [ ] Screenshots prepared (multiple device sizes)
- [ ] App Store listing completed in App Store Connect
- [ ] Privacy policy URL available
- [ ] App submitted for review

---

**Need Help?**

- Expo Discord: https://chat.expo.dev
- Expo Forums: https://forums.expo.dev
- Apple Developer Support: https://developer.apple.com/support/
