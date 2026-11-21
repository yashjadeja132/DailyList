import React, {useCallback, useState} from 'react';
import {ActivityIndicator, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View} from 'react-native';
import {useFocusEffect} from '@react-navigation/native';
import {Button, Card, IconText, SectionHeader, when} from '../../components';
import Icon from '../../Icon';
import {Avatar, Bell, FocusStatusBar, Hero} from '../../ui';
import {useUnread} from '../../notifications';
import {api, Order, ShopState} from '../../api';
import {useAuth} from '../../AuthContext';
import {colors, shadowLift} from '../../theme';

/** "5 min ago" from a server time (UTC, "YYYY-MM-DD HH:MM:SS") */
const timeAgo = (t: string) => {
  const m = Math.max(0, Math.round((Date.now() - new Date(t.replace(' ', 'T') + 'Z').getTime()) / 60000));
  if (m < 1) return 'just now';
  if (m < 60) return `${m} min ago`;
  const h = Math.floor(m / 60);
  return h < 24 ? `${h} h ago` : `${Math.floor(h / 24)} d ago`;
};

const TABS = [['open', 'Accepting', colors.primary], ['busy', 'Busy', colors.amber], ['closed', 'Paused', colors.danger]] as const;

const greeting = () => {
  const h = new Date().getHours();
  return h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening';
};

