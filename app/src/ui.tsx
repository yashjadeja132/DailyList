import React from 'react';
import {Pressable, StatusBar, StatusBarStyle, StyleProp, StyleSheet, Text, View, ViewStyle} from 'react-native';
import {useIsFocused} from '@react-navigation/native';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import Icon from './Icon';
import {colors, statusColor} from './theme';

// ---------- Status bar that only applies while its screen is in front ----------
export function FocusStatusBar({style}: {style: StatusBarStyle}) {
  const focused = useIsFocused();
  return focused ? <StatusBar barStyle={style} /> : null;
}

// ---------- Avatar: a coloured tile with the first letter (same name = same colour) ----------
const TILES: {bg: string; fg: string}[] = [
  {bg: '#DDF2EF', fg: '#087E75'}, {bg: '#dbeafe', fg: '#1d4ed8'}, {bg: '#fef3c7', fg: '#b45309'},
  {bg: '#fce7f3', fg: '#be185d'}, {bg: '#ede9fe', fg: '#6d28d9'}, {bg: '#ccfbf1', fg: '#0f766e'},
];
const tileFor = (name: string) => {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0;
  return TILES[h % TILES.length];
};

export function Avatar({name, size = 46, round, style}: {
  name: string; size?: number; round?: boolean; style?: StyleProp<ViewStyle>;
}) {
  const t = tileFor(name || '?');
  return (
    <View style={[{
      width: size, height: size, borderRadius: round ? size / 2 : size * 0.3, backgroundColor: t.bg,
      alignItems: 'center', justifyContent: 'center',
    }, style]}>
      <Text style={{fontSize: size * 0.44, fontWeight: '800', color: t.fg}}>{(name || '?').trim().charAt(0).toUpperCase()}</Text>
    </View>
  );
}

// ---------- Hero: the green top of the main screens ----------
export function Hero({children, style}: {children: React.ReactNode; style?: StyleProp<ViewStyle>}) {
  const insets = useSafeAreaInsets();
  return (
    <View style={[h.hero, {paddingTop: insets.top + 6}, style]}>
      <View style={h.circleA} />
      <View style={h.circleB} />
      {children}
    </View>
  );
}

// ---------- Notification bell with an unread dot ----------
export function Bell({unread, onPress}: {unread: number; onPress: () => void}) {
  return (
    <Pressable onPress={onPress} hitSlop={8} style={h.bell}>
      <Icon name="notifications" size={20} color="#fff" />
      {unread > 0 ? <View style={h.bellDot} /> : null}
    </Pressable>
  );
}

// ---------- Is the shop taking orders? ----------
export const SHOP_STATE_LABEL = {open: 'Open for orders', busy: 'Busy: replies may be slow', closed: 'Closed for new orders'} as const;
export function ShopStatusTag({state}: {state?: 'open' | 'busy' | 'closed'}) {
  const st = state || 'open';
  const c = st === 'open' ? colors.primary : st === 'busy' ? colors.amber : colors.danger;
  return (
    <View style={{flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 3}}>
      <View style={{width: 8, height: 8, borderRadius: 4, backgroundColor: c}} />
      <Text style={{color: c, fontSize: 12, fontWeight: '700'}}>{SHOP_STATE_LABEL[st]}</Text>
    </View>
  );
}

// ---------- Order status ----------
const LABEL: Record<string, string> = {
  New: 'Sent', Accepted: 'Checking items', 'Awaiting you': 'Needs your answer', Preparing: 'Preparing',
  Ready: 'Ready for pickup', 'Picked up': 'Completed',
};
const OWNER_LABEL: Record<string, string> = {...LABEL, New: 'New', 'Awaiting you': 'Waiting for customer', Accepted: 'Checking'};
export function StatusPill({status, small, owner}: {status: string; small?: boolean; owner?: boolean}) {
  const c = statusColor[status] || colors.muted;
  const label = (owner ? OWNER_LABEL : LABEL)[status] || status;
  return (
    <View style={[h.pill, {backgroundColor: c + '1f'}, small && {paddingVertical: 3}]}>
      <View style={[h.dot, {backgroundColor: c}]} />
      <Text style={{color: c, fontWeight: '800', fontSize: small ? 11 : 12}}>{label}</Text>
    </View>
  );
}

