import {
  signIn,
  signOut,
  signUp,
  confirmSignUp,
  fetchAuthSession,
  getCurrentUser,
  resetPassword,
  confirmResetPassword,
  type SignInOutput,
} from 'aws-amplify/auth';
import { writeIdToken, clearAuth } from '../lib/storage';

export type SignInResult =
  | { status: 'SIGNED_IN'; idToken: string }
  | { status: 'NEEDS_CONFIRMATION'; username: string }
  | { status: 'RESET_PASSWORD' }
  | { status: 'MFA_REQUIRED'; type: string }
  | { status: 'ERROR'; name: string; message: string };

// Check if user is already authenticated
export async function checkAuthStatus(): Promise<boolean> {
  try {
    await getCurrentUser();
    return true;
  } catch (e) {
    return false;
  }
}

export async function signInFn(username: string, password: string): Promise<SignInResult> {
  try {
    // Check if user is already signed in
    const isSignedIn = await checkAuthStatus();
    if (isSignedIn) {
      await signOut();
      await clearAuth();
    }

    // Explicitly use username (not email) for sign in
    // Amplify v6 may be sensitive to parameter names
    const signInInput = {
      username: username,
      password: password,
      options: {
        authFlowType: 'USER_PASSWORD_AUTH' as const,
      },
    };

    const out: SignInOutput = await signIn(signInInput);

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
    console.error('Sign in error:', e?.name || 'UnknownError', '-', e?.message || e?.toString());

    // Common Cognito errors include UserNotConfirmedException, NotAuthorizedException, UserNotFoundException, etc.
    const errorName = e?.name || 'UnknownError';
    const errorMessage = e?.message || e?.toString() || 'An unknown error occurred';

    return { status: 'ERROR', name: errorName, message: errorMessage };
  }
}

export async function signUpFn(username: string, password: string, email?: string, inviteCode?: string) {
  const userAttributes: Record<string, string> = {};

  if (email) {
    userAttributes.email = email;
  }

  if (inviteCode) {
    // Pass invite code as custom:invite attribute (expected by PreSignUp Lambda)
    userAttributes['custom:invite'] = inviteCode;
  }

  return signUp({
    username,
    password,
    options: Object.keys(userAttributes).length > 0 ? { userAttributes } : undefined
  });
}

export async function confirmSignUpFn(username: string, code: string) {
  return confirmSignUp({ username, confirmationCode: code });
}

export async function signOutFn() {
  try { await signOut(); } finally { await clearAuth(); }
}

export type ResetPasswordResult =
  | { status: 'CODE_SENT'; deliveryMedium: string; destination: string }
  | { status: 'DONE' }
  | { status: 'ERROR'; message: string };

export async function resetPasswordFn(username: string): Promise<ResetPasswordResult> {
  try {
    const output = await resetPassword({ username });

    if (output.nextStep.resetPasswordStep === 'CONFIRM_RESET_PASSWORD_WITH_CODE') {
      const { deliveryMedium, destination } = output.nextStep.codeDeliveryDetails;
      return {
        status: 'CODE_SENT',
        deliveryMedium: deliveryMedium || 'EMAIL',
        destination: destination || '',
      };
    }

    return { status: 'DONE' };
  } catch (e: any) {
    console.error('Reset password error:', e?.name || 'UnknownError', '-', e?.message || e?.toString());
    return { status: 'ERROR', message: e?.message || 'Failed to initiate password reset' };
  }
}

export type ConfirmResetPasswordResult =
  | { status: 'SUCCESS' }
  | { status: 'ERROR'; message: string };

export async function confirmResetPasswordFn(
  username: string,
  confirmationCode: string,
  newPassword: string
): Promise<ConfirmResetPasswordResult> {
  try {
    await confirmResetPassword({ username, confirmationCode, newPassword });
    return { status: 'SUCCESS' };
  } catch (e: any) {
    console.error('Confirm reset password error:', e?.name || 'UnknownError', '-', e?.message || e?.toString());
    return { status: 'ERROR', message: e?.message || 'Failed to reset password' };
  }
}
