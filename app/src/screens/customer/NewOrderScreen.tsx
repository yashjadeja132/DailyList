import React, {useEffect, useRef, useState} from 'react';
import {
  KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {SafeAreaView} from 'react-native-safe-area-context';
import {Button} from '../../components';
import Icon from '../../Icon';
import {FocusStatusBar, ShopStatusTag} from '../../ui';
import {api, Order} from '../../api';
import {useDialog} from '../../dialog';
import {colors} from '../../theme';

type Row = {name: string; qty: string};

export default function NewOrderScreen({route, navigation}: any) {
  const {shop} = route.params;
  const dialog = useDialog();
  const draftKey = `draft:${shop.id}`;
  // "Reorder" opens this screen with the items of an earlier order already in the list
  const [rows, setRows] = useState<Row[]>(route.params?.prefill || []);
  const [name, setName] = useState('');
  const [qty, setQty] = useState('');
  const [note, setNote] = useState('');
  const [showNote, setShowNote] = useState(false);
  const [recent, setRecent] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [ready, setReady] = useState(false);
  // the same id on every retry, so a double tap or a bad connection cannot create two orders
  const requestId = useRef(`${Date.now()}-${Math.random().toString(36).slice(2, 10)}`).current;
  const closed = shop.accepting === 'closed';
  const nameRef = useRef<React.ComponentRef<typeof TextInput>>(null);

  // bring back a half-written list (when the app was closed or the connection dropped)
  useEffect(() => {
    (async () => {
      try {
        if (!route.params?.prefill) {
          const d = JSON.parse((await AsyncStorage.getItem(draftKey)) || 'null');
          if (d) { setRows(d.rows || []); setNote(d.note || ''); setShowNote(!!d.note); }
        }
      } catch {}
      setReady(true);
    })();
    // items this customer ordered before, as quick suggestions
    api<Order[]>('/orders/mine').then(os => {
      const seen = new Set<string>();
      os.forEach(o => o.items.forEach(i => seen.add(i.name)));
      setRecent([...seen].slice(0, 10));
    }).catch(() => {});
  }, [draftKey, route.params?.prefill]);
  useEffect(() => {
    if (!ready) return;
    AsyncStorage.setItem(draftKey, JSON.stringify({rows, note})).catch(() => {});
  }, [rows, note, ready, draftKey]);

  const addRow = (n = name, q = qty) => {
    if (!n.trim()) return;
    setRows(r => [...r, {name: n.trim(), qty: q.trim() || '1'}]);
    setName('');
    setQty('');
    nameRef.current?.focus();
  };

  const send = async () => {
    // include whatever is still typed in the boxes
    const lines = name.trim() ? [...rows, {name: name.trim(), qty: qty.trim() || '1'}] : rows;
    if (!lines.length) return;
    const ok = await dialog.confirm({
      title: 'Send order?',
      message: `${lines.length} item${lines.length > 1 ? 's' : ''} will be sent to ${shop.name}.`,
      confirmText: 'Send order',
      cancelText: 'Not yet',
    });
    if (!ok) return;
    setBusy(true);
    try {
      await api('/orders', 'POST', {shop_id: shop.id, note, lines, request_id: requestId});
      AsyncStorage.removeItem(draftKey).catch(() => {});
      await dialog.alert({
        title: 'Order sent!',
        message: `${shop.name} will check your list. You will see which items are ready or not available.`,
        kind: 'success',
        confirmText: 'View my orders',
      });
      navigation.navigate('CustomerTabs', {screen: 'Orders'});
    } catch (e: any) {
      if (e.status === 403 && /plan/i.test(e.message)) {
        const go = await dialog.confirm({
          kind: 'info', title: 'Plan limit reached', message: e.message,
          confirmText: 'View plans', cancelText: 'Not now',
        });
        if (go) navigation.navigate('Plans');
      } else {
        dialog.alert({title: e.status === 400 && /closed/i.test(e.message) ? 'Shop is closed' : 'Could not send order', message: e.message, kind: 'error'});
      }
    } finally {
      setBusy(false);
    }
  };

  const count = rows.length + (name.trim() ? 1 : 0);

  return (
    <SafeAreaView style={s.screen} edges={['top', 'bottom']}>
      <FocusStatusBar style="dark-content" />
      <KeyboardAvoidingView style={{flex: 1}} behavior="padding">
        <ScrollView contentContainerStyle={s.body} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          <View style={s.top}>
            <Pressable onPress={() => navigation.goBack()} hitSlop={10} style={s.back}>
              <Icon name="chevron-forward" size={22} color={colors.text} style={{transform: [{rotate: '180deg'}]}} />
            </Pressable>
            <View style={{flex: 1}}>
              <Text style={s.title} numberOfLines={1}>Your list</Text>
              <Text style={s.sub} numberOfLines={1}>for {shop.name}</Text>
            </View>
          </View>
          {shop.accepting && shop.accepting !== 'open' ? <ShopStatusTag state={shop.accepting} /> : null}

          {/* add an item */}
          <View style={s.addCard}>
            <TextInput ref={nameRef} style={s.input} placeholder="What do you need? (e.g. Milk)"
              placeholderTextColor="#9ca3af" value={name} onChangeText={setName} returnKeyType="next" />
            <View style={s.addRow}>
              <TextInput style={[s.input, {flex: 1}]} placeholder="Quantity (e.g. 2 L)" placeholderTextColor="#9ca3af"
                value={qty} onChangeText={setQty} returnKeyType="done" onSubmitEditing={() => addRow()} />
              <Pressable onPress={() => addRow()} disabled={!name.trim()} style={[s.addBtn, !name.trim() && {opacity: 0.4}]}>
                <Icon name="checkmark" size={22} color="#fff" />
              </Pressable>
            </View>
            {recent.length > 0 && !name ? (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{gap: 8}} keyboardShouldPersistTaps="handled">
                {recent.map(r => (
                  <Pressable key={r} style={s.chip} onPress={() => setName(r)}>
                    <Text style={s.chipText}>{r}</Text>
                  </Pressable>
                ))}
              </ScrollView>
            ) : null}
          </View>

          {/* the list so far */}
          {rows.length > 0 ? (
            <View style={s.list}>
              {rows.map((r, i) => (
                <View key={i} style={[s.line, i > 0 && s.lineBorder]}>
                  <Text style={s.lineName}>{r.name}</Text>
                  <View style={s.qtyChip}><Text style={s.lineQty}>{r.qty}</Text></View>
                  <Pressable hitSlop={10} onPress={() => setRows(x => x.filter((_, j) => j !== i))}>
                    <Icon name="close-circle" size={22} color="#d1d5db" filled />
                  </Pressable>
                </View>
              ))}
            </View>
          ) : <Text style={s.empty}>Add the items one by one. They appear here.</Text>}

          {showNote ? (
            <TextInput style={[s.input, s.noteInput]} multiline placeholder="Note for the shop (e.g. I will come at 6 pm)"
              placeholderTextColor="#9ca3af" value={note} onChangeText={setNote} />
          ) : (
            <Pressable onPress={() => setShowNote(true)}><Text style={s.noteLink}>+ Add a note for the shop</Text></Pressable>
          )}

          {closed ? <Text style={s.closed}>This shop is not taking new orders right now. Please choose another shop or try later.</Text> : null}
          <Button title={count ? `Send order (${count} item${count > 1 ? 's' : ''})` : 'Send order'} onPress={send} loading={busy}
            disabled={closed || count === 0} />
          <Text style={s.pay}>No online payment. You pay at the shop when you collect.</Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  screen: {flex: 1, backgroundColor: colors.bg},
  body: {padding: 16, gap: 14, paddingBottom: 40},
  top: {flexDirection: 'row', alignItems: 'center', gap: 12},
  back: {width: 40, height: 40, borderRadius: 20, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center'},
  title: {fontSize: 18, fontWeight: '800', color: colors.text},
  sub: {color: colors.muted, fontSize: 13, marginTop: 1},
  addCard: {backgroundColor: '#fff', borderRadius: 20, padding: 12, gap: 10},
  addRow: {flexDirection: 'row', gap: 10, alignItems: 'center'},
  input: {
    borderWidth: 1.5, borderColor: colors.border, borderRadius: 12, paddingHorizontal: 14,
    paddingVertical: 11, fontSize: 13, color: colors.text, backgroundColor: '#fff',
  },
  addBtn: {width: 48, height: 48, borderRadius: 14, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center'},
  chip: {backgroundColor: colors.primarySoft, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16},
  chipText: {color: colors.primaryDark, fontWeight: '700', fontSize: 12},
  list: {backgroundColor: '#fff', borderRadius: 20, paddingHorizontal: 14},
  line: {flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 13},
  lineBorder: {borderTopWidth: StyleSheet.hairlineWidth, borderColor: colors.border},
  lineName: {flex: 1, fontSize: 13, color: colors.text, fontWeight: '600'},
  qtyChip: {backgroundColor: colors.primarySoft, borderRadius: 10, paddingHorizontal: 10, paddingVertical: 3},
  lineQty: {color: colors.primaryDark, fontWeight: '800', fontSize: 12},
  empty: {color: colors.muted, textAlign: 'center', paddingVertical: 8},
  noteInput: {minHeight: 70, textAlignVertical: 'top'},
  noteLink: {color: colors.primary, fontWeight: '700', fontSize: 13},
  closed: {color: colors.danger, fontWeight: '700', fontSize: 12, textAlign: 'center'},
  pay: {color: colors.muted, fontSize: 12, textAlign: 'center'},
});
