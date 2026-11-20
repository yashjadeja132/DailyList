import React, {useState} from 'react';
import {ActivityIndicator, Modal, Pressable, StyleSheet, Text, TextInput, View} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import Icon from './Icon';
import {api} from './api';
import {Coords} from './location';
import {colors} from './theme';

type Place = {name: string; lat: number; lng: number};

/**
 * When the phone's location is off or denied: type an area name or pincode, pick the right place,
 * and the shop list uses that place instead.
 */
export default function AreaSearch({visible, onClose, onPick}: {
  visible: boolean; onClose: () => void; onPick: (c: Coords, label: string) => void;
}) {
  const [q, setQ] = useState('');
  const [busy, setBusy] = useState(false);
  const [results, setResults] = useState<Place[] | null>(null);
  const [error, setError] = useState('');

  const search = async () => {
    if (q.trim().length < 3) { setError('Type at least 3 letters or a pincode'); return; }
    setBusy(true); setError('');
    try { setResults(await api<Place[]>(`/geocode?q=${encodeURIComponent(q.trim())}`)); }
    catch (e: any) { setError(e.message); setResults(null); }
    finally { setBusy(false); }
  };

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <SafeAreaView style={s.screen} edges={['top', 'bottom']}>
        <View style={s.head}>
          <Pressable onPress={onClose} hitSlop={10} style={s.close}><Icon name="close" size={22} color={colors.text} /></Pressable>
          <Text style={s.title}>Set your area</Text>
        </View>
        <View style={s.body}>
          <View style={s.box}>
            <Icon name="search" size={20} color="#9ca3af" />
            <TextInput style={s.input} value={q} onChangeText={setQ} placeholder="Area name or pincode" placeholderTextColor="#9ca3af"
              returnKeyType="search" onSubmitEditing={search} autoFocus />
          </View>
          {error ? <Text style={s.error}>{error}</Text> : null}
          {busy ? <ActivityIndicator style={{marginTop: 24}} color={colors.primary} /> : null}
          {results && !busy && results.length === 0 ? <Text style={s.empty}>No place found. Try a nearby area or the pincode.</Text> : null}
          {(results || []).map((p, i) => (
            <Pressable key={i} style={s.row} onPress={() => { onPick({lat: p.lat, lng: p.lng}, p.name.split(',')[0]); onClose(); }}>
              <Icon name="location" size={20} color={colors.primaryDark} />
              <Text style={s.rowText} numberOfLines={2}>{p.name}</Text>
            </Pressable>
          ))}
        </View>
      </SafeAreaView>
    </Modal>
  );
}

const s = StyleSheet.create({
  screen: {flex: 1, backgroundColor: colors.bg},
  head: {flexDirection: 'row', alignItems: 'center', gap: 12, padding: 16},
  close: {width: 38, height: 38, borderRadius: 19, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center'},
  title: {fontSize: 16, fontWeight: '800', color: colors.text},
  body: {paddingHorizontal: 16, gap: 10},
  box: {flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: '#fff', borderRadius: 14, paddingHorizontal: 14, borderWidth: 1.5, borderColor: colors.border},
  input: {flex: 1, fontSize: 13, color: colors.text, paddingVertical: 12},
  error: {color: colors.danger, fontWeight: '600'},
  empty: {color: colors.muted, marginTop: 16},
  row: {flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: '#fff', borderRadius: 14, padding: 14},
  rowText: {flex: 1, color: colors.text, fontSize: 13, fontWeight: '600'},
});
