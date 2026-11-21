import React, {useCallback, useState} from 'react';
import {ActivityIndicator, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View} from 'react-native';
import {useFocusEffect} from '@react-navigation/native';
import {Button, Card, IconText, SectionHeader, when} from '../../components';
import Icon from '../../Icon';
import {Avatar, distanceText, FocusStatusBar, Bell, Hero, ShopStatusTag, StatusPill, Tracker, useTabClearance} from '../../ui';
import {useUnread} from '../../notifications';
import {api, isActiveOrder, Order, Shop} from '../../api';
import {useAuth} from '../../AuthContext';
import {Coords, getBestLocation} from '../../location';
import {colors, shadowLift} from '../../theme';

const greeting = () => {
  const h = new Date().getHours();
  return h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening';
};

export default function HomeScreen({navigation}: any) {
  const clearance = useTabClearance();
  const {user} = useAuth();
  const [shops, setShops] = useState<Shop[] | null>(null);
  const [orders, setOrders] = useState<Order[] | null>(null);
  const [nearbyKm, setNearbyKm] = useState(5);
  const [hasLoc, setHasLoc] = useState(true);
  const {unread} = useUnread();
  const [error, setError] = useState('');
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    let coords: Coords | null = null;
    try { coords = await getBestLocation(); setHasLoc(true); } catch { setHasLoc(false); }
    try {
      const q = coords ? `?lat=${coords.lat}&lng=${coords.lng}` : '';
      const [s, o] = await Promise.all([
        api<{nearby_km: number; shops: Shop[]}>('/shops' + q),
        api<Order[]>('/orders/mine'),
      ]);
      setShops(s.shops);
      setNearbyKm(s.nearby_km);
      setOrders(o);
      setError('');
    } catch (e: any) { setError(e.message); }
  }, []);
  useFocusEffect(useCallback(() => {
    load();
    const t = setInterval(load, 10000); // keeps the order status fresh
    return () => clearInterval(t);
  }, [load]));

  const all = orders || [];
  const total = all.length;
  const active = all.filter(o => isActiveOrder(o.status));
  const done = all.filter(o => o.status === 'Picked up').length;
  const current = active.find(o => o.status === 'Awaiting you') || active.find(o => o.status === 'Ready') || active[0]; // an order that needs your answer, then a ready one, comes first
  const recent = all.slice(0, 2);
  const nearest = (shops || [])
    .filter(sh => sh.distance_km != null && sh.distance_km <= nearbyKm)
    .slice(0, 6);

  const orderFrom = (shop: Shop, prefill?: {name: string; qty: string}[]) =>
    navigation.navigate(prefill ? 'NewOrder' : 'Shop', {shop, prefill});
  const reorder = (o: Order) =>
    orderFrom({id: o.shop_id, name: o.shop_name, address: '', lat: null, lng: null},
      o.items.map(i => ({name: i.name, qty: i.qty})));

  return (
    <View style={s.screen}>
      <FocusStatusBar style="light-content" />
      <ScrollView
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} colors={[colors.primary]} progressViewOffset={40}
            onRefresh={async () => { setRefreshing(true); await load(); setRefreshing(false); }} />}>
      <Hero>
        <View style={s.top}>
          <View style={{flex: 1}}>
            <Text style={s.hello}>{greeting()}</Text>
            <Text style={s.name} numberOfLines={1}>{user?.name.split(' ')[0]}</Text>
          </View>
          <Bell unread={unread} onPress={() => navigation.navigate('Notifications')} />
          <Pressable onPress={() => navigation.navigate('Profile')} hitSlop={8}>
            <Avatar name={user?.name || '?'} size={40} round style={s.heroAvatar} />
          </Pressable>
        </View>
      </Hero>
        <View style={[s.body, {paddingBottom: clearance}]}>
        {!orders && !error ? <ActivityIndicator style={{marginTop: 60}} color={colors.primary} size="large" /> : (<>

          {error ? <Card style={s.errorCard}><IconText icon="cloud-offline" color={colors.danger}>{error}</IconText></Card> : null}

          {/* what matters most: your order in progress, or the way to start one */}
          {current ? (
            <Pressable onPress={() => navigation.navigate('Orders')}>
              <View style={[s.focus, current.status === 'Ready' && s.focusReady]}>
                <View style={s.focusHead}>
                  <Avatar name={current.shop_name} size={44} />
                  <View style={{flex: 1}}>
                    <Text style={s.focusTitle} numberOfLines={1}>{current.shop_name}</Text>
                    <Text style={s.muted}>{current.items.length} item{current.items.length > 1 ? 's' : ''} · {when(current.created_at)}</Text>
                  </View>
                  <StatusPill status={current.status} />
                </View>
                <Tracker status={current.status} />
                {current.status === 'Ready' ? (
                  <View style={s.readyNote}>
                    <Icon name="bag-check" size={18} color={colors.primaryDark} />
                    <Text style={s.readyText}>Ready! Go to the shop to pick it up and pay.</Text>
                  </View>
                ) : null}
              </View>
            </Pressable>
          ) : (
            <View style={s.focus}>
              <View style={s.startRow}>
                <View style={s.startIcon}><Icon name="document-text" size={26} color={colors.primaryDark} /></View>
                <View style={{flex: 1}}>
                  <Text style={s.focusTitle}>Need something?</Text>
                  <Text style={s.muted}>Pick a shop, type your list, and skip the queue.</Text>
                </View>
              </View>
              <Button title="Find a shop" icon="storefront" onPress={() => navigation.navigate('Shops')} style={{marginTop: 14}} />
            </View>
          )}

          {!hasLoc ? (
            <Pressable onPress={() => navigation.navigate('Shops')}>
              <Card style={s.locCard}>
                <IconText icon="location" color="#92400e" textStyle={{fontSize: 12, fontWeight: '600'}}>
                  Location is off. Tap to find shops by area or pincode.
                </IconText>
              </Card>
            </Pressable>
          ) : nearest.length > 0 ? (
            <>
              <SectionHeader title="Shops near you" action="See all" onAction={() => navigation.navigate('Shops')} />
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{marginHorizontal: -16}}
                contentContainerStyle={{paddingHorizontal: 16, gap: 12, paddingBottom: 6}}>
                {nearest.map(sh => (
                  <Pressable key={sh.id} onPress={() => navigation.navigate('Shop', {shop: sh})} style={s.shop}>
                    <View style={s.shopTop}>
                      <Avatar name={sh.name} size={52} />
                      <View style={s.distChip}>
                        <Icon name="location" size={12} color={colors.primaryDark} />
                        <Text style={s.distText}>{distanceText(sh.distance_km)}</Text>
                      </View>
                    </View>
                    <Text style={s.shopName} numberOfLines={1}>{sh.name}</Text>
                    <Text style={s.shopAddr} numberOfLines={1}>{sh.address || 'Tap to send your list'}</Text>
                    {sh.accepting && sh.accepting !== 'open' ? <ShopStatusTag state={sh.accepting} /> : null}
                    <Pressable style={s.shopBtn} onPress={() => navigation.navigate('NewOrder', {shop: sh})}><Text style={s.shopBtnText}>Send a list</Text><Icon name="document-text" size={15} color={colors.primaryDark} /></Pressable>
                  </Pressable>
                ))}
              </ScrollView>
            </>
          ) : null}

          {recent.length > 0 ? (
            <>
              <SectionHeader title="Order again" action={total > 2 ? 'See all' : undefined}
                onAction={() => navigation.navigate('Orders')} />
              <View style={{gap: 10}}>
                {recent.map(o => (
                  <Pressable key={o.id} style={s.recent} onPress={() => navigation.navigate('Orders')}>
                    <Avatar name={o.shop_name} size={42} />
                    <View style={{flex: 1}}>
                      <Text style={s.recentName} numberOfLines={1}>{o.shop_name}</Text>
                      <Text style={s.muted} numberOfLines={1}>{o.items.map(i => i.name).join(', ')}</Text>
                      <Text style={s.when}>{when(o.created_at)}</Text>
                    </View>
                    <View style={{alignItems: 'flex-end', gap: 8}}>
                      <StatusPill status={o.status} small />
                      <Pressable style={s.reorder} onPress={() => reorder(o)} hitSlop={6}>
                        <Icon name="create" size={14} color={colors.primaryDark} />
                        <Text style={s.reorderText}>Reorder</Text>
                      </Pressable>
                    </View>
                  </Pressable>
                ))}
              </View>
            </>
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
  heroAvatar: {borderWidth: 2.5, borderColor: '#ffffff55'},
  body: {padding: 16, marginTop: -28},
  errorCard: {backgroundColor: '#fee2e2', marginBottom: 12},
  muted: {color: colors.muted, fontSize: 12},
  focus: {backgroundColor: '#fff', borderRadius: 20, padding: 16, gap: 14, ...shadowLift},
  focusReady: {borderWidth: 2, borderColor: colors.primary},
  focusHead: {flexDirection: 'row', alignItems: 'center', gap: 12},
  focusTitle: {fontSize: 14, fontWeight: '800', color: colors.text},
  readyNote: {flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: colors.primarySoft, borderRadius: 12, padding: 10},
  readyText: {flex: 1, color: colors.primaryDark, fontWeight: '700', fontSize: 12},
  startRow: {flexDirection: 'row', alignItems: 'center', gap: 14},
  startIcon: {width: 54, height: 54, borderRadius: 16, backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center'},
  stats: {
    flexDirection: 'row', backgroundColor: '#fff', borderRadius: 18, paddingVertical: 14, marginTop: 14,
    shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 6, shadowOffset: {width: 0, height: 2}, elevation: 2,
  },
  stat: {flex: 1, alignItems: 'center'},
  statNum: {fontSize: 18, fontWeight: '800', color: colors.text},
  statLabel: {fontSize: 12, color: colors.muted, fontWeight: '600', marginTop: 1},
  divider: {width: 1, backgroundColor: colors.border, marginVertical: 4},
  locCard: {marginTop: 14, backgroundColor: '#fffbeb'},
  shop: {width: 200, backgroundColor: '#fff', borderRadius: 20, padding: 14, gap: 4,
    shadowColor: '#000', shadowOpacity: 0.07, shadowRadius: 8, shadowOffset: {width: 0, height: 3}, elevation: 3},
  shopTop: {flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8},
  distChip: {flexDirection: 'row', alignItems: 'center', gap: 3, backgroundColor: colors.primarySoft, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 20},
  distText: {fontSize: 11, fontWeight: '800', color: colors.primaryDark},
  shopName: {fontSize: 13, fontWeight: '800', color: colors.text},
  shopAddr: {fontSize: 12, color: colors.muted},
  shopBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, marginTop: 10,
    backgroundColor: colors.primarySoft, borderRadius: 12, paddingVertical: 10,
  },
  shopBtnText: {color: colors.primaryDark, fontWeight: '800', fontSize: 12},
  recent: {
    flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: '#fff', borderRadius: 18, padding: 12,
    shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 6, shadowOffset: {width: 0, height: 2}, elevation: 2,
  },
  recentName: {fontSize: 13, fontWeight: '800', color: colors.text},
  when: {fontSize: 11, color: '#9ca3af', marginTop: 2},
  reorder: {flexDirection: 'row', alignItems: 'center', gap: 4, borderWidth: 1.5, borderColor: colors.primary, borderRadius: 20, paddingHorizontal: 10, paddingVertical: 4},
  reorderText: {color: colors.primaryDark, fontWeight: '800', fontSize: 12},
});
