import React, {useCallback, useState} from 'react';
import {ActivityIndicator, FlatList, Pressable, RefreshControl, StyleSheet, Text, View} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import {useFocusEffect} from '@react-navigation/native';
import {Empty, when} from '../components';
import Icon from '../Icon';
import {FocusStatusBar} from '../ui';
import {api, AppNotification} from '../api';
import {colors} from '../theme';

export default function NotificationsScreen({navigation}: any) {
  const [items, setItems] = useState<AppNotification[] | null>(null);
  const [error, setError] = useState('');
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const r = await api<{unread: number; items: AppNotification[]}>('/notifications');
      setItems(r.items); setError('');
      if (r.unread) api('/notifications/read', 'POST', {}).catch(() => {});
    } catch (e: any) { setError(e.message); }
  }, []);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  return (
    <SafeAreaView style={s.screen} edges={['top', 'bottom']}>
      <FocusStatusBar style="dark-content" />
      <FlatList
        data={items || []}
        keyExtractor={n => String(n.id)}
        contentContainerStyle={{padding: 16, paddingTop: 0, gap: 8, paddingBottom: 30}}
        refreshControl={<RefreshControl refreshing={refreshing} colors={[colors.primary]}
          onRefresh={async () => { setRefreshing(true); await load(); setRefreshing(false); }} />}
        ListHeaderComponent={
          <View style={s.head}>
            <Pressable onPress={() => navigation.goBack()} hitSlop={10} style={s.back}><Icon name="close" size={22} color={colors.text} /></Pressable>
            <Text style={s.title}>Notifications</Text>
          </View>}
        ListEmptyComponent={!items && !error ? <ActivityIndicator style={{marginTop: 50}} color={colors.primary} size="large" />
          : error ? <Empty icon="cloud-offline" title="Can't load" text={error} />
          : <Empty icon="notifications" title="Nothing new" text="Updates about your orders will show up here." />}
        renderItem={({item}) => (
          <View style={[s.card, !item.read && s.unread]}>
            {!item.read ? <View style={s.dot} /> : null}
            <View style={{flex: 1}}>
              <Text style={s.cardTitle}>{item.title}</Text>
              {item.body ? <Text style={s.cardBody}>{item.body}</Text> : null}
              <Text style={s.when}>{when(item.created_at)}</Text>
            </View>
          </View>
        )}
      />
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  screen: {flex: 1, backgroundColor: colors.bg},
  head: {flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 16},
  back: {width: 38, height: 38, borderRadius: 19, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center'},
  title: {fontSize: 18, fontWeight: '800', color: colors.text},
  card: {flexDirection: 'row', gap: 10, backgroundColor: '#fff', borderRadius: 16, padding: 14},
  unread: {backgroundColor: '#F3F8F7'},
  dot: {width: 9, height: 9, borderRadius: 5, backgroundColor: colors.primary, marginTop: 6},
  cardTitle: {fontWeight: '800', color: colors.text, fontSize: 13},
  cardBody: {color: colors.muted, marginTop: 2},
  when: {color: '#9ca3af', fontSize: 11, marginTop: 4},
});
