
import AsyncStorage from '@react-native-async-storage/async-storage';
const ID_TOKEN_KEY = 'idToken';
export async function readIdToken(): Promise<string | null> { try { return await AsyncStorage.getItem(ID_TOKEN_KEY); } catch { return null; } }
export async function writeIdToken(token: string){ try { await AsyncStorage.setItem(ID_TOKEN_KEY, token); } catch {} }
export async function clearAuth(){ try { await AsyncStorage.removeItem(ID_TOKEN_KEY); } catch {} }