export default function OwnerHomeScreen({navigation}: any) {
  const {user, shop, account, setShop} = useAuth();
  const [switching, setSwitching] = useState(false);
  const {unread} = useUnread();
  const setAccepting = async (accepting: ShopState) => {
    if (switching || shop?.accepting === accepting) return;
    setSwitching(true);
    try { setShop(await api('/shop/status', 'PUT', {accepting})); } catch (e: any) { setError(e.message); }
    finally { setSwitching(false); }
  };
  const [orders, setOrders] = useState<Order[] | null>(null);
  const [error, setError] = useState('');
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try { setOrders(await api<Order[]>('/owner/orders')); setError(''); }
    catch (e: any) { setError(e.message); }
  }, []);
  useFocusEffect(useCallback(() => {
    load();
    const t = setInterval(load, 8000);
    return () => clearInterval(t);
  }, [load]));

  const all = orders || [];
  // orders waiting for the shop's check (not started, or started and not finished)
  const fresh = all.filter(o => o.status === 'New' || o.status === 'Accepted');
  const ready = all.filter(o => o.status === 'Ready');
  const done = all.filter(o => o.status === 'Picked up');
  const preparing = all.filter(o => o.status === 'Preparing');
  const onHold = all.filter(o => o.status === 'Awaiting you');
  const mode: ShopState = (shop?.accepting || 'open') as ShopState;
  const shown = mode === 'open' ? fresh : mode === 'busy' ? preparing : onHold;
  const inProgress = all.filter(o => ['Accepted', 'Awaiting you', 'Preparing'].includes(o.status));
  const today = new Date().toISOString().slice(0, 10);
  const todayCount = all.filter(o => o.created_at.startsWith(today)).length;
  const recent = [...all].sort((a, b) => b.id - a.id).slice(0, 4);
  const daysLeft = account.subscription?.days_left;
  const expiring = daysLeft != null && daysLeft <= 7 && account.team?.is_primary !== false;

  return (
    <View style={s.screen}>
      <FocusStatusBar style="light-content" />
      <ScrollView showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} colors={[colors.primary]} progressViewOffset={40}
            onRefresh={async () => { setRefreshing(true); await load(); setRefreshing(false); }} />}>
      <Hero>
        <View style={s.top}>
          <View style={{flex: 1}}>
            <Text style={s.hello}>{greeting()}</Text>
            <Text style={s.name} numberOfLines={1}>{user?.name.split(' ')[0]}</Text>
            <View style={s.shopRow}>
              <Icon name="storefront" size={15} color="#BDE6E1" />
              <Text style={s.shopName} numberOfLines={1}>{shop?.name}</Text>
            </View>
          </View>
          <Bell unread={unread} onPress={() => navigation.navigate('Notifications')} />
          <Pressable onPress={() => navigation.navigate('Profile')} hitSlop={8}>
            <Avatar name={user?.name || '?'} size={40} round style={s.heroAvatar} />
          </Pressable>
        </View>
      </Hero>
        <View style={s.body}>
        {!orders && !error ? <ActivityIndicator style={{marginTop: 60}} color={colors.primary} size="large" /> : (<>
          {error ? <Card style={{backgroundColor: '#fee2e2', marginBottom: 12}}><IconText icon="cloud-offline" color={colors.danger}>{error}</IconText></Card> : null}

          {/* the thing to act on */}
          <View style={s.focus}>
            {fresh.length > 0 ? (
              <>
                <View style={s.focusRow}>
                  <View style={[s.focusIcon, {backgroundColor: '#dbeafe'}]}><Icon name="notifications" size={26} color={colors.blue} filled /></View>
                  <View style={{flex: 1}}>
                    <Text style={s.focusNum}>{fresh.length} new order{fresh.length > 1 ? 's' : ''}</Text>
                    <Text style={s.muted}>Check each list and mark what you don't have.</Text>
                  </View>
                </View>
                <Button title="Review orders" icon="list" onPress={() => navigation.navigate('Queue', {filter: 'New', at: Date.now()})} style={{marginTop: 14}} />
              </>
            ) : (
              <View style={s.focusRow}>
                <View style={s.focusIcon}><Icon name="checkmark-circle" size={28} color={colors.primaryDark} filled /></View>
                <View style={{flex: 1}}>
                  <Text style={s.focusNum}>You're all caught up</Text>
                  <Text style={s.muted}>No new orders right now. We'll show them here.</Text>
                </View>
              </View>
            )}
          </View>

          {shop && shop.approval && shop.approval !== 'approved' ? (
            <View style={s.expiring}>
              <Icon name="alert-circle" size={26} color={colors.amber} />
              <View style={{flex: 1}}>
                <Text style={s.expTitle}>{shop.approval === 'pending' ? 'Waiting for approval' : shop.approval === 'suspended' ? 'Shop suspended' : 'Shop not approved'}</Text>
                <Text style={s.expText}>{shop.approval === 'pending' ? 'Customers will see your shop once our team approves it.' : shop.approval_note || 'Please contact support.'}</Text>
              </View>
            </View>
          ) : null}

          {/* order acceptance control + the orders for the chosen state */}
          <View style={s.accepting}>
            <Text style={s.acceptingTitle}>Orders</Text>
            <View style={s.seg}>
              {TABS.map(([k, label, c]) => {
                const on = mode === k;
                const n = (k === 'open' ? fresh : k === 'busy' ? preparing : onHold).length;
                return (
                  <Pressable key={k} onPress={() => setAccepting(k)} style={[s.segItem, on && {backgroundColor: c}]}>
                    <Text style={[s.segText, on && {color: '#fff'}]}>{label}{n ? ` (${n})` : ''}</Text>
                  </Pressable>
                );
              })}
            </View>
            <Text style={s.acceptingHint}>
              {mode === 'open' ? 'Taking new orders. These are the orders you are accepting now.'
                : mode === 'busy' ? 'Busy: customers can still send lists but see that replies may be slow. These orders are being prepared.'
                : 'Paused: customers cannot send new lists. These orders are on hold, waiting for the customer.'}
            </Text>

            {shown.length === 0 ? (
              <Text style={s.newEmpty}>{mode === 'open' ? 'No orders to accept right now. New requests will appear here.'
                : mode === 'busy' ? 'No orders are being prepared right now.' : 'No orders on hold.'}</Text>
            ) : shown.slice(0, 4).map((o, i) => (
              <Pressable key={o.id} onPress={() => navigation.navigate('Queue', {filter: mode === 'open' ? 'New' : 'In progress', at: Date.now()})} style={[s.newRow, i > 0 && s.newRowBorder]}>
                <Avatar name={o.customer_name} size={38} />
                <View style={{flex: 1}}>
                  <View style={s.newLine}>
                    <Text style={[s.newName, {flex: 1}]} numberOfLines={1}>{o.customer_name}</Text>
                    <Text style={s.newTime}>{timeAgo(o.created_at)}</Text>
                  </View>
                  <Text style={s.newMeta} numberOfLines={1}>
                    {o.items.length} item{o.items.length > 1 ? 's' : ''} · {o.items.slice(0, 3).map(x => x.name).join(', ')}{o.items.length > 3 ? '…' : ''}
                  </Text>
                  {o.note ? <Text style={s.newNote} numberOfLines={1}>“{o.note}”</Text> : null}
                </View>
                <View style={[s.newPill, o.status === 'Accepted' && {backgroundColor: '#fef3c7'}, o.status === 'Preparing' && {backgroundColor: '#fef3c7'}, o.status === 'Awaiting you' && {backgroundColor: '#fee2e2'}]}>
                  <Text style={[s.newPillText, (o.status === 'Accepted' || o.status === 'Preparing') && {color: '#92400e'}, o.status === 'Awaiting you' && {color: '#991b1b'}]}>
                    {o.status === 'Accepted' ? 'Checking' : o.status === 'Awaiting you' ? 'Waiting' : o.status}
                  </Text>
                </View>
              </Pressable>
            ))}
            {shown.length > 4 ? (
              <Pressable onPress={() => navigation.navigate('Queue', {filter: mode === 'open' ? 'New' : 'In progress', at: Date.now()})}><Text style={s.newMore}>See all {shown.length} orders</Text></Pressable>
            ) : null}
          </View>

          {expiring ? (
            <View style={s.expiring}>
              <Icon name="alert-circle" size={26} color={colors.amber} />
              <View style={{flex: 1}}>
                <Text style={s.expTitle}>Your plan ends in {daysLeft} day{daysLeft === 1 ? '' : 's'}</Text>
                <Text style={s.expText}>Renew to keep receiving orders.</Text>
              </View>
              <Button small title="Renew" onPress={() => navigation.navigate('Plans')} />
            </View>
          ) : null}

</>)}
        </View>
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  screen: {flex: 1, backgroundColor: colors.bg},
  top: {flexDirection: 'row', alignItems: 'center'},
  hello: {color: '#BDE6E1', fontSize: 13, fontWeight: '600'},
  name: {color: '#fff', fontSize: 18, fontWeight: '800'},
  shopRow: {flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 3},
  shopName: {color: '#DDF2EF', fontSize: 13, fontWeight: '700', flexShrink: 1},
  heroAvatar: {borderWidth: 2.5, borderColor: '#ffffff55'},
  body: {padding: 16, paddingBottom: 100, marginTop: -28},
  muted: {color: colors.muted, fontSize: 12},
  focus: {backgroundColor: '#fff', borderRadius: 20, padding: 16, ...shadowLift},
  focusRow: {flexDirection: 'row', alignItems: 'center', gap: 14},
  focusIcon: {width: 56, height: 56, borderRadius: 18, backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center'},
  focusNum: {fontSize: 16, fontWeight: '800', color: colors.text},
  accepting: {backgroundColor: '#fff', borderRadius: 18, padding: 14, marginTop: 14, gap: 10},
  acceptingTitle: {fontWeight: '800', color: colors.text, fontSize: 13},
  seg: {flexDirection: 'row', backgroundColor: '#f3f4f6', borderRadius: 12, padding: 3},
  segItem: {flex: 1, alignItems: 'center', paddingVertical: 9, borderRadius: 10},
  segText: {fontWeight: '800', color: colors.muted, fontSize: 12},
  acceptingHint: {color: colors.muted, fontSize: 12},
  newHeadTop: {flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between'},
  newLine: {flexDirection: 'row', alignItems: 'center', gap: 8},
  newTime: {color: colors.muted, fontSize: 11},
  newNote: {color: colors.muted, fontSize: 12, fontStyle: 'italic', marginTop: 1},
  newCount: {fontWeight: '800', color: colors.primaryDark, fontSize: 12, backgroundColor: colors.primarySoft, borderRadius: 10, paddingHorizontal: 9, paddingVertical: 2, overflow: 'hidden'},
  newEmpty: {color: colors.muted, fontSize: 12},
  newRow: {flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8},
  newRowBorder: {borderTopWidth: StyleSheet.hairlineWidth, borderColor: colors.border},
  newName: {fontWeight: '700', color: colors.text, fontSize: 13},
  newMeta: {color: colors.muted, fontSize: 12, marginTop: 1},
  newPill: {backgroundColor: colors.primarySoft, borderRadius: 12, paddingHorizontal: 10, paddingVertical: 4},
  newPillText: {color: colors.primaryDark, fontWeight: '800', fontSize: 11},
  newMore: {color: colors.primary, fontWeight: '700', fontSize: 12, textAlign: 'center', paddingTop: 4},
  expiring: {flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: '#fffbeb', borderRadius: 18, padding: 14, marginTop: 14},
  expTitle: {fontWeight: '800', color: colors.text, fontSize: 13},
  expText: {color: colors.muted, fontSize: 12, marginTop: 1},
  stats: {
    flexDirection: 'row', backgroundColor: '#fff', borderRadius: 18, paddingVertical: 14, marginTop: 14,
    shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 6, shadowOffset: {width: 0, height: 2}, elevation: 2,
  },
  stat: {flex: 1, alignItems: 'center'},
  statNum: {fontSize: 18, fontWeight: '800', color: colors.text},
  statLabel: {fontSize: 11, color: colors.muted, fontWeight: '600', marginTop: 1},
  divider: {width: 1, backgroundColor: colors.border, marginVertical: 4},
  recent: {
    flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: '#fff', borderRadius: 18, padding: 12,
    shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 6, shadowOffset: {width: 0, height: 2}, elevation: 2,
  },
  recentName: {fontSize: 13, fontWeight: '800', color: colors.text},
  when: {fontSize: 11, color: '#9ca3af', marginTop: 2},
  emptyCard: {alignItems: 'center', backgroundColor: '#fff', borderRadius: 20, padding: 26},
  emptyIcon: {width: 64, height: 64, borderRadius: 20, backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center'},
  emptyTitle: {fontSize: 14, fontWeight: '800', color: colors.text, marginTop: 12},
  emptyText: {color: colors.muted, textAlign: 'center', marginTop: 4},
});
