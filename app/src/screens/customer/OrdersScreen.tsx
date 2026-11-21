import React, {useCallback, useState} from 'react';
import {ActivityIndicator, FlatList, Pressable, RefreshControl, StyleSheet, Text, View} from 'react-native';
import {useFocusEffect} from '@react-navigation/native';
import {Button, Empty, Page, PageHeader} from '../../components';
import {api, isActiveOrder, Order} from '../../api';
import {useDialog} from '../../dialog';
import Icon from '../../Icon';
import OrderCard, {Stars} from '../OrderCard';
import EditList from './EditList';
import ReportProblem from '../ReportProblem';
import {colors} from '../../theme';

export default function OrdersScreen({navigation}: any) {
  const clearance = useTabClearance();
  const dialog = useDialog();
  const [orders, setOrders] = useState<Order[] | null>(null);
  const [error, setError] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [tab, setTab] = useState<'active' | 'past'>('active');
  const [editing, setEditing] = useState<Order | null>(null);
  const [reporting, setReporting] = useState<number | null>(null);

  const load = useCallback(async () => {
    try { setOrders(await api<Order[]>('/orders/mine')); setError(''); }
    catch (e: any) { setError(e.message); }
  }, []);

  // refresh now and every 5 seconds while this tab is open
  useFocusEffect(useCallback(() => {
    load();
    const t = setInterval(load, 5000);
    return () => clearInterval(t);
  }, [load]));

  const cancel = async (o: Order) => {
    const ok = await dialog.confirm({
      kind: 'danger', title: ['Preparing', 'Ready'].includes(o.status) ? 'Ask the shop to cancel?' : 'Cancel this order?',
      message: ['Preparing', 'Ready'].includes(o.status)
        ? `${o.shop_name} has already started preparing. They need to agree to cancel.`
        : `Your list for ${o.shop_name} will be cancelled.`,
      confirmText: ['Preparing', 'Ready'].includes(o.status) ? 'Ask to cancel' : 'Cancel order', cancelText: 'Keep it',
    });
    if (!ok) return;
    try { await api(`/orders/${o.id}/cancel`, 'POST', {}); load(); }
    catch (e: any) { dialog.alert({title: 'Could not cancel', message: e.message, kind: 'error'}); }
  };

  const isActive = (o: Order) => isActiveOrder(o.status);
  const rate = async (o: Order, rating: number) => {
    try { await api(`/orders/${o.id}/rate`, 'POST', {rating}); load(); }
    catch (e: any) { dialog.alert({title: 'Could not save', message: e.message, kind: 'error'}); }
  };
  const respond = async (o: Order, decisions: Record<number, boolean>) => {
    try { await api(`/orders/${o.id}/respond`, 'POST', {decisions}); load(); }
    catch (e: any) { dialog.alert({title: 'Could not send your answer', message: e.message, kind: 'error'}); }
  };
  const list = (orders || []).filter(o => (tab === 'active' ? isActive(o) : !isActive(o)));
  const activeCount = (orders || []).filter(isActive).length;
  const pastCount = (orders || []).length - activeCount;

  const Seg = ({id, label, count}: {id: 'active' | 'past'; label: string; count: number}) => (
    <Pressable style={[s.seg, tab === id && s.segOn]} onPress={() => setTab(id)}>
      <Text style={[s.segText, tab === id && s.segTextOn]}>{label}</Text>
      <View style={[s.count, tab === id && s.countOn]}>
        <Text style={[s.countText, tab === id && {color: colors.primaryDark}]}>{count}</Text>
      </View>
    </Pressable>
  );

  return (
    <Page>

      <FlatList
          ListHeaderComponent={<View style={{marginHorizontal: -16}}>
          <PageHeader title="My orders" subtitle="Updates automatically" />
      <View style={s.segRow}>
        <Seg id="active" label="Active" count={activeCount} />
        <Seg id="past" label="Past" count={pastCount} />
      </View>

        </View>}
          data={orders || error ? list : []}
          keyExtractor={o => String(o.id)}
          contentContainerStyle={{padding: 16, paddingTop: 6, gap: 14, paddingBottom: clearance}}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} colors={[colors.primary]}
            onRefresh={async () => { setRefreshing(true); await load(); setRefreshing(false); }} />}
          ListEmptyComponent={!orders && !error ? <ActivityIndicator style={{marginTop: 60}} color={colors.primary} size="large" /> : error ? <Empty icon="cloud-offline" title="Can't load orders" text={error} /> : (
            <View style={s.empty}>
              <View style={s.emptyIcon}><Icon name={tab === 'active' ? 'receipt' : 'time'} size={34} color={colors.primaryDark} /></View>
              <Text style={s.emptyTitle}>{tab === 'active' ? 'No active orders' : 'No past orders yet'}</Text>
              <Text style={s.emptyText}>
                {tab === 'active'
                  ? 'Send your list to a nearby shop and track it here.'
                  : 'Completed, cancelled and expired orders will show up here.'}
              </Text>
              {tab === 'active' ? (
                <Button title="Find a shop" icon="storefront" style={{marginTop: 18, alignSelf: 'stretch'}}
                  onPress={() => navigation.navigate('Shops')} />
              ) : null}
            </View>
          )}
          renderItem={({item}) => (
            <OrderCard o={item} onRespond={d => respond(item, d)}>
              {['New', 'Accepted'].includes(item.status) && (
                <Button small kind="soft" title="Change my list" onPress={() => setEditing(item)} />
              )}
              {(['New', 'Accepted', 'Awaiting you'].includes(item.status) ||
                (['Preparing', 'Ready'].includes(item.status) && !item.cancel_requested)) && (
                <Button small kind="outline" style={{borderColor: colors.danger}}
                  title={['Preparing', 'Ready'].includes(item.status) ? 'Ask the shop to cancel' : 'Cancel order'}
                  onPress={() => cancel(item)} />
              )}
              {item.status === 'Picked up' && (
                <View style={s.rate}>
                  <Text style={s.rateText}>{item.rating ? 'Your rating' : 'How was this order?'}</Text>
                  <Stars value={item.rating || 0} onPick={item.rating ? undefined : n => rate(item, n)} />
                </View>
              )}
              <Pressable onPress={() => setReporting(item.id)} hitSlop={8}>
                <Text style={s.report}>Report a problem</Text>
              </Pressable>
            </OrderCard>
          )}
        />
      <EditList order={editing} onClose={() => setEditing(null)} onSaved={load} />
      <ReportProblem orderId={reporting} about="shop" onClose={() => setReporting(null)} />
    </Page>
  );
}

