
# ScooterBooter Mobile (Expo + React Native)

This is a starter scaffold to run your ScooterBooter backend on iOS/Android with Expo.

## Quick start

1) Copy `.env.example` to `.env` and verify values.
2) Install deps:
   ```bash
   npm install
   ```
3) Run:
   ```bash
   npx expo start
   ```
   - Press **i** to open iOS Simulator, or scan the QR with Expo Go.

## Notes
- Uses AWS Amplify Auth to talk to your Cognito pool.
- API base URL is read from `EXPO_PUBLIC_API_URL`.
- Token is stored in AsyncStorage and automatically sent in `Authorization: Bearer` for API calls.
