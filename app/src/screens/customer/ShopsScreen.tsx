import React, {useCallback, useState} from 'react';
import {
  ActivityIndicator, Pressable, RefreshControl, SectionList, StyleSheet, Text, TextInput, View,
} from 'react-native';
import {useFocusEffect} from '@react-navigation/native';
import {Empty, IconText, Page, PageHeader} from '../../components';
import Icon from '../../Icon';
import {Avatar, distanceText, ShopStatusTag} from '../../ui';
import {api, Shop} from '../../api';
import AreaSearch from '../../AreaSearch';
import {Coords, getBestLocation, getManualLabel, setManualLocation} from '../../location';
import {colors} from '../../theme';

export default function ShopsScreen({navigation}: any) {
  const [shops, setShops] = useState<Shop[] | null>(null);
  const [nearbyKm, setNearbyKm] = useState(5);
  const [locOff, setLocOff] = useState('');
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [areaOpen, setAreaOpen] = useState(false);

  const load = useCallback(async () => {
    let coords: Coords | null = null;
    try {
      coords = await getBestLocation();
      setLocOff('');
    } catch (e: any) {
      setLocOff(e.message);
    }
    try {
      const q = coords ? `?lat=${coords.lat}&lng=${coords.lng}` : '';
      const r = await api<{nearby_km: number; shops: Shop[]}>('/shops' + q);
      setShops(r.shops);
      setNearbyKm(r.nearby_km);
      setError('');
    } catch (e: any) {
      setError(e.message);
    }
  }, []);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  const q = search.trim().toLowerCase();
  const matches = (shops || []).filter(s =>
    !q || s.name.toLowerCase().includes(q) || s.address.toLowerCase().includes(q));
  const near = matches.filter(s => s.distance_km != null && s.distance_km <= nearbyKm).slice(0, 6);
  const others = matches.filter(s => !near.includes(s));
  const sections = [
    ...(near.length ? [{title: 'Near you', hint: `within ${nearbyKm} km`, data: near}] : []),
    ...(others.length ? [{title: near.length ? 'More shops' : 'All shops', hint: '', data: others}] : []),
  ];
  const count = (shops || []).length;

  return (
    <Page>
      <SectionList
          ListHeaderComponent={<View style={{marginHorizontal: -16}}>
          <PageHeader title="Find a shop" subtitle={shops ? `${count} shop${count === 1 ? '' : 's'} available` : 'Choose where to send your list'} />
      <View style={s.searchWrap}>
        <View style={s.searchBox}>
          <Icon name="search" size={20} color="#9ca3af" />
          <TextInput style={s.search} placeholder="Search by shop name or area" placeholderTextColor="#9ca3af"
            value={search} onChangeText={setSearch} />
          {search ? (
            <Pressable onPress={() => setSearch('')} hitSlop={10}><Icon name="close-circle" size={20} color="#9ca3af" filled /></Pressable>
          ) : null}
        </View>
        {locOff ? (
          <Pressable style={s.locBanner} onPress={() => setAreaOpen(true)}>
            <IconText icon="location" color="#92400e" textStyle={s.locText}>
              Location is off. Tap to choose your area or pincode.
            </IconText>
          </Pressable>
        ) : null}
      </View>
        </View>}
          sections={shops || error ? sections : []}
          keyExtractor={sh => String(sh.id)}
          contentContainerStyle={{padding: 16, paddingTop: 4, paddingBottom: 100}}
          stickySectionHeadersEnabled={false}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} colors={[colors.primary]}
            onRefresh={async () => { setRefreshing(true); await load(); setRefreshing(false); }} />}
          ListEmptyComponent={!shops && !error ? (
            <View style={{alignItems: 'center', marginTop: 60}}>
              <ActivityIndicator color={colors.primary} size="large" />
              <Text style={{color: colors.muted, marginTop: 12}}>Finding shops near you…</Text>
            </View>
          ) : error ? <Empty icon="cloud-offline" title="Can't load shops" text={error} /> :
            <Empty icon="storefront" title="No shops found for you" text="There are no shops available near you right now." />}
          renderSectionHeader={({section}) => (
            <View style={s.sectionRow}>
              <Text style={s.section}>{section.title}</Text>
              {(section as any).hint ? <Text style={s.hint}>{(section as any).hint}</Text> : null}
            </View>
          )}
          ItemSeparatorComponent={() => <View style={{height: 10}} />}
          renderItem={({item}) => (
            <Pressable style={({pressed}) => [s.card, pressed && {opacity: 0.85}]}
              onPress={() => navigation.navigate('Shop', {shop: item})}>
              <Avatar name={item.name} size={54} />
              <View style={{flex: 1}}>
                <Text style={s.name} numberOfLines={1}>{item.name}</Text>
                <View style={s.addrRow}>
                  <Icon name="location" size={14} color={colors.muted} />
                  <Text style={s.addr} numberOfLines={1}>{item.address || 'No address added'}</Text>
                </View>
                <ShopStatusTag state={item.accepting} />
              </View>
              <View style={s.right}>
                {item.distance_km != null ? (
                  <View style={s.dist}><Text style={s.distText}>{distanceText(item.distance_km)}</Text></View>
                ) : null}
                <Icon name="chevron-forward" size={20} color="#9ca3af" />
              </View>
            </Pressable>
          )}
        />
      <AreaSearch visible={areaOpen} onClose={() => setAreaOpen(false)}
        onPick={(c, label) => { setManualLocation(c, label); load(); }} />
    </Page>
  );
}

const s = StyleSheet.create({
  searchWrap: {paddingHorizontal: 16, paddingBottom: 6},
  searchBox: {
    flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: '#fff', borderRadius: 16,
    paddingHorizontal: 14, borderWidth: 1, borderColor: colors.border,
  },
  search: {flex: 1, paddingVertical: 13, fontSize: 13, color: colors.text},
  locBanner: {marginTop: 10, backgroundColor: '#fffbeb', borderRadius: 12, padding: 12},
  locText: {fontSize: 12, fontWeight: '600'},
  sectionRow: {flexDirection: 'row', alignItems: 'baseline', gap: 8, marginTop: 14, marginBottom: 10},
  section: {fontSize: 14, fontWeight: '800', color: colors.text},
  hint: {fontSize: 12, color: colors.muted, fontWeight: '600'},
  card: {
    flexDirection: 'row', alignItems: 'center', gap: 14, backgroundColor: '#fff', borderRadius: 20, padding: 14,
    shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 8, shadowOffset: {width: 0, height: 3}, elevation: 2,
  },
  name: {fontSize: 13, fontWeight: '800', color: colors.text},
  addrRow: {flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4},
  addr: {flex: 1, fontSize: 12, color: colors.muted},
  right: {alignItems: 'flex-end', gap: 6},
  dist: {backgroundColor: colors.primarySoft, paddingHorizontal: 9, paddingVertical: 4, borderRadius: 20},
  distText: {fontSize: 11, fontWeight: '800', color: colors.primaryDark},
});