const STEPS = ['Sent', 'Checking', 'Preparing', 'Ready', 'Done'];
const STEP_OF: Record<string, number> = {New: 0, Accepted: 1, 'Awaiting you': 1, Preparing: 2, Ready: 3, 'Picked up': 4};
const ENDED: Record<string, string> = {
  Cancelled: 'This order was cancelled',
  Declined: 'The shop could not take this order',
  Expired: 'This order expired because nobody answered in time',
};

/** Where an order is. Orders that ended early (cancelled, declined, expired) show a red note instead. */
export function Tracker({status}: {status: string}) {
  if (ENDED[status]) {
    return (
      <View style={h.cancelled}>
        <Icon name="close-circle" size={18} color={colors.danger} />
        <Text style={{color: colors.danger, fontWeight: '700', flex: 1}}>{ENDED[status]}</Text>
      </View>
    );
  }
  const current = STEP_OF[status] ?? 0;
  return (
    <View style={h.tracker}>
      {STEPS.map((label, i) => {
        const done = i < current || status === 'Picked up';
        const now = i === current && status !== 'Picked up';
        return (
          <React.Fragment key={label}>
            {i > 0 && <View style={[h.line, (done || now) && {backgroundColor: colors.primary}]} />}
            <View style={{alignItems: 'center', width: 58}}>
              <View style={[h.step, done && h.stepDone, now && h.stepNow]}>
                {done ? <Icon name="checkmark" size={14} color="#fff" /> : now ? <View style={h.stepDot} /> : null}
              </View>
              <Text style={[h.stepLabel, (done || now) && {color: colors.text, fontWeight: '800'}]}>{label}</Text>
            </View>
          </React.Fragment>
        );
      })}
    </View>
  );
}

/** "0.4 km", "350 m" ... or a friendly fallback. */
export function distanceText(km: number | null | undefined) {
  if (km == null) return 'Distance unknown';
  if (km < 0.1) return 'Right here';
  if (km < 1) return `${Math.round(km * 1000)} m away`;
  return `${km} km away`;
}

const h = StyleSheet.create({
  bell: {width: 40, height: 40, borderRadius: 20, backgroundColor: '#ffffff26', alignItems: 'center', justifyContent: 'center', marginRight: 10},
  bellDot: {position: 'absolute', top: 9, right: 10, width: 9, height: 9, borderRadius: 5, backgroundColor: '#fbbf24', borderWidth: 1.5, borderColor: '#087E75'},
  hero: {
    backgroundColor: '#087E75', paddingHorizontal: 20, paddingBottom: 40,
    borderBottomLeftRadius: 32, borderBottomRightRadius: 32, overflow: 'hidden',
  },
  circleA: {position: 'absolute', width: 230, height: 230, borderRadius: 115, backgroundColor: '#ffffff14', top: -90, right: -70},
  circleB: {position: 'absolute', width: 160, height: 160, borderRadius: 80, backgroundColor: '#00000012', bottom: -70, left: -40},
  pill: {flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 20},
  dot: {width: 7, height: 7, borderRadius: 4},
  cancelled: {flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#fee2e2', borderRadius: 12, padding: 10},
  tracker: {flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'center'},
  line: {flex: 1, height: 3, borderRadius: 2, backgroundColor: '#e5e7eb', marginTop: 11, marginHorizontal: -8, maxWidth: 70},
  step: {
    width: 26, height: 26, borderRadius: 13, borderWidth: 2.5, borderColor: '#d1d5db', backgroundColor: '#fff',
    alignItems: 'center', justifyContent: 'center',
  },
  stepDone: {backgroundColor: colors.primary, borderColor: colors.primary},
  stepNow: {borderColor: colors.primary},
  stepDot: {width: 10, height: 10, borderRadius: 5, backgroundColor: colors.primary},
  stepLabel: {fontSize: 11, color: colors.muted, fontWeight: '600', marginTop: 6},
});


/**
 * Bottom space a scrolling tab screen needs so its last card clears the floating tab bar.
 * It follows the device: the bar sits `max(system inset, 8) + 16` above the bottom edge and is 48 tall.
 * (A fixed number is too small on some phones and too big on others.)
 */
export function useTabClearance() {
  const {bottom} = useSafeAreaInsets();
  return Math.max(bottom, 8) + 16 + 48 + 24;
}