import {useTabClearance} from '../../ui';
const s = StyleSheet.create({
  rate: {flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between'},
  rateText: {color: colors.muted, fontWeight: '700'},
  report: {color: colors.muted, fontSize: 12, fontWeight: '600', textAlign: 'center', textDecorationLine: 'underline'},
  segRow: {flexDirection: 'row', backgroundColor: '#e5e7eb', borderRadius: 14, padding: 4, marginHorizontal: 16, marginBottom: 10},
  seg: {flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 10, borderRadius: 11},
  segOn: {backgroundColor: '#fff', shadowColor: '#000', shadowOpacity: 0.08, shadowRadius: 4, shadowOffset: {width: 0, height: 1}, elevation: 2},
  segText: {fontWeight: '700', color: colors.muted, fontSize: 13},
  segTextOn: {color: colors.text},
  count: {minWidth: 22, paddingHorizontal: 6, paddingVertical: 1, borderRadius: 11, backgroundColor: '#d1d5db', alignItems: 'center'},
  countOn: {backgroundColor: colors.primarySoft},
  countText: {fontSize: 12, fontWeight: '800', color: colors.muted},
  empty: {alignItems: 'center', marginTop: 40, paddingHorizontal: 20},
  emptyIcon: {width: 76, height: 76, borderRadius: 24, backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center'},
  emptyTitle: {fontSize: 14, fontWeight: '800', color: colors.text, marginTop: 16},
  emptyText: {color: colors.muted, textAlign: 'center', marginTop: 6, lineHeight: 20},
});
