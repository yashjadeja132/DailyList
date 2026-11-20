import {useCallback, useEffect, useState} from 'react';
import {useIsFocused} from '@react-navigation/native';
import {api, AppNotification} from './api';

/** Number of unread notifications, refreshed while the screen is in front. */
export function useUnread() {
  const [unread, setUnread] = useState(0);
  const focused = useIsFocused();
  const load = useCallback(() => {
    api<{unread: number; items: AppNotification[]}>('/notifications').then(r => setUnread(r.unread)).catch(() => {});
  }, []);
  useEffect(() => {
    if (!focused) return;
    load();
    const t = setInterval(load, 15000);
    return () => clearInterval(t);
  }, [focused, load]);
  return {unread, reload: load};
}
