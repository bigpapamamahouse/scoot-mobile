import {
  signIn,
  signOut,
  signUp,
  confirmSignUp,
  fetchAuthSession,
  type SignInOutput,
} from 'aws-amplify/auth';
import { writeIdToken, clearAuth } from '../lib/storage';

export type SignInResult =
  | { status: 'SIGNED_IN'; idToken: string }
  | { status: 'NEEDS_CONFIRMATION'; username: string }
  | { status: 'RESET_PASSWORD' }
  | { status: 'MFA_REQUIRED'; type: string }
  | { status: 'ERROR'; name: string; message: string };

export async function signInFn(username: string, password: string): Promise<SignInResult> {
  try {
    console.log('=== signIn attempt ===');
    console.log('Username:', username);

    const out: SignInOutput = await signIn({ username, password });
    // Debug next step (shows exactly why it didn't complete)
    console.log('signIn nextStep:', JSON.stringify(out?.nextStep, null, 2));

    switch (out?.nextStep?.signInStep) {
      case 'CONFIRM_SIGN_UP':
        return { status: 'NEEDS_CONFIRMATION', username };
      case 'RESET_PASSWORD':
        return { status: 'RESET_PASSWORD' };
      case 'CONFIRM_SIGN_IN_WITH_TOTP_CODE':
      case 'CONFIRM_SIGN_IN_WITH_SMS_CODE':
        return { status: 'MFA_REQUIRED', type: out.nextStep.signInStep };
      case 'DONE':
      default: {
        // We're signed in, fetch tokens
        const session = await fetchAuthSession();
        const idToken = session.tokens?.idToken?.toString() || '';
        if (!idToken) throw new Error('No ID token in session');
        await writeIdToken(idToken);
        return { status: 'SIGNED_IN', idToken };
      }
    }
  } catch (e: any) {
    console.error('=== signIn ERROR ===');
    console.error('Error object:', e);
    console.error('Error name:', e?.name);
    console.error('Error message:', e?.message);
    console.error('Error stack:', e?.stack);
    console.error('Error stringified:', JSON.stringify(e, null, 2));

    // Common Cognito errors include UserNotConfirmedException, NotAuthorizedException, UserNotFoundException, etc.
    const errorName = e?.name || 'UnknownError';
    const errorMessage = e?.message || e?.toString() || 'An unknown error occurred';

    return { status: 'ERROR', name: errorName, message: errorMessage };
  }
}

export async function signUpFn(username: string, password: string, email?: string) {
  return signUp({ username, password, options: email ? { userAttributes: { email } } : undefined });
}

export async function confirmSignUpFn(username: string, code: string) {
  return confirmSignUp({ username, confirmationCode: code });
}

export async function signOutFn() {
  try { await signOut(); } finally { await clearAuth(); }
}
