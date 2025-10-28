// src/awsConfig.ts
import { Amplify } from 'aws-amplify';
import { loadGetRandomValues } from '@aws-amplify/react-native';
import 'react-native-url-polyfill/auto';
import { ENV } from './lib/env';

loadGetRandomValues();

Amplify.configure({
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
    },
  },
});
