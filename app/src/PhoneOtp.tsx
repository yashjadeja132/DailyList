import React, {useEffect, useState} from 'react';
import {Pressable, StyleSheet, Text, View} from 'react-native';
import {Field} from './components';
import {useAuth, SignupData} from './AuthContext';
import {useDialog} from './dialog';
import Icon from './Icon';
import {colors} from './theme';

/**
 * The phone number field used by Log in and Sign up, with the live "does this number have an
 * account?" check (while typing, before any code is sent).
 *  - `field`: put it wherever the phone number belongs on the page.
 *  - `ready`: true when the number is valid and fits this page ('login' needs an existing account,
 *             'signup' needs a new number). Use it to enable the button.
 */
export function usePhoneField({mode, onSwitch, initialPhone = ''}: {
  mode: 'login' | 'signup';
  /** Called when the user taps the link in the "no account / already registered" notice. */
  onSwitch: (phone: string) => void;
  initialPhone?: string;
}) {
  const {checkAccount} = useAuth();
  const [phone, setPhone] = useState(initialPhone);
  const [account, setAccount] = useState<'unknown' | 'checking' | 'yes' | 'no'>('unknown');

  const phoneOk = phone.replace(/\D/g, '').length >= 10;

  useEffect(() => {
    if (!phoneOk) { setAccount('unknown'); return; }
    let stale = false;
    setAccount('checking');
    const timer = setTimeout(async () => {
      try {
        const exists = await checkAccount(phone.trim());
        if (!stale) setAccount(exists ? 'yes' : 'no');
      } catch {
        if (!stale) setAccount('unknown');
      }
    }, 350);
    return () => { stale = true; clearTimeout(timer); };
  }, [phone, phoneOk, checkAccount]);

  const blocked = mode === 'login' ? account === 'no' : account === 'yes';

  const field = (
    <View>
      <Field required label="Phone number" placeholder="e.g. 9876543210" keyboardType="phone-pad"
        value={phone} maxLength={15} onChangeText={setPhone} />

      {blocked && (
        <View style={s.notice}>
          <Icon name="alert-circle" size={18} color={colors.danger} />
          <Text style={s.noticeText}>
            {mode === 'login' ? 'No account found for this number. ' : 'This number is already registered. '}
            <Text style={s.link} onPress={() => onSwitch(phone.trim())}>
              {mode === 'login' ? 'Sign up' : 'Log in'}
            </Text>
          </Text>
        </View>
      )}
      {mode === 'login' && account === 'yes' && (
        <View style={s.found}>
          <Icon name="checkmark-circle" size={18} color={colors.primaryDark} />
          <Text style={s.foundText}>Account found</Text>
        </View>
      )}
    </View>
  );

  return {phone, field, ready: phoneOk && !blocked && account !== 'checking'};
}

/**
 * Sends the one-time code and opens the OTP screen, where the code is entered and checked.
 * (Log in and Sign up themselves never verify a code.)
 */
export function useSendCode(navigation: any) {
  const {sendOtp} = useAuth();
  const dialog = useDialog();
  const [busy, setBusy] = useState(false);

  const send = async (params: {phone: string; mode: 'login' | 'signup'; signup?: SignupData}) => {
    setBusy(true);
    try {
      const hint = await sendOtp(params.phone);
      navigation.navigate('Otp', {...params, hint});
    } catch (e: any) {
      dialog.alert({title: 'Could not send code', message: e.message, kind: 'error'});
    } finally {
      setBusy(false);
    }
  };
  return {busy, send};
}

/** Fixed bottom bar: a "switch page" line above the main button. */
export function AuthFooter({text, linkText, onLink, children}: {
  text: string; linkText: string; onLink: () => void; children: React.ReactNode;
}) {
  return (
    <View style={s.footer}>
      <View style={s.row}>
        <Text style={{color: colors.muted}}>{text} </Text>
        <Pressable onPress={onLink} hitSlop={8}><Text style={s.link}>{linkText}</Text></Pressable>
      </View>
      {children}
    </View>
  );
}

const s = StyleSheet.create({
  notice: {
    flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: -4, marginBottom: 14,
    backgroundColor: '#fee2e2', borderRadius: 10, padding: 10,
  },
  noticeText: {flex: 1, color: colors.danger, fontSize: 12, fontWeight: '600'},
  found: {flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: -6, marginBottom: 14},
  foundText: {color: colors.primaryDark, fontWeight: '700', fontSize: 12},
  link: {color: colors.primary, fontWeight: '700'},
  footer: {
    paddingHorizontal: 24, paddingTop: 14, paddingBottom: 16, gap: 12,
    backgroundColor: colors.bg, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border,
  },
  row: {flexDirection: 'row', justifyContent: 'center'},
});
