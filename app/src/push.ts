import {PermissionsAndroid, Platform} from 'react-native';
import {getMessaging, getToken, onTokenRefresh} from '@react-native-firebase/messaging';
import {api} from './api';

let current = '';
let unsubscribeRefresh: (() => void) | null = null;

/** Asks for notification permission, then registers this phone with the server so it can get push messages. */
export async function registerPush() {
  try {
    if (Platform.OS === 'android' && Platform.Version >= 33) {
      const r = await PermissionsAndroid.request('android.permission.POST_NOTIFICATIONS' as any);
      if (r !== PermissionsAndroid.RESULTS.GRANTED) return; // the user said no: in-app notifications still work
    }
    current = await getToken(getMessaging());
    if (current) await api('/devices', 'POST', {token: current});
    unsubscribeRefresh?.();
    unsubscribeRefresh = onTokenRefresh(getMessaging(), (t: string) => {
      current = t;
      api('/devices', 'POST', {token: t}).catch(() => {});
    });
  } catch {
    /* push is optional, never block the app */
  }
}

/** Call before logging out so this phone stops getting the previous user's messages. */
export async function unregisterPush() {
  unsubscribeRefresh?.(); unsubscribeRefresh = null;
  if (!current) return;
  try { await api('/devices', 'DELETE', {token: current}); } catch {}
  current = '';
}
