
import AsyncStorage from '@react-native-async-storage/async-storage';
const ID_TOKEN_KEY = 'idToken';
const PUSH_TOKEN_KEY = 'pushToken';
const SEEN_NOTIFICATIONS_KEY = 'seenNotifications';

export async function readIdToken(): Promise<string | null> { try { return await AsyncStorage.getItem(ID_TOKEN_KEY); } catch { return null; } }
export async function writeIdToken(token: string){ try { await AsyncStorage.setItem(ID_TOKEN_KEY, token); } catch {} }
export async function clearAuth(){
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
