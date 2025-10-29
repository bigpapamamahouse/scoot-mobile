// src/awsConfig.ts
import { Amplify } from 'aws-amplify';
import { loadGetRandomValues } from '@aws-amplify/react-native';
import 'react-native-url-polyfill/auto';
import { ENV } from './lib/env';

loadGetRandomValues();

console.log('=== AWS Amplify Configuration ===');
console.log('User Pool ID:', ENV.USER_POOL_ID);
console.log('User Pool Client ID:', ENV.USER_POOL_CLIENT_ID);
console.log('Region:', ENV.REGION);

// Test if we can reach Cognito
const testCognitoConnection = async () => {
  try {
    console.log('=== Testing Cognito Connectivity ===');
    const cognitoUrl = `https://cognito-idp.${ENV.REGION}.amazonaws.com/`;
    console.log('Cognito endpoint:', cognitoUrl);

    // Make a simple fetch to test connectivity
    const response = await fetch(cognitoUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-amz-json-1.1',
        'X-Amz-Target': 'AWSCognitoIdentityProviderService.InitiateAuth',
      },
      body: JSON.stringify({
        ClientId: ENV.USER_POOL_CLIENT_ID,
        AuthFlow: 'USER_PASSWORD_AUTH',
        AuthParameters: {
          USERNAME: 'test',
          PASSWORD: 'test'
        }
      })
    });

    const data = await response.text();
    console.log('Cognito connectivity test - Status:', response.status);
    console.log('Cognito connectivity test - Response:', data.substring(0, 200));

    if (response.status === 400) {
      console.log('✅ Can reach Cognito (got expected 400 for test credentials)');
    } else {
      console.log('⚠️ Unexpected response from Cognito');
    }
  } catch (error: any) {
    console.error('❌ Cannot reach Cognito:', error.message);
    console.error('Network error details:', error);
  }
};

// Run connectivity test
setTimeout(() => {
  testCognitoConnection();
}, 1000);

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

console.log('Amplify config:', JSON.stringify(config, null, 2));

try {
  Amplify.configure(config, { ssr: false });
  console.log('=== Amplify configured successfully ===');
} catch (e: any) {
  console.error('❌ Amplify.configure failed:', e);
}
