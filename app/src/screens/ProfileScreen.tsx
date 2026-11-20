import React, {useCallback, useState} from 'react';
import {KeyboardAvoidingView, Linking, Modal, Pressable, ScrollView, StyleSheet, Text, View} from 'react-native';
import {useFocusEffect} from '@react-navigation/native';
import {Button, Chip, Field} from '../components';
import Icon, {IconName} from '../Icon';
import {Avatar, FocusStatusBar, Hero} from '../ui';
import {useAuth} from '../AuthContext';
import {useDialog} from '../dialog';
import {api, getBaseUrl, Order, Shop, User} from '../api';
import LocationPicker from '../LocationPicker';
import {colors, shadowLift} from '../theme';

type Edit = {
  name: string; shopName: string; address: string; phone: string; open: string; close: string;
  pickup: string; category: string; area: string;
};

const money = (n: number) => '₹' + (Math.round(n * 100) / 100);
const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`;
const day = (iso: string) =>
  new Date(iso.replace(' ', 'T') + 'Z').toLocaleDateString([], {day: 'numeric', month: 'short', year: 'numeric'});

/** One tappable line in the settings list. */
function Row({icon, label, value, onPress, danger, last}: {
  icon: IconName; label: string; value?: string; onPress: () => void; danger?: boolean; last?: boolean;
}) {
  return (
    <Pressable onPress={onPress} style={({pressed}) => [s.row, !last && s.rowLine, pressed && {backgroundColor: '#f9fafb'}]}>
      <View style={[s.rowIcon, danger && {backgroundColor: '#fee2e2'}]}>
        <Icon name={icon} size={19} color={danger ? colors.danger : colors.primaryDark} />
      </View>
      <View style={{flex: 1}}>
        <Text style={[s.rowLabel, danger && {color: colors.danger}]}>{label}</Text>
        {value ? <Text style={s.rowValue} numberOfLines={1}>{value}</Text> : null}
      </View>
      {!danger ? <Icon name="chevron-forward" size={18} color="#9ca3af" /> : null}
    </Pressable>
  );
}

export default function ProfileScreen({navigation}: any) {
  const {user, shop, account, refreshAccount, setShop, setUser, logout} = useAuth();
  const dialog = useDialog();
  const [edit, setEdit] = useState<Edit | null>(null);
  const [busy, setBusy] = useState(false);
  const [orders, setOrders] = useState<Order[]>([]);
  const [categories, setCategories] = useState<string[]>([]);

  useFocusEffect(useCallback(() => {
    refreshAccount().catch(() => {});
    api<Order[]>(user?.role === 'owner' ? '/owner/orders' : '/orders/mine').then(setOrders).catch(() => {});
    api<string[]>('/public/categories').then(setCategories).catch(() => {});
  }, [user?.role, refreshAccount]));

  if (!user) return null;
  const isOwner = user.role === 'owner';

  const fail = (e: any) => dialog.alert({title: 'Could not save', message: e.message, kind: 'error'});

  const save = async () => {
    if (!edit) return;
    setBusy(true);
    try {
      if (edit.name.trim() !== user.name) setUser((await api<{user: User}>('/auth/me', 'PUT', {name: edit.name})).user);
      if (isOwner && shop) setShop(await api<Shop>('/shop', 'PUT', {
        name: edit.shopName, address: edit.address, phone: edit.phone, open_time: edit.open, close_time: edit.close,
        pickup_info: edit.pickup, category: edit.category, area: edit.area,
      }));
      setEdit(null);
    } catch (e) { fail(e); }
    finally { setBusy(false); }
  };

  const saveLocation = async (p: {lat: number; lng: number; address?: string}) => {
    try {
      setShop(await api<Shop>('/shop', 'PUT', {
        lat: p.lat, lng: p.lng, ...(p.address && !shop?.address ? {address: p.address} : {}),
      }));
    } catch (e) { fail(e); }
  };

  const confirmLogout = async () => {
    const ok = await dialog.confirm({
      kind: 'danger', title: 'Log out?', message: 'You will need a new OTP to log in again.',
      confirmText: 'Log out', cancelText: 'Stay',
    });
    if (ok) logout();
  };

  const openPage = async (path: '/terms' | '/privacy') => {
    try { await Linking.openURL((__DEV__ ? getBaseUrl() : 'https://dailylist.yashrajsinhjadeja.com') + path); }
    catch { dialog.alert({title: 'Could not open the page', message: 'Please try again later.', kind: 'error'}); }
  };

  const done = orders.filter(o => o.status === 'Picked up').length;
  const active = orders.filter(o => ['New', 'Ready'].includes(o.status)).length;
  const sub = account.subscription;
  const plan = sub?.plan;
  const usage = account.usage;
  const team = account.team;
  const canManage = !isOwner || team?.is_primary !== false;
  const shopsLimit = plan?.max_shops || 0;

  return (
    <View style={s.screen}>
      <FocusStatusBar style="light-content" />
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{paddingBottom: 100}}>
      <Hero style={{paddingBottom: 66}}>
        <View style={s.who}>
          <Avatar name={user.name} size={84} round style={s.bigAvatar} />
          <Text style={s.name} numberOfLines={1}>{user.name}</Text>
          <View style={s.phoneRow}>
            <Icon name="phone-portrait" size={14} color="#BDE6E1" />
            <Text style={s.phone}>{user.phone}</Text>
          </View>
          <View style={s.roleChip}>
            <Icon name={isOwner ? 'storefront' : 'basket'} size={14} color="#fff" />
            <Text style={s.roleText}>{isOwner ? 'Shop owner' : 'Customer'}</Text>
          </View>
        </View>
      </Hero>
      <View style={s.body}>
        {/* plan */}
        {sub && plan ? (
          <View style={s.plan}>
            <View style={s.planHead}>
              <View style={s.planBadge}><Icon name="ribbon" size={20} color={colors.primaryDark} filled /></View>
              <View style={{flex: 1}}>
                <Text style={s.planLabel}>YOUR PLAN</Text>
                <Text style={s.planName}>{plan.name}</Text>
              </View>
              <Text style={s.planPrice}>{plan.price > 0 ? money(plan.price) : 'Free'}</Text>
            </View>
            <Text style={s.planWhen}>
              {sub.expires_at ? `Valid until ${day(sub.expires_at)} · ${plural(sub.days_left ?? 0, 'day')} left` : 'No expiry'}
            </Text>

            {!isOwner && usage ? (
              <View style={{gap: 10, marginTop: 14}}>
                <View style={s.usageRow}>
                  <Text style={s.usageLabel}>Shops used</Text>
                  <Text style={s.usageValue}>{usage.shops_used}{shopsLimit > 0 ? ` of ${shopsLimit}` : ' · no limit'}</Text>
                </View>
                {shopsLimit > 0 ? (
                  <View style={s.bar}><View style={[s.fill, {width: `${Math.min(100, (usage.shops_used / shopsLimit) * 100)}%`}]} /></View>
                ) : null}
                <View style={s.usageRow}>
                  <Text style={s.usageLabel}>Orders per shop</Text>
                  <Text style={s.usageValue}>{plan.max_orders_per_shop > 0 ? `up to ${plan.max_orders_per_shop}` : 'no limit'}</Text>
                </View>
              </View>
            ) : null}

            {isOwner && team ? (
              <View style={{gap: 10, marginTop: 14}}>
                <View style={s.usageRow}>
                  <Text style={s.usageLabel}>Phones on this shop account</Text>
                  <Text style={s.usageValue}>{team.count} of {team.max}</Text>
                </View>
                <View style={s.bar}><View style={[s.fill, {width: `${team.max ? Math.min(100, (team.count / team.max) * 100) : 0}%`}]} /></View>
              </View>
            ) : null}

            <View style={s.planActions}>
              {isOwner ? <Button small kind="outline" icon="people" title="Team" style={{flex: 1}} onPress={() => navigation.navigate('Team')} /> : null}
              {canManage ? <Button small icon="ribbon" title={isOwner ? 'Change plan' : 'Upgrade'} style={{flex: 1}} onPress={() => navigation.navigate('Plans')} /> : null}
            </View>
          </View>
        ) : null}

        {/* settings list */}
        <View style={s.group}>
          <Row icon="create" label="Edit profile" value={isOwner && shop ? `${user.name} · ${shop.name}` : user.name}
            onPress={() => setEdit({
              name: user.name, shopName: shop?.name || '', address: shop?.address || '', phone: shop?.phone || '',
              open: shop?.open_time || '', close: shop?.close_time || '', pickup: shop?.pickup_info || '',
              category: shop?.category || '', area: shop?.area || '',
            })} />
          <Row icon="document-text" label="Terms & Conditions" onPress={() => openPage('/terms')} />
          <Row icon="checkmark-circle" label="Privacy Policy" onPress={() => openPage('/privacy')} last />
        </View>

        <View style={s.group}>
          <Row icon="log-out" label="Log out" danger onPress={confirmLogout} last />
        </View>
        <Text style={s.version}>DailyList</Text>
      </View>
      </ScrollView>

      <Modal visible={!!edit} transparent animationType="slide" onRequestClose={() => setEdit(null)}>
        <KeyboardAvoidingView style={s.backdrop} behavior="padding">
          <View style={s.sheet}>
            <Text style={s.sheetTitle}>Edit profile</Text>
            <Field required label="Your name" value={edit?.name}
              onChangeText={t => setEdit(e => e && {...e, name: t})} />
            {isOwner && shop ? (
              <ScrollView style={{maxHeight: 360}} keyboardShouldPersistTaps="handled" contentContainerStyle={{gap: 4}}>
                <Field required label="Shop name" value={edit?.shopName} onChangeText={t => setEdit(e => e && {...e, shopName: t})} />
                <Field label="Shop phone" keyboardType="phone-pad" value={edit?.phone} onChangeText={t => setEdit(e => e && {...e, phone: t})} />
                <Field label="Address" value={edit?.address} onChangeText={t => setEdit(e => e && {...e, address: t})} />
                <Field label="Area or pincode" value={edit?.area} onChangeText={t => setEdit(e => e && {...e, area: t})} />
                <View style={{flexDirection: 'row', gap: 10}}>
                  <View style={{flex: 1}}><Field label="Opens (24h)" placeholder="09:00" value={edit?.open} onChangeText={t => setEdit(e => e && {...e, open: t})} /></View>
                  <View style={{flex: 1}}><Field label="Closes (24h)" placeholder="21:00" value={edit?.close} onChangeText={t => setEdit(e => e && {...e, close: t})} /></View>
                </View>
                <Field label="Pickup instructions" placeholder="e.g. Come to the side counter" value={edit?.pickup} onChangeText={t => setEdit(e => e && {...e, pickup: t})} />
                <Text style={s.chipLabel}>Category</Text>
                <View style={s.chips}>
                  {categories.map(c => <Chip key={c} label={c} active={edit?.category === c} onPress={() => setEdit(e => e && {...e, category: e.category === c ? '' : c})} />)}
                </View>
                <View style={{marginTop: 8}}>
                  <LocationPicker shopName={shop.name} saved={shop.lat != null} initial={shop.lat != null && shop.lng != null ? {lat: shop.lat, lng: shop.lng} : null} label="Update location on map" onPick={saveLocation} />
                </View>
              </ScrollView>
            ) : null}
            <View style={{flexDirection: 'row', gap: 10}}>
              <Button kind="outline" title="Cancel" style={{flex: 1}} onPress={() => setEdit(null)} />
              <Button title="Save" style={{flex: 1}} loading={busy} disabled={!edit?.name.trim() || (isOwner && !edit?.shopName.trim())} onPress={save} />
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const s = StyleSheet.create({
  screen: {flex: 1, backgroundColor: colors.bg},
  who: {alignItems: 'center'},
  bigAvatar: {borderWidth: 3, borderColor: '#ffffff66'},
  name: {color: '#fff', fontSize: 18, fontWeight: '800', marginTop: 12},
  phoneRow: {flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4},
  phone: {color: '#DDF2EF', fontSize: 13, fontWeight: '600'},
  roleChip: {flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#ffffff26', paddingHorizontal: 12, paddingVertical: 5, borderRadius: 20, marginTop: 10},
  roleText: {color: '#fff', fontWeight: '700', fontSize: 12},
  body: {padding: 16, gap: 14, marginTop: -42},

  plan: {backgroundColor: '#fff', borderRadius: 22, padding: 16, ...shadowLift},
  planHead: {flexDirection: 'row', alignItems: 'center', gap: 12},
  planBadge: {width: 44, height: 44, borderRadius: 14, backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center'},
  planLabel: {fontSize: 11, fontWeight: '800', color: colors.muted, letterSpacing: 0.6},
  planName: {fontSize: 15, fontWeight: '800', color: colors.text},
  planPrice: {fontSize: 14, fontWeight: '800', color: colors.primaryDark},
  planWhen: {color: colors.muted, fontSize: 12, marginTop: 10},
  usageRow: {flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center'},
  usageLabel: {color: colors.muted, fontSize: 13},
  usageValue: {color: colors.text, fontWeight: '800', fontSize: 13},
  bar: {height: 8, backgroundColor: '#e5e7eb', borderRadius: 4, overflow: 'hidden'},
  fill: {height: 8, backgroundColor: colors.primary, borderRadius: 4},
  planActions: {flexDirection: 'row', gap: 10, marginTop: 16},

  stats: {
    flexDirection: 'row', backgroundColor: '#fff', borderRadius: 18, paddingVertical: 14,
    shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 6, shadowOffset: {width: 0, height: 2}, elevation: 2,
  },
  stat: {flex: 1, alignItems: 'center'},
  statNum: {fontSize: 18, fontWeight: '800', color: colors.text},
  statLabel: {fontSize: 12, color: colors.muted, fontWeight: '600', marginTop: 1},
  divider: {width: 1, backgroundColor: colors.border, marginVertical: 4},

  group: {
    backgroundColor: '#fff', borderRadius: 20, overflow: 'hidden',
    shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 6, shadowOffset: {width: 0, height: 2}, elevation: 2,
  },
  row: {flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 14},
  rowLine: {borderBottomWidth: StyleSheet.hairlineWidth, borderColor: colors.border},
  rowIcon: {width: 36, height: 36, borderRadius: 11, backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center'},
  rowLabel: {fontSize: 13, fontWeight: '700', color: colors.text},
  rowValue: {fontSize: 12, color: colors.muted, marginTop: 1},
  shopHead: {flexDirection: 'row', alignItems: 'center', gap: 12, padding: 16, paddingBottom: 10},
  shopName: {fontSize: 14, fontWeight: '800', color: colors.text},
  shopAddr: {fontSize: 12, color: colors.muted, marginTop: 1},
  locPad: {paddingHorizontal: 16, paddingBottom: 16},
  chipLabel: {fontSize: 12, fontWeight: '700', color: colors.muted, marginTop: 8},
  chips: {flexDirection: 'row', flexWrap: 'wrap', gap: 6},
  version: {textAlign: 'center', color: '#9ca3af', fontSize: 12, marginTop: 4},

  backdrop: {flex: 1, backgroundColor: 'rgba(17,24,39,0.55)', justifyContent: 'flex-end'},
  sheet: {backgroundColor: colors.bg, padding: 20, borderTopLeftRadius: 24, borderTopRightRadius: 24},
  sheetTitle: {fontSize: 16, fontWeight: '800', color: colors.text, marginBottom: 16},
});
