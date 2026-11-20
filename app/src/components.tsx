import React from 'react';
import {
  ActivityIndicator, Pressable, StyleProp, StyleSheet, Text, TextInput, TextInputProps, TextStyle, View, ViewStyle,
} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import {colors, shadow, statusColor} from './theme';
import Icon, {IconName} from './Icon';
import {FocusStatusBar} from './ui';

export const Screen = ({title, subtitle, right, children}: {
  title: string; subtitle?: string; right?: React.ReactNode; children: React.ReactNode;
}) => (
  <SafeAreaView style={s.screen} edges={['top']}>
    <FocusStatusBar style="dark-content" />
    <View style={s.header}>
      <View style={{flex: 1}}>
        <Text style={s.headerTitle}>{title}</Text>
        {subtitle ? <Text style={s.headerSub}>{subtitle}</Text> : null}
      </View>
      {right}
    </View>
    <View style={{flex: 1}}>{children}</View>
  </SafeAreaView>
);

/** Page title row. Put it inside the scrolling list (ListHeaderComponent) so the whole page scrolls. */
export const PageHeader = ({title, subtitle, right}: {title: string; subtitle?: string; right?: React.ReactNode}) => (
  <View style={s.header}>
    <View style={{flex: 1}}>
      <Text style={s.headerTitle}>{title}</Text>
      {subtitle ? <Text style={s.headerSub}>{subtitle}</Text> : null}
    </View>
    {right}
  </View>
);

/** A page whose content scrolls as a whole (no fixed header). */
export const Page = ({children}: {children: React.ReactNode}) => (
  <SafeAreaView style={s.screen} edges={['top']}>
    <FocusStatusBar style="dark-content" />
    {children}
  </SafeAreaView>
);

export const Button = ({title, onPress, kind = 'primary', small, loading, disabled, style, icon}: {
  icon?: IconName;
  title: string; onPress: () => void; kind?: 'primary' | 'outline' | 'danger' | 'soft';
  small?: boolean; loading?: boolean; disabled?: boolean; style?: ViewStyle;
}) => {
  const k = {
    primary: {bg: colors.primary, fg: '#fff', bd: colors.primary},
    danger: {bg: colors.danger, fg: '#fff', bd: colors.danger},
    outline: {bg: 'transparent', fg: colors.primary, bd: colors.primary},
    soft: {bg: colors.primarySoft, fg: colors.primaryDark, bd: colors.primarySoft},
  }[kind];
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || loading}
      style={({pressed}) => [
        s.btn, small && s.btnSmall,
        {backgroundColor: k.bg, borderColor: k.bd, opacity: disabled ? 0.5 : pressed ? 0.8 : 1}, style,
      ]}>
      {loading ? <ActivityIndicator color={k.fg} /> :
        <View style={{flexDirection: 'row', alignItems: 'center', gap: 8}}>
          {icon ? <Icon name={icon} size={small ? 16 : 20} color={k.fg} /> : null}
          <Text style={[s.btnText, small && {fontSize: 12}, {color: k.fg}]}>{title}</Text>
        </View>}
    </Pressable>
  );
};

/** A labelled text box. `required` adds a red * to the label. */
export const Field = ({label, required, ...props}: TextInputProps & {label: string; required?: boolean}) => (
  <View style={{marginBottom: 14}}>
    <Text style={s.label}>
      {label}
      {required ? <Text style={{color: colors.danger}}> *</Text> : null}
    </Text>
    <TextInput placeholderTextColor="#9ca3af" style={s.input} {...props} />
  </View>
);

export const Card = ({children, style}: {children: React.ReactNode; style?: StyleProp<ViewStyle>}) => (
  <View style={[s.card, style]}>{children}</View>
);

export const Badge = ({status}: {status: string}) => (
  <View style={[s.badge, {backgroundColor: statusColor[status] + '22'}]}>
    <Text style={{color: statusColor[status], fontWeight: '700', fontSize: 12}}>{status}</Text>
  </View>
);

/** A line of text with a small outlined icon in front. */
export const IconText = ({icon, children, color = colors.muted, size = 16, style, textStyle}: {
  icon: IconName; children: React.ReactNode; color?: string; size?: number;
  style?: StyleProp<ViewStyle>; textStyle?: StyleProp<TextStyle>;
}) => (
  <View style={[{flexDirection: 'row', alignItems: 'center', gap: 6}, style]}>
    <Icon name={icon} size={size} color={color} />
    <Text style={[{color, flexShrink: 1}, textStyle]}>{children}</Text>
  </View>
);

