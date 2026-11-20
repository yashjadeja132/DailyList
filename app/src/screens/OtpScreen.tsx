import React, {useEffect, useState} from 'react';
import {KeyboardAvoidingView, Platform, Pressable, ScrollView, StatusBar, StyleSheet, Text, TextInput, View} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import {Button, IconText} from '../components';
import {useAuth, SignupData} from '../AuthContext';
import Icon from '../Icon';
import {useDialog} from '../dialog';
import {colors} from '../theme';

type Params = {phone: string; mode: 'login' | 'signup'; signup?: SignupData; hint?: string};

/**
 * The only place a one-time code is entered and verified. Log in and Sign up send the code and
 * then open this screen; going back returns to them with everything still filled in.
 */
export default function OtpScreen({route, navigation}: any) {
  const {phone, mode, signup, hint: firstHint} = route.params as Params;
  const {sendOtp, verifyOtp} = useAuth();
  const dialog = useDialog();
  const [otp, setOtp] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [hint, setHint] = useState(firstHint);
  const [wait, setWait] = useState(30);
  const [resent, setResent] = useState(false);

  useEffect(() => {
    if (wait <= 0) return;
    const t = setTimeout(() => setWait(w => w - 1), 1000);
    return () => clearTimeout(t);
  }, [wait]);

  const verify = async (code = otp) => {
    if (code.length !== 6 || busy) return;
    setBusy(true);
    setError('');
    try {
      const r = await verifyOtp(phone, code, mode, signup);
      if (r === 'signup') {
        // logging in with a number that has no account
        setError('No account found for this number.');
      }
      // otherwise the user is signed in and the app switches to the main screens by itself
    } catch (e: any) {
      if (e.message.includes('already registered')) {
        const go = await dialog.confirm({
          kind: 'info', title: 'Already registered', message: e.message,
          confirmText: 'Log in', cancelText: 'Stay here',
        });
        if (go) navigation.navigate('Login');
      } else {
        setError(e.message);
        setOtp('');
      }
    } finally {
      setBusy(false);
    }
  };

  const resend = async () => {
    try {
      setHint(await sendOtp(phone));
      setWait(30);
      setOtp('');
      setError('');
      setResent(true);
    } catch (e: any) {
      setError(e.message);
    }
  };

  return (
    <SafeAreaView style={s.screen}>
      <StatusBar barStyle="dark-content" />
      <KeyboardAvoidingView style={{flex: 1}} behavior="padding">
        <ScrollView contentContainerStyle={s.body} keyboardShouldPersistTaps="handled">
          <Pressable onPress={() => navigation.goBack()} hitSlop={10} style={s.back}>
            <Icon name="close" size={22} color={colors.text} />
          </Pressable>

          <View style={s.logo}><Icon name="chatbubble" size={38} color={colors.primaryDark} filled /></View>
          <Text style={s.title}>Verify your phone</Text>
          <Text style={s.sub}>
            We sent a 6-digit code to <Text style={s.phone}>{phone}</Text>.{' '}
            <Text style={s.link} onPress={() => navigation.goBack()}>Change number</Text>
          </Text>

          {hint ? (
            <View style={s.hint}>
              <IconText icon="construct" color="#92400e" textStyle={s.hintText}>{hint}</IconText>
            </View>
          ) : null}

          <Text style={s.label}>Enter the code<Text style={{color: colors.danger}}> *</Text></Text>
          <TextInput
            style={[s.otp, !!error && s.otpError]} value={otp} autoFocus keyboardType="number-pad" maxLength={6}
            placeholder="••••••" placeholderTextColor="#d1d5db" textContentType="oneTimeCode"
            onChangeText={t => {
              const v = t.replace(/\D/g, '');
              setOtp(v);
              setError('');
              if (v.length === 6) verify(v); // checks it as soon as the 6th digit is typed
            }} />
          {error ? (
            <View style={s.errorRow}>
              <Icon name="alert-circle" size={16} color={colors.danger} />
              <Text style={s.errorText}>
                {error}
                {mode === 'login' && error.startsWith('No account') ? (
                  <Text style={s.link} onPress={() => navigation.navigate('Signup', {phone})}> Sign up</Text>
                ) : null}
              </Text>
            </View>
          ) : resent ? <Text style={s.okText}>A new code was sent.</Text> : null}

          <View style={{alignItems: 'center', marginTop: 18}}>
            {wait > 0
              ? <Text style={{color: colors.muted}}>Resend code in {wait}s</Text>
              : <Pressable onPress={resend} hitSlop={8}><Text style={s.link}>Resend code</Text></Pressable>}
          </View>
        </ScrollView>

        <View style={s.footer}>
          <Button title={mode === 'login' ? 'Verify & log in' : 'Verify & create account'}
            onPress={() => verify()} loading={busy} disabled={otp.length !== 6} />
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  screen: {flex: 1, backgroundColor: colors.bg},
  body: {padding: 24, paddingTop: 18, paddingBottom: 30},
  back: {
    width: 38, height: 38, borderRadius: 19, backgroundColor: '#fff', alignItems: 'center',
    justifyContent: 'center', marginBottom: 22,
  },
  logo: {
    width: 76, height: 76, borderRadius: 22, backgroundColor: colors.primarySoft,
    alignItems: 'center', justifyContent: 'center', marginBottom: 20,
  },
  title: {fontSize: 21, fontWeight: '800', color: colors.text},
  sub: {color: colors.muted, marginTop: 6, marginBottom: 22, fontSize: 13, lineHeight: 22},
  phone: {color: colors.text, fontWeight: '800'},
  link: {color: colors.primary, fontWeight: '700'},
  hint: {backgroundColor: '#fffbeb', borderRadius: 12, padding: 12, marginBottom: 18},
  hintText: {color: '#92400e', fontWeight: '600', fontSize: 12},
  label: {fontSize: 12, fontWeight: '600', color: colors.muted, marginBottom: 6},
  otp: {
    borderWidth: 1.5, borderColor: colors.border, borderRadius: 14, backgroundColor: '#fff',
    fontSize: 23, fontWeight: '800', letterSpacing: 12, textAlign: 'center',
    paddingVertical: 14, color: colors.text,
  },
  otpError: {borderColor: colors.danger},
  errorRow: {flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 8},
  errorText: {flex: 1, color: colors.danger, fontSize: 12, fontWeight: '600'},
  okText: {color: colors.primaryDark, fontSize: 12, fontWeight: '600', marginTop: 8},
  footer: {
    paddingHorizontal: 24, paddingTop: 14, paddingBottom: 16, backgroundColor: colors.bg,
    borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border,
  },
});
