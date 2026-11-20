import React, {useState} from 'react';
import {KeyboardAvoidingView, Modal, StyleSheet, Text, TextInput, View} from 'react-native';
import {Button} from '../components';
import {api} from '../api';
import {useDialog} from '../dialog';
import {colors} from '../theme';

/** A short form to report a problem with an order to the platform team. */
export default function ReportProblem({orderId, about, onClose}: {
  orderId: number | null; about: 'shop' | 'customer'; onClose: () => void;
}) {
  const dialog = useDialog();
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const send = async () => {
    setBusy(true);
    try {
      await api('/complaints', 'POST', {order_id: orderId, about, text});
      setText('');
      onClose();
      dialog.alert({kind: 'success', title: 'Thank you', message: 'We received your report and will look into it.'});
    } catch (e: any) {
      dialog.alert({kind: 'error', title: 'Could not send', message: e.message});
    } finally { setBusy(false); }
  };
  return (
    <Modal visible={orderId !== null} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView style={s.backdrop} behavior="padding">
        <View style={s.sheet}>
          <Text style={s.title}>Report a problem</Text>
          <Text style={s.sub}>Order #{orderId}. Tell us what went wrong, and our team will follow up.</Text>
          <TextInput style={s.input} value={text} onChangeText={setText} multiline placeholder="Describe the problem"
            placeholderTextColor="#9ca3af" maxLength={1000} />
          <View style={{flexDirection: 'row', gap: 10}}>
            <Button kind="outline" title="Cancel" style={{flex: 1}} onPress={onClose} />
            <Button title="Send report" style={{flex: 1}} loading={busy} disabled={!text.trim()} onPress={send} />
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const s = StyleSheet.create({
  backdrop: {flex: 1, backgroundColor: 'rgba(17,24,39,0.55)', justifyContent: 'flex-end'},
  sheet: {backgroundColor: colors.bg, padding: 20, borderTopLeftRadius: 24, borderTopRightRadius: 24, gap: 12},
  title: {fontSize: 16, fontWeight: '800', color: colors.text},
  sub: {color: colors.muted},
  input: {minHeight: 100, textAlignVertical: 'top', borderWidth: 1.5, borderColor: colors.border, borderRadius: 12, backgroundColor: '#fff', padding: 12, fontSize: 13, color: colors.text},
});
