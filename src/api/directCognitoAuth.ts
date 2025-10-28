// Direct Cognito authentication bypass for debugging
import { ENV } from '../lib/env';

// Helper to create AWS Signature Version 4 (not needed for InitiateAuth, but keeping for reference)
async function sha256(message: string): Promise<ArrayBuffer> {
  const encoder = new TextEncoder();
  const data = encoder.encode(message);
  return await crypto.subtle.digest('SHA-256', data);
}

async function bufferToHex(buffer: ArrayBuffer): Promise<string> {
  const byteArray = new Uint8Array(buffer);
  const hexCodes = [...byteArray].map(value => {
    const hexCode = value.toString(16);
    return hexCode.padStart(2, '0');
  });
  return hexCodes.join('');
}

/**
 * Direct Cognito authentication bypassing Amplify
 * Use this to test if the issue is with Amplify or Cognito itself
 */
export async function directCognitoAuth(username: string, password: string) {
  try {
    console.log('=== Direct Cognito Auth Attempt ===');
    console.log('Username:', username);
    console.log('Client ID:', ENV.USER_POOL_CLIENT_ID);

    const url = `https://cognito-idp.${ENV.REGION}.amazonaws.com/`;

    const payload = {
      ClientId: ENV.USER_POOL_CLIENT_ID,
      AuthFlow: 'USER_PASSWORD_AUTH',
      AuthParameters: {
        USERNAME: username,
        PASSWORD: password,
      },
    };

    console.log('Request URL:', url);
    console.log('Request payload (password hidden):', {
      ...payload,
      AuthParameters: { ...payload.AuthParameters, PASSWORD: '***' }
    });

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-amz-json-1.1',
        'X-Amz-Target': 'AWSCognitoIdentityProviderService.InitiateAuth',
      },
      body: JSON.stringify(payload),
    });

    const responseText = await response.text();
    console.log('Response status:', response.status);
    console.log('Response headers:', JSON.stringify(Object.fromEntries(response.headers.entries())));
    console.log('Response body:', responseText);

    let responseData;
    try {
      responseData = JSON.parse(responseText);
    } catch (e) {
      console.error('Failed to parse response as JSON');
      return { success: false, error: 'Invalid response from Cognito', rawResponse: responseText };
    }

    if (response.ok) {
      console.log('✅ Direct auth successful!');
      return { success: true, data: responseData };
    } else {
      console.log('❌ Direct auth failed');
      return { success: false, error: responseData, status: response.status };
    }
  } catch (error: any) {
    console.error('❌ Direct auth exception:', error);
    return { success: false, error: error.message, exception: error };
  }
}
