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
    const out: SignInOutput = await signIn({ username, password });
    // Debug next step (shows exactly why it didn’t complete)
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
        // We’re signed in, fetch tokens
        const session = await fetchAuthSession();
        const idToken = session.tokens?.idToken?.toString() || '';
        if (!idToken) throw new Error('No ID token in session');
        await writeIdToken(idToken);
        return { status: 'SIGNED_IN', idToken };
      }
    }
  } catch (e: any) {
    console.log('signIn error:', e);
    // Common Cognito errors include UserNotConfirmedException, NotAuthorizedException, UserNotFoundException, etc.
    return { status: 'ERROR', name: e?.name || 'AuthError', message: e?.message || String(e) };
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
