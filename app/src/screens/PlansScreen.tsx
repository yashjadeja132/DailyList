import React, {useCallback, useEffect, useState} from 'react';
import {ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import {Button, Card, IconText} from '../components';
import Icon from '../Icon';
import {FocusStatusBar} from '../ui';
import {api, Plan} from '../api';
import {useAuth} from '../AuthContext';
import {useDialog} from '../dialog';
import {colors} from '../theme';

const money = (n: number) => '₹' + (Math.round(n * 100) / 100);
const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`;
const when = (iso: string) =>
  new Date(iso.replace(' ', 'T') + 'Z').toLocaleDateString([], {day: 'numeric', month: 'short', year: 'numeric'});

/** What a plan includes, as short lines. */
function features(p: Plan): string[] {
  if (p.audience === 'owner') {
    return [
      `Up to ${plural(p.max_users, 'phone')} can use one shop account`,
      'Receive and manage all customer orders',
      p.duration_days > 0 ? `Valid for ${plural(p.duration_days, 'day')}` : 'No expiry',
    ];
  }
  return [
    p.max_orders_per_shop > 0 ? `${plural(p.max_orders_per_shop, 'order')} per shop` : 'Unlimited orders per shop',
    p.max_shops > 0 ? `Order from ${plural(p.max_shops, 'shop')}` : 'Order from any number of shops',
    p.duration_days > 0 ? `Valid for ${plural(p.duration_days, 'day')}` : 'Free, limits renew every 30 days',
  ];
}

/**
 * Plans for the current role. For a new shop owner (`required`) this is the first screen
 * after sign-up: a plan must be bought before the shop can be used.
 */
export default function PlansScreen({navigation, route}: any) {
  const required: boolean = !!route?.params?.required;
  const {user, account, purchasePlan, logout} = useAuth();
  const dialog = useDialog();
  const [plans, setPlans] = useState<Plan[] | null>(null);
  const [testMode, setTestMode] = useState(false);
  const [error, setError] = useState('');
  const [busyId, setBusyId] = useState<number | null>(null);

  const isOwner = user?.role === 'owner';
  const canBuy = !isOwner || account.team?.is_primary !== false; // team members cannot buy
  const current = account.subscription;

  const load = useCallback(async () => {
    try {
      const [p, s] = await Promise.all([api<Plan[]>('/plans'), api<{payment_mode?: string}>('/subscription')]);
      setPlans(p);
      setTestMode(s.payment_mode === 'mock');
      setError('');
    } catch (e: any) { setError(e.message); }
  }, []);
  useEffect(() => { load(); }, [load]);

  const choose = async (p: Plan) => {
    const renewing = current?.plan.id === p.id && p.duration_days > 0;
    const ok = await dialog.confirm({
      kind: 'confirm',
      title: `${renewing ? 'Renew' : 'Choose'} ${p.name}?`,
      message: p.price > 0
        ? `${money(p.price)}${p.duration_days > 0 ? ` for ${plural(p.duration_days, 'day')}` : ''}.${testMode ? '\n\nTest mode: no real money is charged.' : ''}`
        : 'This plan is free.',
      confirmText: p.price > 0 ? (testMode ? 'Continue (test)' : `Pay ${money(p.price)}`) : 'Choose plan',
      cancelText: 'Not now',
    });
    if (!ok) return;
    setBusyId(p.id);
    try {
      const pay = await purchasePlan(p.id);
      if (pay) { navigation.navigate('Payment', pay); return; } // paid online, the plan starts after the payment
      await dialog.alert({
        kind: 'success', title: 'Plan activated',
        message: `${p.name} is now active${isOwner ? ' for your shop' : ''}.`,
        confirmText: required ? 'Start' : 'Done',
      });
      if (!required && navigation.canGoBack()) navigation.goBack();
    } catch (e: any) {
      dialog.alert({title: 'Could not change plan', message: e.message, kind: 'error'});
    } finally {
      setBusyId(null);
    }
  };

  const title = required ? 'Choose a plan' : isOwner ? 'Shop plans' : 'Plans';
  const subtitle = required
    ? 'Pick a plan to start receiving orders.'
    : isOwner ? 'Change how many phones can use your shop.' : 'Pick the plan that fits how you shop.';

  return (
    <SafeAreaView style={s.screen} edges={['top', 'bottom']}>
      <FocusStatusBar style="dark-content" />

      <ScrollView contentContainerStyle={{padding: 16, paddingTop: 0, gap: 14, paddingBottom: 30}}>
        <View style={{marginHorizontal: -16}}>
      <View style={s.header}>
        {!required ? (
          <Pressable onPress={() => navigation.goBack()} hitSlop={10} style={s.back}>
            <Icon name="close" size={26} color={colors.text} />
          </Pressable>
        ) : null}
        <View style={{flex: 1}}>
          <Text style={s.title}>{title}</Text>
          <Text style={s.sub}>{subtitle}</Text>
        </View>
        {required ? (
          <Pressable onPress={logout} hitSlop={10}><Text style={s.logout}>Log out</Text></Pressable>
        ) : null}
      </View>
        </View>

          {error ? (
            <Card style={{backgroundColor: '#fee2e2'}}>
              <IconText icon="cloud-offline" color={colors.danger}>{error}</IconText>
            </Card>
          ) : null}

          {!canBuy ? (
            <Card style={{backgroundColor: '#fffbeb'}}>
              <IconText icon="alert-circle" color="#92400e" textStyle={{fontWeight: '600'}}>
                Only the main shop owner can choose a plan. Please ask them to do it.
              </IconText>
            </Card>
          ) : null}

          {(plans || []).map(p => {
            const isCurrent = current?.plan.id === p.id;
            const renewable = isCurrent && p.duration_days > 0;
            return (
              <Card key={p.id} style={[s.plan, isCurrent && s.planOn]}>
                <View style={s.rowBetween}>
                  <Text style={s.planName}>{p.name}</Text>
                  {isCurrent ? <View style={s.current}><Text style={s.currentText}>Current plan</Text></View> : null}
                </View>
                <View style={s.priceRow}>
                  <Text style={s.price}>{p.price > 0 ? money(p.price) : 'Free'}</Text>
                  {p.price > 0 && p.duration_days > 0 ? <Text style={s.per}> / {plural(p.duration_days, 'day')}</Text> : null}
                </View>
                {p.description ? <Text style={s.desc}>{p.description}</Text> : null}
                <View style={{gap: 8, marginVertical: 12}}>
                  {features(p).map(f => (
                    <IconText key={f} icon="checkmark-circle" color={colors.primaryDark} size={18} textStyle={s.feature}>{f}</IconText>
                  ))}
                </View>
                {isCurrent && current?.expires_at ? (
                  <Text style={s.expiry}>Active until {when(current.expires_at)} ({plural(current.days_left ?? 0, 'day')} left)</Text>
                ) : null}
                {canBuy ? (
                  <Button
                    kind={isCurrent && !renewable ? 'soft' : 'primary'}
                    title={isCurrent ? (renewable ? 'Renew plan' : 'Your current plan') : 'Choose this plan'}
                    disabled={isCurrent && !renewable}
                    loading={busyId === p.id}
                    onPress={() => choose(p)} />
                ) : null}
              </Card>
            );
          })}

          {plans && plans.length === 0 ? (
            <Card><Text style={{color: colors.muted}}>No plans are available right now. Please try again later.</Text></Card>
          ) : null}
        </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  screen: {flex: 1, backgroundColor: colors.bg},
  header: {flexDirection: 'row', alignItems: 'center', gap: 10, padding: 16, paddingBottom: 12},
  back: {width: 36, height: 36, borderRadius: 18, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center'},
  title: {fontSize: 20, fontWeight: '800', color: colors.text},
  sub: {color: colors.muted, marginTop: 2},
  logout: {color: colors.danger, fontWeight: '700'},
  plan: {gap: 2, borderWidth: 2, borderColor: 'transparent'},
  planOn: {borderColor: colors.primary},
  rowBetween: {flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between'},
  planName: {fontSize: 16, fontWeight: '800', color: colors.text},
  current: {backgroundColor: colors.primarySoft, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20},
  currentText: {color: colors.primaryDark, fontWeight: '700', fontSize: 12},
  priceRow: {flexDirection: 'row', alignItems: 'flex-end', marginTop: 4},
  price: {fontSize: 24, fontWeight: '800', color: colors.primaryDark},
  per: {color: colors.muted, fontSize: 13, marginBottom: 5, fontWeight: '600'},
  desc: {color: colors.muted, marginTop: 4},
  feature: {color: colors.text, fontSize: 13},
  expiry: {color: colors.muted, fontSize: 12, marginBottom: 10},
});