export const StatCard = ({icon, value, label, tint = colors.primarySoft, onPress}: {
  icon: IconName; value: number | string; label: string; tint?: string; onPress?: () => void;
}) => (
  <Pressable onPress={onPress} style={[s.stat, {backgroundColor: tint}]}>
    <Icon name={icon} size={22} color={colors.primaryDark} />
    <Text style={s.statValue}>{value}</Text>
    <Text style={s.statLabel}>{label}</Text>
  </Pressable>
);

export const SectionHeader = ({title, icon, action, onAction}: {title: string; icon?: IconName; action?: string; onAction?: () => void}) => (
  <View style={s.sectionRow}>
    <View style={{flexDirection: 'row', alignItems: 'center', gap: 8}}>
      {icon ? <Icon name={icon} size={20} color={colors.text} /> : null}
      <Text style={s.sectionTitle}>{title}</Text>
    </View>
    {action ? <Pressable onPress={onAction} hitSlop={8}><Text style={s.sectionAction}>{action} ›</Text></Pressable> : null}
  </View>
);

export const Empty = ({icon, title, text}: {icon: IconName; title: string; text?: string}) => (
  <View style={s.empty}>
    <Icon name={icon} size={56} color="#9ca3af" />
    <Text style={s.emptyTitle}>{title}</Text>
    {text ? <Text style={s.emptyText}>{text}</Text> : null}
  </View>
);

export const Chip = ({label, active, onPress}: {label: string; active: boolean; onPress: () => void}) => (
  <Pressable onPress={onPress} style={[s.chip, active && s.chipOn]}>
    <Text style={{color: active ? '#fff' : colors.text, fontWeight: '600', fontSize: 12}}>{label}</Text>
  </Pressable>
);

export const Stepper = ({value, onMinus, onPlus}: {value: number; onMinus: () => void; onPlus: () => void}) => (
  <View style={s.stepper}>
    <Pressable onPress={onMinus} style={s.stepBtn} hitSlop={6}><Text style={s.stepTxt}>−</Text></Pressable>
    <Text style={s.stepNum}>{value}</Text>
    <Pressable onPress={onPlus} style={s.stepBtn} hitSlop={6}><Text style={s.stepTxt}>+</Text></Pressable>
  </View>
);

export const money = (n: number) => '₹' + (Math.round(n * 100) / 100);
export const when = (iso: string) => {
  const d = new Date(iso.replace(' ', 'T') + 'Z');
  return d.toLocaleString([], {day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit'});
};

const s = StyleSheet.create({
  screen: {flex: 1, backgroundColor: colors.bg},
  header: {flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14},
  headerTitle: {fontSize: 18, fontWeight: '800', color: colors.text},
  headerSub: {fontSize: 12, color: colors.muted, marginTop: 2},
  btn: {
    minHeight: 48, borderRadius: 12, borderWidth: 1.5, alignItems: 'center',
    justifyContent: 'center', paddingHorizontal: 18,
  },
  btnSmall: {minHeight: 36, borderRadius: 10, paddingHorizontal: 12},
  btnText: {fontWeight: '700', fontSize: 13},
  label: {fontSize: 12, fontWeight: '600', color: colors.muted, marginBottom: 6},
  input: {
    borderWidth: 1.5, borderColor: colors.border, borderRadius: 12, paddingHorizontal: 14,
    paddingVertical: 12, fontSize: 13, color: colors.text, backgroundColor: '#fff',
  },
  card: {backgroundColor: colors.card, borderRadius: 16, padding: 14, ...shadow},
  badge: {paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20},
  stat: {flex: 1, borderRadius: 16, padding: 12, gap: 2},
  statValue: {fontSize: 20, fontWeight: '800', color: colors.text},
  statLabel: {fontSize: 12, fontWeight: '600', color: colors.muted},
  sectionRow: {flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 22, marginBottom: 10},
  sectionTitle: {fontSize: 14, fontWeight: '800', color: colors.text},
  sectionAction: {color: colors.primary, fontWeight: '700'},
  empty: {alignItems: 'center', justifyContent: 'center', padding: 40, marginTop: 40},
  emptyTitle: {fontSize: 14, fontWeight: '700', color: colors.text, marginTop: 12},
  emptyText: {color: colors.muted, textAlign: 'center', marginTop: 6},
  chip: {
    paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, backgroundColor: '#fff',
    borderWidth: 1, borderColor: colors.border, marginRight: 8,
  },
  chipOn: {backgroundColor: colors.primary, borderColor: colors.primary},
  stepper: {flexDirection: 'row', alignItems: 'center', backgroundColor: colors.primarySoft, borderRadius: 10},
  stepBtn: {width: 34, height: 34, alignItems: 'center', justifyContent: 'center'},
  stepTxt: {fontSize: 16, fontWeight: '700', color: colors.primaryDark},
  stepNum: {minWidth: 24, textAlign: 'center', fontWeight: '800', color: colors.text},
});
