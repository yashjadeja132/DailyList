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
  const fresh = all.filter(o => o.status === 'New');
  const ready = all.filter(o => o.status === 'Ready');
  const done = all.filter(o => o.status === 'Picked up');
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
                <Button title="Review orders" icon="list" onPress={() => navigation.navigate('Queue')} style={{marginTop: 14}} />
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

          {/* is the shop taking new orders? */}
          <View style={s.accepting}>
            <Text style={s.acceptingTitle}>New orders</Text>
            <View style={s.seg}>
              {([['open', 'Accepting', colors.primary], ['busy', 'Busy', colors.amber], ['closed', 'Paused', colors.danger]] as const).map(([k, label, c]) => {
                const on = (shop?.accepting || 'open') === k;
                return (
                  <Pressable key={k} onPress={() => setAccepting(k)} style={[s.segItem, on && {backgroundColor: c}]}>
                    <Text style={[s.segText, on && {color: '#fff'}]}>{label}</Text>
                  </Pressable>
                );
              })}
            </View>
            <Text style={s.acceptingHint}>
              {(shop?.accepting || 'open') === 'open' ? 'Customers can send you lists.'
                : shop?.accepting === 'busy' ? 'Customers can still send lists but see that replies may be slow.'
                : 'Customers cannot send new lists until you accept orders again.'}
            </Text>
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
