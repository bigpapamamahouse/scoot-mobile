
import AsyncStorage from '@react-native-async-storage/async-storage';

const ID_TOKEN_KEY = 'idToken';
const PUSH_TOKEN_KEY = 'pushToken';
const SEEN_NOTIFICATIONS_KEY = 'seenNotifications';
const INVITE_CODE_PREFIX = 'inviteCode:';

export async function readIdToken(): Promise<string | null> {
  try {
    return await AsyncStorage.getItem(ID_TOKEN_KEY);
  } catch {
    return null;
  }
}

export async function writeIdToken(token: string) {
  try {
    await AsyncStorage.setItem(ID_TOKEN_KEY, token);
  } catch {}
}

export async function clearAuth() {
  try {
    await AsyncStorage.removeItem(ID_TOKEN_KEY);
  } catch {}
}

export async function readPushToken(): Promise<string | null> {
  try {
    return await AsyncStorage.getItem(PUSH_TOKEN_KEY);
  } catch {
    return null;
  }
}

export async function writePushToken(token: string) {
  try {
    await AsyncStorage.setItem(PUSH_TOKEN_KEY, token);
  } catch {}
}

export async function readSeenNotificationIds(): Promise<string[]> {
  try {
    const raw = await AsyncStorage.getItem(SEEN_NOTIFICATIONS_KEY);
    if (!raw) {
      return [];
    }
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      return parsed.filter((id) => typeof id === 'string');
    }
  } catch {}
  return [];
}

export async function writeSeenNotificationIds(ids: string[]) {
  try {
    await AsyncStorage.setItem(SEEN_NOTIFICATIONS_KEY, JSON.stringify(ids));
  } catch {}
}

const normalizeInviteKey = (userId: string) => `${INVITE_CODE_PREFIX}${userId}`;

export async function readStoredInviteCode(userId: string | null | undefined): Promise<string | null> {
  if (typeof userId !== 'string') {
    return null;
  }
  const trimmed = userId.trim();
  if (!trimmed) {
    return null;
  }
  try {
    const raw = await AsyncStorage.getItem(normalizeInviteKey(trimmed));
    if (typeof raw === 'string') {
      const normalized = raw.trim();
      return normalized.length ? normalized : null;
    }
  } catch {}
  return null;
}

export async function writeStoredInviteCode(userId: string | null | undefined, code: string | null | undefined) {
  if (typeof userId !== 'string') {
    return;
  }
  const trimmedId = userId.trim();
  if (!trimmedId) {
    return;
  }
  const storageKey = normalizeInviteKey(trimmedId);
  const normalizedCode = typeof code === 'string' ? code.trim() : '';
  try {
    if (normalizedCode) {
      await AsyncStorage.setItem(storageKey, normalizedCode);
    } else {
      await AsyncStorage.removeItem(storageKey);
    }
  } catch {}
}
