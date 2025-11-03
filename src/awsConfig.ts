// src/awsConfig.ts
import { Amplify } from 'aws-amplify';
import { loadGetRandomValues } from '@aws-amplify/react-native';
import 'react-native-url-polyfill/auto';
import { ENV } from './lib/env';

loadGetRandomValues();

// Try the exact configuration format that works with direct auth
const config = {
  Auth: {
    Cognito: {
      userPoolId: ENV.USER_POOL_ID,
      userPoolClientId: ENV.USER_POOL_CLIENT_ID,
      // Don't specify region or endpoint - let Amplify derive from userPoolId
      // But ensure signInOptions are configured properly
      signUpVerificationMethod: 'code' as const,
      loginWith: {
        username: true,
        email: true,
      },
    },
  },
};

try {
  Amplify.configure(config, { ssr: false });
} catch (e: any) {
  console.error('❌ Amplify.configure failed:', e);
}
