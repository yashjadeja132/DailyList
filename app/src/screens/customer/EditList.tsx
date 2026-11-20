import React, {useState} from 'react';
import {KeyboardAvoidingView, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View} from 'react-native';
import {Button} from '../../components';
import Icon from '../../Icon';
import {api, Order} from '../../api';
import {useDialog} from '../../dialog';
import {colors} from '../../theme';

/** Change the list of an order the shop has not finished checking: remove lines or add new ones. */
export default function EditList({order, onClose, onSaved}: {order: Order | null; onClose: () => void; onSaved: () => void}) {
  const dialog = useDialog();
  const [removed, setRemoved] = useState<number[]>([]);
  const [added, setAdded] = useState<{name: string; qty: string}[]>([]);
  const [name, setName] = useState('');
  const [qty, setQty] = useState('');
  const [busy, setBusy] = useState(false);

  const reset = () => { setRemoved([]); setAdded([]); setName(''); setQty(''); };
  const add = () => {
    if (!name.trim()) return;
    setAdded(a => [...a, {name: name.trim(), qty: qty.trim() || '1'}]); setName(''); setQty('');
  };
  const save = async () => {
    if (!order) return;
    const pending = name.trim() ? [...added, {name: name.trim(), qty: qty.trim() || '1'}] : added;
    setBusy(true);
    try {
      await api(`/orders/${order.id}/items`, 'PUT', {add: pending, remove: removed});
      reset(); onClose(); onSaved();
    } catch (e: any) {
      dialog.alert({kind: 'error', title: 'Could not change the list', message: e.message});
    } finally { setBusy(false); }
  };

  return (
    <Modal visible={!!order} transparent animationType="slide" onRequestClose={() => { reset(); onClose(); }}>
      <KeyboardAvoidingView style={s.backdrop} behavior="padding">
        <View style={s.sheet}>
          <Text style={s.title}>Change your list</Text>
          <Text style={s.sub}>The shop will be told about the change.</Text>
          <ScrollView style={{maxHeight: 280}} keyboardShouldPersistTaps="handled">
            {(order?.items || []).filter(i => !removed.includes(i.id)).map(i => (
              <View key={i.id} style={s.line}>
                <Text style={s.name}>{i.name}</Text><Text style={s.qty}>{i.qty}</Text>
                <Pressable hitSlop={10} onPress={() => setRemoved(r => [...r, i.id])}><Icon name="close-circle" size={22} color={colors.danger} filled /></Pressable>
              </View>
            ))}
            {added.map((a, k) => (
              <View key={'a' + k} style={s.line}>
                <Text style={s.name}>{a.name}</Text><Text style={s.qty}>{a.qty}</Text>
                <Pressable hitSlop={10} onPress={() => setAdded(x => x.filter((_, j) => j !== k))}><Icon name="close-circle" size={22} color={colors.danger} filled /></Pressable>
              </View>
            ))}
          </ScrollView>
          <View style={{flexDirection: 'row', gap: 8}}>
            <TextInput style={[s.input, {flex: 2}]} value={name} onChangeText={setName} placeholder="New item" placeholderTextColor="#9ca3af" />
            <TextInput style={[s.input, {flex: 1}]} value={qty} onChangeText={setQty} placeholder="Qty" placeholderTextColor="#9ca3af" onSubmitEditing={add} />
          </View>
          <Button small kind="soft" title="+ Add item" disabled={!name.trim()} onPress={add} />
          <View style={{flexDirection: 'row', gap: 10}}>
            <Button kind="outline" title="Close" style={{flex: 1}} onPress={() => { reset(); onClose(); }} />
            <Button title="Save" style={{flex: 1}} loading={busy} disabled={!removed.length && !added.length && !name.trim()} onPress={save} />
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const s = StyleSheet.create({
  backdrop: {flex: 1, backgroundColor: 'rgba(17,24,39,0.55)', justifyContent: 'flex-end'},
  sheet: {backgroundColor: colors.bg, padding: 20, borderTopLeftRadius: 24, borderTopRightRadius: 24, gap: 12},
  title: {fontSize: 16, fontWeight: '800', color: colors.text},
  sub: {color: colors.muted},
  line: {flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: '#fff', borderRadius: 12, padding: 12, marginBottom: 6},
  name: {flex: 1, fontWeight: '700', color: colors.text, fontSize: 13},
  qty: {color: colors.muted, fontWeight: '700'},
  input: {borderWidth: 1.5, borderColor: colors.border, borderRadius: 12, backgroundColor: '#fff', paddingHorizontal: 12, paddingVertical: 9, fontSize: 13, color: colors.text},
});
