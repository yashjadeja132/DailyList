import React, {useCallback, useEffect, useState} from 'react';
import {KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, View} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import {Button, Card, Field, IconText} from '../../components';
import Icon from '../../Icon';
import {FocusStatusBar} from '../../ui';
import {api, Member} from '../../api';
import {useAuth} from '../../AuthContext';
import {useDialog} from '../../dialog';
import {colors} from '../../theme';

/** Phones that can use the same shop account. The number allowed depends on the shop's plan. */
export default function TeamScreen({navigation}: any) {
  const {account, refreshAccount} = useAuth();
  const dialog = useDialog();
  const [members, setMembers] = useState<Member[]>([]);
  const [max, setMax] = useState(0);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [busy, setBusy] = useState(false);
  const isPrimary = account.team?.is_primary !== false;
  const full = max > 0 && members.length >= max;
  const formOk = name.trim().length > 0 && phone.replace(/\D/g, '').length >= 10; // the button stays disabled until it is

  const load = useCallback(async () => {
    try {
      const r = await api<{members: Member[]; max: number}>('/team');
      setMembers(r.members);
      setMax(r.max);
    } catch (e: any) {
      dialog.alert({title: 'Could not load team', message: e.message, kind: 'error'});
    }
  }, [dialog]);
  useEffect(() => { load(); }, [load]);

  const askUpgrade = async (message: string) => {
    const go = await dialog.confirm({
      kind: 'info', title: 'Team is full', message, confirmText: 'View plans', cancelText: 'Not now',
    });
    if (go) navigation.navigate('Plans');
  };

  const add = async () => {
    if (full) return askUpgrade(`Your plan allows ${max} user${max === 1 ? '' : 's'}. Upgrade your plan to add more people.`);
    if (!formOk) return;
    setBusy(true);
    try {
      const r = await api<{members: Member[]; max: number}>('/team', 'POST', {name, phone});
      setMembers(r.members);
      setMax(r.max);
      setName('');
      setPhone('');
      refreshAccount().catch(() => {});
      dialog.alert({
        kind: 'success', title: 'Team member added',
        message: 'They can now log in with their phone number and use this shop account.',
      });
    } catch (e: any) {
      if (e.message.includes('Upgrade')) askUpgrade(e.message);
      else dialog.alert({title: 'Could not add', message: e.message, kind: 'error'});
    } finally {
      setBusy(false);
    }
  };

  const remove = async (m: Member) => {
    const ok = await dialog.confirm({
      kind: 'danger', title: `Remove ${m.name}?`,
      message: 'They will be logged out and can no longer use this shop account.',
      confirmText: 'Remove', cancelText: 'Keep',
    });
    if (!ok) return;
    try {
      const r = await api<{members: Member[]; max: number}>('/team/' + m.id, 'DELETE');
      setMembers(r.members);
      setMax(r.max);
      refreshAccount().catch(() => {});
    } catch (e: any) {
      dialog.alert({title: 'Could not remove', message: e.message, kind: 'error'});
    }
  };

  return (
    <SafeAreaView style={s.screen} edges={['top', 'bottom']}>
      <FocusStatusBar style="dark-content" />

      <KeyboardAvoidingView style={{flex: 1}} behavior="padding">
        <ScrollView contentContainerStyle={{padding: 16, paddingTop: 0, gap: 14, paddingBottom: 30}} keyboardShouldPersistTaps="handled">
        <View style={{marginHorizontal: -16}}>
      <View style={s.header}>
        <Pressable onPress={() => navigation.goBack()} hitSlop={10} style={s.back}>
          <Icon name="close" size={26} color={colors.text} />
        </Pressable>
        <View style={{flex: 1}}>
          <Text style={s.title}>Team</Text>
          <Text style={s.sub}>People who can use this shop account</Text>
        </View>
      </View>
        </View>

          <Card style={{gap: 10}}>
            <View style={s.rowBetween}>
              <IconText icon="people" color={colors.text} size={20} textStyle={s.cardTitle}>Users on your plan</IconText>
              <Text style={s.count}>{members.length} / {max}</Text>
            </View>
            <View style={s.bar}><View style={[s.fill, {width: `${max ? Math.min(100, (members.length / max) * 100) : 0}%`}]} /></View>
            {full && isPrimary ? (
              <Pressable onPress={() => navigation.navigate('Plans')}>
                <Text style={s.upgrade}>Team is full. Upgrade your plan to add more ›</Text>
              </Pressable>
            ) : null}
          </Card>

          <Card style={{gap: 2}}>
            {members.map((m, i) => (
              <View key={m.id} style={[s.member, i > 0 && s.memberBorder]}>
                <View style={s.avatar}><Text style={s.avatarText}>{m.name.charAt(0).toUpperCase()}</Text></View>
                <View style={{flex: 1}}>
                  <Text style={s.mName}>{m.name}</Text>
                  <Text style={s.mPhone}>{m.phone}</Text>
                </View>
                {m.is_primary ? (
                  <View style={s.badge}><Text style={s.badgeText}>Main owner</Text></View>
                ) : isPrimary ? (
                  <Pressable onPress={() => remove(m)} hitSlop={10}>
                    <Icon name="remove-circle" size={26} color={colors.danger} />
                  </Pressable>
                ) : null}
              </View>
            ))}
          </Card>

          {isPrimary ? (
            <Card style={{gap: 2}}>
              <Text style={s.cardTitle}>Add a team member</Text>
              <Text style={[s.sub, {marginBottom: 12}]}>They log in with this phone number and the one-time code.</Text>
              <Field required label="Name" placeholder="e.g. Ravi" value={name} onChangeText={setName} />
              <Field required label="Phone number" placeholder="e.g. 9876543210" keyboardType="phone-pad" maxLength={15}
                value={phone} onChangeText={setPhone} />
              <Button icon="person-add" title="Add team member" onPress={add} loading={busy} disabled={!formOk} />
            </Card>
          ) : (
            <Card style={{backgroundColor: '#fffbeb'}}>
              <IconText icon="alert-circle" color="#92400e">Only the main shop owner can add or remove team members.</IconText>
            </Card>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  screen: {flex: 1, backgroundColor: colors.bg},
  header: {flexDirection: 'row', alignItems: 'center', gap: 10, padding: 16, paddingBottom: 12},
  back: {width: 36, height: 36, borderRadius: 18, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center'},
  title: {fontSize: 20, fontWeight: '800', color: colors.text},
  sub: {color: colors.muted},
  rowBetween: {flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between'},
  cardTitle: {fontSize: 13, fontWeight: '800', color: colors.text},
  count: {fontSize: 14, fontWeight: '800', color: colors.primaryDark},
  bar: {height: 8, backgroundColor: '#e5e7eb', borderRadius: 4, overflow: 'hidden'},
  fill: {height: 8, backgroundColor: colors.primary, borderRadius: 4},
  upgrade: {color: colors.primary, fontWeight: '700', marginTop: 4},
  member: {flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12},
  memberBorder: {borderTopWidth: StyleSheet.hairlineWidth, borderColor: colors.border},
  avatar: {width: 42, height: 42, borderRadius: 21, backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center'},
  avatarText: {fontWeight: '800', color: colors.primaryDark, fontSize: 14},
  mName: {fontWeight: '700', color: colors.text, fontSize: 13},
  mPhone: {color: colors.muted},
  badge: {backgroundColor: colors.primarySoft, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20},
  badgeText: {color: colors.primaryDark, fontWeight: '700', fontSize: 12},
});
