import React, {useCallback, useState} from 'react';
import {
  ActivityIndicator, FlatList, KeyboardAvoidingView, Modal, Pressable, RefreshControl, ScrollView, StyleSheet,
  Text, TextInput, View,
} from 'react-native';
import {useFocusEffect} from '@react-navigation/native';
import {Button, Chip, Empty, Page, PageHeader} from '../../components';
import Icon from '../../Icon';
import {api, ItemState, Order} from '../../api';
import {useAuth} from '../../AuthContext';
import {useDialog} from '../../dialog';
import OrderCard from '../OrderCard';
import ReportProblem from '../ReportProblem';
import {colors} from '../../theme';

const FILTERS = ['New', 'In progress', 'Ready', 'Done'] as const;
type Filter = typeof FILTERS[number];
const GROUP: Record<Filter, string[]> = {
  // "Accepted" means the shop has started checking the list, so it stays under New until the check is finished
  New: ['New', 'Accepted'],
  'In progress': ['Awaiting you', 'Preparing'],
  Ready: ['Ready'],
  Done: ['Picked up', 'Cancelled', 'Declined', 'Expired'],
};
const REASONS = ['Out of stock', 'Shop is closing', 'Too busy right now', 'Cannot prepare this order'];

export default function OwnerOrdersScreen({route}: any) {
  const {shop} = useAuth();
  const dialog = useDialog();
  const [orders, setOrders] = useState<Order[] | null>(null);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState<Filter>('New');
  const [refreshing, setRefreshing] = useState(false);
  const [declining, setDeclining] = useState<Order | null>(null);
  const [reason, setReason] = useState('');
  const [eta, setEta] = useState<Record<number, number>>({});
  const [reporting, setReporting] = useState<number | null>(null);
  const [search, setSearch] = useState('');

  const load = useCallback(async () => {
    try { setOrders(await api<Order[]>('/owner/orders')); setError(''); }
    catch (e: any) { setError(e.message); }
  }, []);

  // coming from the home screen's "New orders" card: open on the New tab
  const wanted = route?.params?.filter as Filter | undefined;
  useFocusEffect(useCallback(() => { if (wanted) setFilter(wanted); }, [wanted, route?.params?.at]));

  useFocusEffect(useCallback(() => {
    load();
    const t = setInterval(load, 5000);
    return () => clearInterval(t);
  }, [load]));

  const fail = (e: any) => dialog.alert({title: 'Something went wrong', message: e.message, kind: 'error'});
  const replace = (updated: Order) => setOrders(os => (os || []).map(o => (o.id === updated.id ? updated : o)));
  const post = (id: number, path: string, body: object = {}) =>
    api<Order>(`/orders/${id}/${path}`, 'POST', body).then(replace).catch(fail);

  const mark = (o: Order, lineId: number, state: ItemState, qty?: string) =>
    api<Order>(`/orders/${o.id}/items/${lineId}`, 'PATCH', {state, avail_qty: qty}).then(replace).catch(fail);

  const finishReview = async (o: Order) => {
    const partly = o.items.filter(i => i.state === 'partial').length;
    const none = o.items.filter(i => i.state === 'unavailable').length;
    const ok = await dialog.confirm({
      kind: 'confirm',
      title: partly ? 'Ask the customer?' : 'Start preparing?',
      message: partly
        ? `${o.customer_name} will be asked to accept the smaller quantity for ${partly} item${partly > 1 ? 's' : ''}. You prepare the order after they answer.`
        : `${o.customer_name} will see which items you have${none ? ` (${none} not available)` : ''}, and that you are preparing the order.`,
      confirmText: partly ? 'Send to customer' : 'Start preparing', cancelText: 'Not yet',
    });
    if (ok) post(o.id, 'review-done', eta[o.id] ? {eta_minutes: eta[o.id]} : {});
  };

  const setStatus = (o: Order, status: string) =>
    api<Order>(`/orders/${o.id}/status`, 'PATCH', {status}).then(replace).catch(fail);

  const markReady = async (o: Order) => {
    const ok = await dialog.confirm({
      kind: 'confirm', title: 'Order is ready?',
      message: `${o.customer_name} will be told the order is ready to collect.`,
      confirmText: 'Yes, ready', cancelText: 'Not yet',
    });
    if (ok) setStatus(o, 'Ready');
  };

  const handedOver = async (o: Order) => {
    const ok = await dialog.confirm({
      kind: 'confirm', title: 'Mark as completed?',
      message: 'Only do this after the customer has taken the goods and paid you at the shop.',
      confirmText: 'Completed', cancelText: 'Not yet',
    });
    if (ok) setStatus(o, 'Picked up');
  };

  const sendDecline = async () => {
    if (!declining) return;
    const o = declining;
    setDeclining(null);
    await post(o.id, 'decline', {reason});
    setReason('');
  };

  const q = search.trim().toLowerCase();
  const shown = (orders || []).filter(o => GROUP[filter].includes(o.status) &&
    (!q || o.customer_name.toLowerCase().includes(q) || o.phone.includes(q) || String(o.id) === q || (o.code || '').toLowerCase() === q));
  const count = (f: Filter) => (orders || []).filter(o => GROUP[f].includes(o.status)).length;

  return (
    <Page>
      <FlatList
          ListHeaderComponent={<View style={{marginHorizontal: -16}}>
          <PageHeader title={shop?.name || 'Orders'} subtitle={`${count('New')} new · ${count('Ready')} ready for pickup`} />
      <View style={{flexGrow: 0}}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{flexGrow: 0}}
          contentContainerStyle={{paddingHorizontal: 16, paddingVertical: 10}}>
          {FILTERS.map(f => (
            <Chip key={f} active={f === filter} onPress={() => setFilter(f)}
              label={f === 'Done' ? 'Done' : `${f} (${count(f)})`} />
          ))}
        </ScrollView>
        {filter === 'Done' ? (
          <TextInput style={s.search} value={search} onChangeText={setSearch} placeholder="Search by name, phone or order code"
            placeholderTextColor="#9ca3af" />
        ) : null}
      </View>

        </View>}
          data={orders || error ? shown : []}
          keyExtractor={o => String(o.id)}
          contentContainerStyle={{padding: 16, paddingTop: 6, gap: 12, paddingBottom: 100}}
          refreshControl={<RefreshControl refreshing={refreshing} colors={[colors.primary]}
            onRefresh={async () => { setRefreshing(true); await load(); setRefreshing(false); }} />}
          ListEmptyComponent={!orders && !error ? <ActivityIndicator style={{marginTop: 60}} color={colors.primary} size="large" /> : error ? <Empty icon="cloud-offline" title="Can't load orders" text={error} /> :
            <Empty icon="mail-open" title="Nothing here" text="New customer orders will appear here." />}
          renderItem={({item}) => {
            const pending = item.items.some(i => i.state === 'pending');
            return (
              <OrderCard o={item} forOwner onMark={(lineId, state, qty) => mark(item, lineId, state, qty)}>
                {item.status === 'New' && (
                  <View style={s.row}>
                    <Button small title="Accept order" style={{flex: 1}} onPress={() => post(item.id, 'accept')} />
                    <Button small kind="outline" title="Decline" style={{borderColor: colors.danger}}
                      onPress={() => { setReason(''); setDeclining(item); }} />
                  </View>
                )}
                {['New', 'Accepted'].includes(item.status) && !pending && (
                  <View style={s.etaRow}>
                    <Text style={s.etaLabel}>Ready in about</Text>
                    {[10, 20, 30, 60].map(m => (
                      <Chip key={m} label={`${m} min`} active={eta[item.id] === m} onPress={() => setEta(e => ({...e, [item.id]: e[item.id] === m ? 0 : m}))} />
                    ))}
                  </View>
                )}
                {['New', 'Accepted'].includes(item.status) && (
                  <View style={s.row}>
                    <Button small style={{flex: 1}} title={pending ? 'Mark every item first' : 'Done checking'}
                      disabled={pending} onPress={() => finishReview(item)} />
                    {item.status === 'Accepted' && (
                      <Button small kind="outline" title="Decline" style={{borderColor: colors.danger}}
                        onPress={() => { setReason(''); setDeclining(item); }} />
                    )}
                  </View>
                )}
                {item.status === 'Awaiting you' && (
                  <View style={s.waiting}>
                    <Icon name="time" size={18} color="#92400e" />
                    <Text style={s.waitingText}>Waiting for {item.customer_name} to answer about the smaller quantities.</Text>
                  </View>
                )}
                {item.cancel_requested ? (
                  <View style={s.row}>
                    <Button small style={{flex: 1}} title="Agree to cancel" onPress={() => post(item.id, 'cancel-response', {approve: true})} />
                    <Button small kind="outline" style={{flex: 1}} title="Keep the order" onPress={() => post(item.id, 'cancel-response', {approve: false})} />
                  </View>
                ) : null}
                {item.status === 'Preparing' && <Button small title="Order is ready" onPress={() => markReady(item)} />}
                {item.status === 'Ready' && <Button small kind="soft" title="Handed over and paid" onPress={() => handedOver(item)} />}
                {item.status === 'Ready' && (
                  <Pressable onPress={() => post(item.id, 'no-show')} hitSlop={8}>
                    <Text style={s.link}>Customer did not come</Text>
                  </Pressable>
                )}
                <Pressable onPress={() => setReporting(item.id)} hitSlop={8}><Text style={s.link}>Report a problem</Text></Pressable>
                {item.status === 'Declined' && item.decline_reason ? (
                  <Text style={s.reason}>Reason given: {item.decline_reason}</Text>
                ) : null}
              </OrderCard>
            );
          }}
        />

      <ReportProblem orderId={reporting} about="customer" onClose={() => setReporting(null)} />
      <Modal visible={!!declining} transparent animationType="slide" onRequestClose={() => setDeclining(null)}>
        <KeyboardAvoidingView style={s.backdrop} behavior="padding">
          <View style={s.sheet}>
            <Text style={s.sheetTitle}>Decline this order?</Text>
            <Text style={s.sheetSub}>{declining?.customer_name} will be told. A reason helps them choose another shop (optional).</Text>
            <View style={s.reasons}>
              {REASONS.map(r => <Chip key={r} label={r} active={reason === r} onPress={() => setReason(reason === r ? '' : r)} />)}
            </View>
            <TextInput style={s.input} value={reason} onChangeText={setReason} placeholder="Or write a reason"
              placeholderTextColor="#9ca3af" maxLength={200} />
            <View style={s.row}>
              <Button kind="outline" title="Keep order" style={{flex: 1}} onPress={() => setDeclining(null)} />
              <Button title="Decline" style={{flex: 1, backgroundColor: colors.danger}} onPress={sendDecline} />
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </Page>
  );
}

