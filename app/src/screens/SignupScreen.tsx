import React, {useState} from 'react';
import {
  KeyboardAvoidingView, Linking, Platform, Pressable, ScrollView, StatusBar, StyleSheet, Text, View,
} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import {Button, Field} from '../components';
import {getBaseUrl} from '../api';
import Icon, {IconName} from '../Icon';
import Logo from '../Logo';
import {useDialog} from '../dialog';
import LocationPicker from '../LocationPicker';
import {AuthFooter, usePhoneField, useSendCode} from '../PhoneOtp';
import {colors} from '../theme';

/** Sign up: your details and phone number, then Send OTP. The code is verified on the next screen. */
export default function SignupScreen({route, navigation}: any) {
  const dialog = useDialog();
  const [role, setRole] = useState<'customer' | 'owner'>('customer');
  const [name, setName] = useState('');
  const [shopName, setShopName] = useState('');
  const [address, setAddress] = useState('');
  const [coords, setCoords] = useState<{lat: number; lng: number} | null>(null);
  const [agreed, setAgreed] = useState(false);

  // Required fields are marked with * and the button stays disabled until they are all filled in
  // (no pop-ups for missing fields): name, shop name (owners), the agreement and the phone number.
  const canSend = name.trim().length > 0 && (role !== 'owner' || shopName.trim().length > 0) && agreed;

  // The policies are pages on the website, served by the same server as the app.
  const openPage = async (path: '/terms' | '/privacy') => {
    try {
      await Linking.openURL(getBaseUrl() + path);
    } catch {
      dialog.alert({title: 'Could not open the page', message: 'Please try again, or visit our website to read it.', kind: 'error'});
    }
  };

  // The phone number sits right under the name. The code itself is entered on the OTP screen.
  const {phone, field: phoneField, ready} = usePhoneField({
    mode: 'signup', onSwitch: () => (navigation.canGoBack() ? navigation.goBack() : navigation.replace('Login')),
    initialPhone: route.params?.phone,
  });
  const {busy, send} = useSendCode(navigation);

  const sendCode = () => send({
    phone: phone.trim(),
    mode: 'signup',
    signup: {
      name: name.trim(), role, accepted_terms: true,
      shop: role === 'owner' ? {name: shopName.trim(), address, lat: coords?.lat, lng: coords?.lng} : undefined,
    },
  });

  const Role = ({value, icon, label, text}: any) => (
    <Pressable onPress={() => setRole(value)} style={[s.role, role === value && s.roleOn]}>
      <Icon name={icon as IconName} size={30} color={role === value ? colors.primaryDark : colors.muted} filled={role === value} />
      <Text style={s.roleLabel}>{label}</Text>
      <Text style={s.roleText}>{text}</Text>
    </Pressable>
  );

  return (
    <SafeAreaView style={s.screen}>
      <StatusBar barStyle="dark-content" />
      <KeyboardAvoidingView style={{flex: 1}} behavior="padding">
        <ScrollView contentContainerStyle={s.body} keyboardShouldPersistTaps="handled">
          <View style={s.logo}><Logo size={44} color={colors.primary} /></View>
          <Text style={s.title}>Create your account</Text>
          <Text style={s.sub}>Tell us about you, then verify your phone number.</Text>

          <View style={{flexDirection: 'row', gap: 12, marginBottom: 20}}>
            <Role value="customer" icon="basket" label="Customer" text="I want to order" />
            <Role value="owner" icon="storefront" label="Shop owner" text="I run a shop" />
          </View>

          <Field required label="Your name" placeholder="Full name" value={name} onChangeText={setName} />
          {phoneField}

          {role === 'owner' && (
            <>
              <Field required label="Shop name" placeholder="e.g. Asha General Store" value={shopName} onChangeText={setShopName} />
              <Field label="Shop address / area" placeholder="Street, area, city" value={address} onChangeText={setAddress} />
              <Text style={s.label}>Shop location</Text>
              <LocationPicker shopName={shopName} saved={!!coords} initial={coords}
                onPick={p => {
                  setCoords({lat: p.lat, lng: p.lng});
                  if (p.address && !address.trim()) setAddress(p.address);
                }} />
              <Text style={s.hint}>
                Tap the button and move the map pin onto your shop so nearby
                customers find you.
              </Text>
              <View style={{height: 16}} />
            </>
          )}
        </ScrollView>
        <AuthFooter text="Already have an account?" linkText="Log in" onLink={() => (navigation.canGoBack() ? navigation.goBack() : navigation.replace('Login'))}>
          {/* required: agree to the Terms & Conditions and Privacy Policy, right above the button */}
          <View style={s.agree}>
            <Pressable
              onPress={() => setAgreed(a => !a)}
              hitSlop={10} accessibilityRole="checkbox" accessibilityState={{checked: agreed}}>
              <Icon name={agreed ? 'checkbox' : 'square'} size={24} filled={agreed}
                color={agreed ? colors.primary : colors.muted} />
            </Pressable>
            <Text style={s.agreeText}>
              I agree to the{' '}
              <Text style={s.agreeLink} onPress={() => openPage('/terms')}>Terms &amp; Conditions</Text>
              {' '}and{' '}
              <Text style={s.agreeLink} onPress={() => openPage('/privacy')}>Privacy Policy</Text>
              <Text style={{color: colors.danger}}> *</Text>
            </Text>
          </View>
          <Button title="Send OTP" loading={busy} disabled={!canSend || !ready} onPress={sendCode} />
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
  label: {fontSize: 12, fontWeight: '600', color: colors.muted, marginBottom: 6},
  hint: {color: colors.muted, fontSize: 12, marginTop: 8},
  agree: {flexDirection: 'row', alignItems: 'center', gap: 10},
  agreeText: {flex: 1, color: colors.muted, fontSize: 12, lineHeight: 19},
  agreeLink: {color: colors.primary, fontWeight: '700'},
  role: {
    flex: 1, backgroundColor: '#fff', borderRadius: 16, padding: 12, alignItems: 'center',
    borderWidth: 2, borderColor: colors.border,
  },
  roleOn: {borderColor: colors.primary, backgroundColor: colors.primarySoft},
  roleLabel: {fontWeight: '800', color: colors.text, marginTop: 4},
  roleText: {color: colors.muted, fontSize: 12, marginTop: 2},
});
