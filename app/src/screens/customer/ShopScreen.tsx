import React from 'react';
import {Linking, Pressable, ScrollView, StyleSheet, Text, View} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import {Button} from '../../components';
import Icon, {IconName} from '../../Icon';
import {Avatar, distanceText, FocusStatusBar, ShopStatusTag} from '../../ui';
import {Shop} from '../../api';
import {colors} from '../../theme';

/** One detail row: icon, label + value, and an optional tap action. */
function Info({icon, label, value, action, onAction}: {
  icon: IconName; label: string; value: string; action?: string; onAction?: () => void;
}) {
  return (
    <View style={s.row}>
      <View style={s.rowIcon}><Icon name={icon} size={18} color={colors.primaryDark} /></View>
      <View style={{flex: 1}}>
        <Text style={s.label}>{label}</Text>
        <Text style={s.value}>{value}</Text>
      </View>
      {action ? <Pressable onPress={onAction} hitSlop={8}><Text style={s.action}>{action}</Text></Pressable> : null}
    </View>
  );
}

export default function ShopScreen({route, navigation}: any) {
  const shop: Shop = route.params.shop;
  const closed = shop.accepting === 'closed';
  const hours = shop.open_time && shop.close_time ? `${shop.open_time} to ${shop.close_time}` : '';
  const directions = () => {
    const q = shop.lat != null && shop.lng != null ? `${shop.lat},${shop.lng}` : encodeURIComponent(shop.address || shop.name);
    Linking.openURL(`geo:0,0?q=${q}(${encodeURIComponent(shop.name)})`).catch(() => {});
  };

  return (
    <SafeAreaView style={s.screen} edges={['top', 'bottom']}>
      <FocusStatusBar style="dark-content" />
      <ScrollView contentContainerStyle={s.body} showsVerticalScrollIndicator={false}>
        <Pressable onPress={() => navigation.goBack()} hitSlop={10} style={s.back}>
          <Icon name="chevron-forward" size={22} color={colors.text} style={{transform: [{rotate: '180deg'}]}} />
        </Pressable>

        <View style={s.top}>
          <Avatar name={shop.name} size={72} />
          <Text style={s.name}>{shop.name}</Text>
          {shop.category ? <Text style={s.category}>{shop.category}</Text> : null}
          <View style={{alignItems: 'center'}}><ShopStatusTag state={shop.accepting} /></View>
        </View>

        <View style={s.card}>
          <Info icon="location" label="Address" value={shop.address || 'No address added'}
            action="Directions" onAction={directions} />
          {shop.distance_km != null ? <Info icon="walk" label="Distance" value={distanceText(shop.distance_km)} /> : null}
          {hours ? <Info icon="time" label="Opening hours" value={hours} /> : null}
          {shop.phone ? <Info icon="call" label="Phone" value={shop.phone} action="Call"
            onAction={() => Linking.openURL('tel:' + shop.phone)} /> : null}
          {shop.pickup_info ? <Info icon="bag-check" label="Pickup" value={shop.pickup_info} /> : null}
        </View>

        <Text style={s.note}>Send your list, the shop checks what it has, and you pay at the shop when you collect. The final bill is confirmed there.</Text>

        {closed ? (
          <Text style={s.closed}>
            {shop.hours_closed ? 'The shop is closed right now.' : 'The shop is not taking new orders right now.'} Please try later.
          </Text>
        ) : null}
        <Button title="Send a list to this shop" icon="document-text" disabled={closed}
          onPress={() => navigation.navigate('NewOrder', {shop})} />
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  screen: {flex: 1, backgroundColor: colors.bg},
  body: {padding: 16, gap: 16, paddingBottom: 40},
  back: {width: 40, height: 40, borderRadius: 20, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center'},
  top: {alignItems: 'center', gap: 4},
  name: {fontSize: 18, fontWeight: '800', color: colors.text, marginTop: 8, textAlign: 'center'},
  category: {color: colors.muted, fontWeight: '600'},
  card: {backgroundColor: '#fff', borderRadius: 20, paddingHorizontal: 14},
  row: {flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 13, borderBottomWidth: StyleSheet.hairlineWidth, borderColor: colors.border},
  rowIcon: {width: 34, height: 34, borderRadius: 10, backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center'},
  label: {fontSize: 12, color: colors.muted, fontWeight: '600'},
  value: {fontSize: 13, color: colors.text, fontWeight: '700', marginTop: 1},
  action: {color: colors.primary, fontWeight: '800', fontSize: 13},
  note: {color: colors.muted, fontSize: 12, textAlign: 'center', paddingHorizontal: 8},
  closed: {color: colors.danger, fontWeight: '700', textAlign: 'center'},
});
