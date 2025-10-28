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

const config = {
  Auth: {
    Cognito: {
      userPoolId: ENV.USER_POOL_ID,
      userPoolClientId: ENV.USER_POOL_CLIENT_ID,
      // tell Amplify which credential types are allowed for sign in
      loginWith: {
        username: true,
        email: true,
        phone: false,
      },
      // Explicitly set authentication flow to USER_PASSWORD_AUTH
      // This is required for username/password authentication
      userPoolEndpoint: `https://cognito-idp.${ENV.REGION}.amazonaws.com`,
    },
  },
};

console.log('Amplify config:', JSON.stringify(config, null, 2));
Amplify.configure(config);
console.log('=== Amplify configured successfully ===');
