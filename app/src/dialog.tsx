import React, {createContext, useCallback, useContext, useMemo, useRef, useState} from 'react';
import {Modal, Pressable, StyleSheet, Text, View} from 'react-native';
import {Button} from './components';
import Icon, {IconName} from './Icon';
import {colors, shadow} from './theme';

type Kind = 'success' | 'error' | 'info' | 'confirm' | 'danger';
export type DialogOptions = {
  title: string;
  message?: string;
  kind?: Kind;
  confirmText?: string;
  cancelText?: string;
};

type Ctx = {
  /** Shows a message with one button. */
  alert: (o: DialogOptions) => Promise<void>;
  /** Shows a question with two buttons. Resolves true when confirmed. */
  confirm: (o: DialogOptions) => Promise<boolean>;
};

const DialogContext = createContext<Ctx>(null as any);
export const useDialog = () => useContext(DialogContext);

const LOOK: Record<Kind, {icon: IconName; bg: string; fg: string}> = {
  success: {icon: 'checkmark-circle', bg: colors.primarySoft, fg: colors.primaryDark},
  error: {icon: 'alert-circle', bg: '#fee2e2', fg: colors.danger},
  info: {icon: 'chatbubble', bg: '#dbeafe', fg: colors.blue},
  confirm: {icon: 'help-circle', bg: '#fef3c7', fg: colors.amber},
  danger: {icon: 'trash', bg: '#fee2e2', fg: colors.danger},
};

export function DialogProvider({children}: {children: React.ReactNode}) {
  const [opts, setOpts] = useState<(DialogOptions & {ask: boolean}) | null>(null);
  const resolver = useRef<((v: boolean) => void) | null>(null);

  const open = useCallback((o: DialogOptions, ask: boolean) =>
    new Promise<boolean>(resolve => {
      resolver.current = resolve;
      setOpts({...o, ask});
    }), []);

  const close = (v: boolean) => {
    resolver.current?.(v);
    resolver.current = null;
    setOpts(null);
  };

  const value = useMemo<Ctx>(() => ({
    alert: async o => { await open(o, false); },
    confirm: o => open({kind: 'confirm', ...o}, true),
  }), [open]);

  const look = LOOK[opts?.kind || 'info'];

  return (
    <DialogContext.Provider value={value}>
      {children}
      <Modal visible={!!opts} transparent animationType="fade" statusBarTranslucent
        onRequestClose={() => close(false)}>
        <Pressable style={s.backdrop} onPress={() => opts?.ask && close(false)}>
          <Pressable style={s.card} onPress={() => {}}>
            <View style={[s.iconWrap, {backgroundColor: look.bg}]}>
              <Icon name={look.icon} size={38} color={look.fg} />
            </View>
            <Text style={s.title}>{opts?.title}</Text>
            {opts?.message ? <Text style={s.message}>{opts.message}</Text> : null}
            <View style={s.buttons}>
              {opts?.ask && (
                <Button kind="outline" title={opts.cancelText || 'Cancel'} style={s.btn}
                  onPress={() => close(false)} />
              )}
              <Button
                kind={opts?.kind === 'danger' || opts?.kind === 'error' ? 'danger' : 'primary'}
                title={opts?.confirmText || (opts?.ask ? 'Yes' : 'OK')}
                style={s.btn}
                onPress={() => close(true)} />
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </DialogContext.Provider>
  );
}

const s = StyleSheet.create({
  backdrop: {
    flex: 1, backgroundColor: 'rgba(17,24,39,0.55)', alignItems: 'center',
    justifyContent: 'center', padding: 28,
  },
  card: {
    width: '100%', maxWidth: 380, backgroundColor: '#fff', borderRadius: 24, padding: 22,
    alignItems: 'center', ...shadow, elevation: 10,
  },
  iconWrap: {
    width: 72, height: 72, borderRadius: 36, alignItems: 'center', justifyContent: 'center', marginBottom: 14,
  },
  title: {fontSize: 16, fontWeight: '800', color: colors.text, textAlign: 'center'},
  message: {fontSize: 13, color: colors.muted, textAlign: 'center', marginTop: 8, lineHeight: 21},
  buttons: {flexDirection: 'row', gap: 10, marginTop: 22},
  btn: {flex: 1},
});
