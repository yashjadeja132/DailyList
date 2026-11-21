import React, {useMemo, useState} from 'react';
import {ActivityIndicator, Linking, Pressable, StyleSheet, Text, View} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import {WebView} from 'react-native-webview';
import {Button} from '../components';
import Icon from '../Icon';
import {FocusStatusBar} from '../ui';
import {api} from '../api';
import {useAuth} from '../AuthContext';
import {useDialog} from '../dialog';
import {colors} from '../theme';

const UPI_APP = /^(upi|intent|phonepe|tez|gpay|paytmmp|bhim|credpay|whatsapp):/i;

/**
 * Pays for a plan with Cashfree. The checkout opens inside the app. When it is done the server
 * asks Cashfree what happened, and only then is the plan switched on.
 */
export default function PaymentScreen({route, navigation}: any) {
  const {order_id, payment_session_id, environment, plan_name, amount} = route.params;
  const {refreshAccount} = useAuth();
  const dialog = useDialog();
  const [checking, setChecking] = useState(false);
  const [loading, setLoading] = useState(true);

  const html = useMemo(() => `<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1">
<script src="https://sdk.cashfree.com/js/v3/cashfree.js"></script></head>
<body style="font-family:sans-serif;text-align:center;padding-top:80px;color:#6b7280">Opening secure payment…
<script>window.onload=function(){var c=Cashfree({mode:${JSON.stringify(environment)}});
c.checkout({paymentSessionId:${JSON.stringify(payment_session_id)},redirectTarget:"_self"});};</script></body></html>`,
  [environment, payment_session_id]);

  const confirm = async () => {
    if (checking) return;
    setChecking(true);
    try {
      const r = await api<{status: 'paid' | 'pending' | 'failed'}>('/subscription/confirm', 'POST', {order_id});
      if (r.status === 'paid') {
        await refreshAccount().catch(() => {});
        await dialog.alert({kind: 'success', title: 'Payment successful', message: `${plan_name} is now active.`, confirmText: 'Done'});
        if (navigation.canGoBack()) navigation.goBack();
      } else if (r.status === 'pending') {
        dialog.alert({kind: 'info', title: 'Payment is processing', message: 'We have not received the payment yet. Wait a moment and tap "Check payment" again.'});
      } else {
        dialog.alert({kind: 'error', title: 'Payment not completed', message: 'The payment failed or was cancelled. No plan was changed. You can try again.'});
      }
    } catch (e: any) {
      dialog.alert({kind: 'error', title: 'Could not check the payment', message: e.message});
    } finally { setChecking(false); }
  };

  return (
    <SafeAreaView style={s.screen} edges={['top', 'bottom']}>
      <FocusStatusBar style="dark-content" />
      <View style={s.head}>
        <Pressable onPress={() => navigation.goBack()} hitSlop={10} style={s.close}><Icon name="close" size={22} color={colors.text} /></Pressable>
        <View style={{flex: 1}}>
          <Text style={s.title}>Pay for {plan_name}</Text>
          <Text style={s.sub}>₹{amount} · secure payment by Cashfree{environment === 'sandbox' ? ' (test mode)' : ''}</Text>
        </View>
      </View>
      <View style={{flex: 1}}>
        <WebView
          source={{html, baseUrl: 'https://localhost/'}}
          originWhitelist={['*']}
          javaScriptEnabled domStorageEnabled setSupportMultipleWindows={false}
          onLoadEnd={() => setLoading(false)}
          // Android does not always report a server redirect to onShouldStartLoadWithRequest,
          // so also watch the page address itself and confirm as soon as the return page opens
          onNavigationStateChange={nav => { if (nav.url?.includes('/pay/return')) confirm(); }}
          onShouldStartLoadWithRequest={req => {
            if (req.url.includes('/pay/return')) { confirm(); return false; } // the checkout finished
            if (UPI_APP.test(req.url)) { // open the UPI app (GPay, PhonePe, ...)
              Linking.openURL(req.url).catch(() => dialog.alert({kind: 'error', title: 'No UPI app found', message: 'Install a UPI app or choose another way to pay.'}));
              return false;
            }
            return true;
          }} />
        {loading ? <ActivityIndicator style={s.loader} color={colors.primary} size="large" /> : null}
      </View>
      <View style={s.footer}>
        <Button kind="soft" title="I have paid. Check payment" loading={checking} onPress={confirm} />
      </View>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  screen: {flex: 1, backgroundColor: colors.bg},
  head: {flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, backgroundColor: '#fff'},
  close: {width: 38, height: 38, borderRadius: 19, backgroundColor: '#f3f4f6', alignItems: 'center', justifyContent: 'center'},
  title: {fontSize: 17, fontWeight: '800', color: colors.text},
  sub: {color: colors.muted, fontSize: 12, marginTop: 1},
  loader: {position: 'absolute', top: 0, bottom: 0, left: 0, right: 0},
  footer: {padding: 14, backgroundColor: '#fff'},
});