const s = StyleSheet.create({
  search: {marginHorizontal: 16, marginBottom: 8, borderWidth: 1.5, borderColor: colors.border, borderRadius: 12, backgroundColor: '#fff', paddingHorizontal: 12, paddingVertical: 9, fontSize: 13, color: colors.text},
  etaRow: {flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 6},
  etaLabel: {color: colors.muted, fontWeight: '700', fontSize: 12, marginRight: 2},
  link: {color: colors.muted, fontSize: 12, fontWeight: '600', textAlign: 'center', textDecorationLine: 'underline'},
  row: {flexDirection: 'row', gap: 10},
  waiting: {flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#fffbeb', borderRadius: 12, padding: 12},
  waitingText: {flex: 1, color: '#92400e', fontWeight: '700', fontSize: 12},
  reason: {color: colors.muted, fontSize: 12},
  backdrop: {flex: 1, backgroundColor: 'rgba(17,24,39,0.55)', justifyContent: 'flex-end'},
  sheet: {backgroundColor: colors.bg, padding: 20, borderTopLeftRadius: 24, borderTopRightRadius: 24, gap: 12},
  sheetTitle: {fontSize: 16, fontWeight: '800', color: colors.text},
  sheetSub: {color: colors.muted},
  reasons: {flexDirection: 'row', flexWrap: 'wrap', gap: 6},
  input: {
    borderWidth: 1.5, borderColor: colors.border, borderRadius: 12, backgroundColor: '#fff',
    paddingHorizontal: 12, paddingVertical: 10, fontSize: 13, color: colors.text,
  },
});
