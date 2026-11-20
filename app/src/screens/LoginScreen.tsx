import React from 'react';
import {KeyboardAvoidingView, Platform, ScrollView, StatusBar, StyleSheet, Text, View} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import {Button} from '../components';
import Icon from '../Icon';
import Logo from '../Logo';
import {AuthFooter, usePhoneField, useSendCode} from '../PhoneOtp';
import {colors} from '../theme';

/** Log in: enter the phone number, tap Send OTP. The code is verified on the next screen. */
export default function LoginScreen({navigation}: any) {
  const {phone, field, ready} = usePhoneField({
    mode: 'login', onSwitch: p => navigation.navigate('Signup', {phone: p}),
  });
  const {busy, send} = useSendCode(navigation);

  return (
    <SafeAreaView style={s.screen}>
      <StatusBar barStyle="dark-content" />
      <KeyboardAvoidingView style={{flex: 1}} behavior="padding">
        <ScrollView contentContainerStyle={s.body} keyboardShouldPersistTaps="handled">
          <View style={s.logo}><Logo size={44} color={colors.primary} /></View>
          <Text style={s.title}>Welcome back</Text>
          <Text style={s.sub}>Log in with your phone number. We will send you a code.</Text>

          {field}
        </ScrollView>
        <AuthFooter text="New here?" linkText="Create an account" onLink={() => navigation.navigate('Signup')}>
          <Button title="Send OTP" loading={busy} disabled={!ready}
            onPress={() => send({phone: phone.trim(), mode: 'login'})} />
        </AuthFooter>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  screen: {flex: 1, backgroundColor: colors.bg},
  body: {padding: 24, paddingTop: 40, paddingBottom: 40},
  logo: {
    width: 76, height: 76, borderRadius: 22, backgroundColor: colors.primarySoft,
    alignItems: 'center', justifyContent: 'center', marginBottom: 20,
  },
  title: {fontSize: 21, fontWeight: '800', color: colors.text},
  sub: {color: colors.muted, marginTop: 4, marginBottom: 28, fontSize: 13},
});
