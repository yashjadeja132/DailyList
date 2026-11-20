import React, {useState} from 'react';
import {Linking, Pressable, StyleSheet, Text, TextInput, View} from 'react-native';
import {Button, when} from '../components';
import Icon from '../Icon';
import {Avatar, StatusPill, Tracker} from '../ui';
import {ItemState, Line, Order} from '../api';
import {colors} from '../theme';

type Mark = (lineId: number, state: ItemState, qty?: string) => void;

/** One line while the shop is checking: three choices, and a quantity box for "partial". */
function ReviewLine({l, first, onMark}: {l: Line; first: boolean; onMark: Mark}) {
  const [asking, setAsking] = useState(false);
  const [qty, setQty] = useState(l.avail_qty);
  const pick = (state: ItemState) => {
    if (state === 'partial') { setAsking(true); return; }
    setAsking(false);
    onMark(l.id, state);
  };
  const Choice = ({state, label, color}: {state: ItemState; label: string; color: string}) => {
    const on = state === 'partial' ? (asking || l.state === 'partial') : (!asking && l.state === state);
    return (
      <Pressable onPress={() => pick(state)} style={[s.choice, on && {backgroundColor: color, borderColor: color}]}>
        <Text style={[s.choiceText, on && {color: '#fff'}]}>{label}</Text>
      </Pressable>
    );
  };
  return (
    <View style={[s.reviewLine, !first && s.lineBorder]}>
      <View style={s.reviewHead}>
        <Text style={s.name}>{l.name}</Text>
        <View style={s.qty}><Text style={s.qtyText}>{l.qty}</Text></View>
      </View>
      <View style={s.choices}>
        <Choice state="available" label="Available" color={colors.primary} />
        <Choice state="partial" label="Partly" color={colors.amber} />
        <Choice state="unavailable" label="Not available" color={colors.danger} />
      </View>
      {asking || l.state === 'partial' ? (
        <View style={s.partialRow}>
          <TextInput style={s.partialInput} value={qty} onChangeText={setQty}
            placeholder="How much can you give? (e.g. 1 kg)" placeholderTextColor="#9ca3af" />
          <Button small title="Set" disabled={!qty.trim()} onPress={() => { onMark(l.id, 'partial', qty.trim()); setAsking(false); }} />
        </View>
      ) : null}
    </View>
  );
}

/** One line as a read-only row (customer view, or the shop once it has answered). */
function StatusLine({l, first, forOwner}: {l: Line; first: boolean; forOwner?: boolean}) {
  const partial = l.state === 'partial';
  const icon = l.state === 'unavailable' ? 'close-circle' : partial ? 'alert-circle' : l.state === 'pending' ? 'time' : 'checkmark-circle';
  const color = l.state === 'unavailable' ? colors.danger : partial ? colors.amber : l.state === 'pending' ? '#9ca3af' : colors.primary;
  return (
    <View style={[s.line, !first && s.lineBorder]}>
      <Icon name={icon} size={22} color={color} filled />
      <View style={{flex: 1}}>
        <Text style={[s.name, l.state === 'unavailable' && s.struck]}>{l.name}</Text>
        {l.state === 'unavailable' ? <Text style={[s.sublabel, {color: colors.danger}]}>Not available</Text> : null}
        {partial ? (
          <Text style={[s.sublabel, {color: '#b45309'}]}>
            Only {l.avail_qty} available
            {l.response === 'accepted' ? ' · accepted' : l.response === 'rejected' ? ' · declined' : ''}
          </Text>
        ) : null}
        {l.state === 'pending' && !forOwner ? <Text style={[s.sublabel, {color: colors.muted}]}>Waiting for the shop</Text> : null}
      </View>
      <View style={s.qty}><Text style={s.qtyText}>{l.qty}</Text></View>
    </View>
  );
}

/** 1 to 5 stars. Tap to choose (when `onPick` is given). */
export function Stars({value, onPick, size = 26}: {value: number; onPick?: (n: number) => void; size?: number}) {
  return (
    <View style={{flexDirection: 'row', gap: 4}}>
      {[1, 2, 3, 4, 5].map(n => (
        <Pressable key={n} disabled={!onPick} onPress={() => onPick?.(n)} hitSlop={4}>
          <Icon name="star" size={size} color={n <= value ? colors.amber : '#d1d5db'} filled={n <= value} />
        </Pressable>
      ))}
    </View>
  );
}

/**
 * One order.
 * Customers see the shop, a progress tracker, which items are available, and answer partial quantities.
 * The shop owner sees the customer, can call them, and marks each line while reviewing the order.
 */
export default function OrderCard({o, forOwner, onMark, onRespond, children}: {
  o: Order; forOwner?: boolean; onMark?: Mark;
  onRespond?: (decisions: Record<number, boolean>) => Promise<void> | void;
  children?: React.ReactNode;
}) {
  const reviewing = !!forOwner && ['New', 'Accepted'].includes(o.status);
  const who = forOwner ? o.customer_name : o.shop_name;
  const askedLines = o.items.filter(i => i.state === 'partial');
  const needsAnswer = !forOwner && o.status === 'Awaiting you';
  const [decisions, setDecisions] = useState<Record<number, boolean>>({});
  const [sending, setSending] = useState(false);
  const missing = o.items.filter(i => i.state === 'unavailable').length;

  const send = async () => {
    setSending(true);
    try { await onRespond?.(decisions); } finally { setSending(false); }
  };

  return (
    <View style={s.card}>
      <View style={s.head}>
        <Avatar name={who} size={44} />
        <View style={{flex: 1}}>
          <Text style={s.title} numberOfLines={1}>{who}</Text>
          <Text style={s.sub}>Order #{o.id}{o.code ? ` · ${o.code}` : ''} · {when(o.created_at)}</Text>
        </View>
        <StatusPill status={o.status} owner={forOwner} />
      </View>

      {forOwner ? (
        <Pressable onPress={() => Linking.openURL('tel:' + o.phone)} style={s.call}>
          <Icon name="call" size={16} color={colors.blue} />
          <Text style={s.callText}>{o.phone}</Text>
          <Text style={s.callHint}>Tap to call</Text>
        </Pressable>
      ) : (
        <Tracker status={o.status} />
      )}

      {reviewing ? (
        <Text style={s.hint}>Mark every item. Choose "Partly" if you have less than asked.</Text>
      ) : null}

      <View style={s.items}>
        {o.items.map((l, i) => reviewing
          ? <ReviewLine key={l.id} l={l} first={i === 0} onMark={(id, st, q) => onMark?.(id, st, q)} />
          : <StatusLine key={l.id} l={l} first={i === 0} forOwner={forOwner} />)}
      </View>

      {o.note ? (
        <View style={s.note}>
          <Icon name="document-text" size={16} color={colors.muted} />
          <Text style={s.noteText}>{o.note}</Text>
        </View>
      ) : null}

      {/* the customer decides about partial quantities */}
      {needsAnswer ? (
        <View style={s.ask}>
          <Text style={s.askTitle}>The shop can give you less than you asked</Text>
          {askedLines.map(l => (
            <View key={l.id} style={s.askRow}>
              <View style={{flex: 1}}>
                <Text style={s.askName}>{l.name}</Text>
                <Text style={s.askQty}>You asked {l.qty} · shop has {l.avail_qty}</Text>
              </View>
              <Pressable onPress={() => setDecisions(d => ({...d, [l.id]: true}))}
                style={[s.dec, decisions[l.id] === true && {backgroundColor: colors.primary, borderColor: colors.primary}]}>
                <Text style={[s.decText, decisions[l.id] === true && {color: '#fff'}]}>Accept</Text>
              </Pressable>
              <Pressable onPress={() => setDecisions(d => ({...d, [l.id]: false}))}
                style={[s.dec, decisions[l.id] === false && {backgroundColor: colors.danger, borderColor: colors.danger}]}>
                <Text style={[s.decText, decisions[l.id] === false && {color: '#fff'}]}>Skip</Text>
              </Pressable>
            </View>
          ))}
          <Button small title="Confirm my answer" loading={sending}
            disabled={askedLines.some(l => typeof decisions[l.id] !== 'boolean')} onPress={send} />
        </View>
      ) : null}

      {o.cancel_requested ? (
        <View style={s.warn}>
          <Icon name="alert-circle" size={20} color="#92400e" />
          <Text style={s.warnText}>{forOwner ? `${o.customer_name} asked to cancel this order.` : 'You asked the shop to cancel. Waiting for their reply.'}</Text>
        </View>
      ) : null}
      {!forOwner && o.status === 'Declined' && o.decline_reason ? (
        <View style={s.warn}>
          <Icon name="alert-circle" size={20} color="#92400e" />
          <Text style={s.warnText}>Reason: {o.decline_reason}</Text>
        </View>
      ) : null}
      {!forOwner && o.status === 'Preparing' ? (
        <View style={s.ready}>
          <Icon name="time" size={20} color={colors.primaryDark} />
          <Text style={s.readyText}>The shop is packing your items{o.eta_minutes ? `. Ready in about ${o.eta_minutes} min` : ''}. You will see here when it is ready.</Text>
        </View>
      ) : null}
      {!forOwner && o.status === 'Ready' ? (
        <View style={s.ready}>
          <Icon name="bag-check" size={20} color={colors.primaryDark} />
          <Text style={s.readyText}>
            Ready for pickup!{missing ? ` ${missing} item${missing > 1 ? 's were' : ' was'} not available.` : ''} Show code {o.code} at the counter, check the goods and pay at the shop. The final bill is confirmed there.
          </Text>
        </View>
      ) : null}
      {!forOwner && ['New', 'Accepted'].includes(o.status) && missing > 0 ? (
        <View style={s.warn}>
          <Icon name="alert-circle" size={20} color="#92400e" />
          <Text style={s.warnText}>{missing} item{missing > 1 ? 's are' : ' is'} not available at this shop.</Text>
        </View>
      ) : null}
      {children}
    </View>
  );
}

const s = StyleSheet.create({
  card: {
    backgroundColor: '#fff', borderRadius: 20, padding: 14, gap: 12,
    shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 8, shadowOffset: {width: 0, height: 3}, elevation: 2,
  },
  head: {flexDirection: 'row', alignItems: 'center', gap: 12},
  title: {fontSize: 13, fontWeight: '800', color: colors.text},
  sub: {fontSize: 12, color: colors.muted, marginTop: 2},
  call: {flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#eff6ff', borderRadius: 12, padding: 11},
  callText: {flex: 1, color: colors.blue, fontWeight: '800', fontSize: 13},
  callHint: {color: colors.blue, fontSize: 12, fontWeight: '600'},
  hint: {color: colors.muted, fontSize: 12},
  items: {backgroundColor: '#f9fafb', borderRadius: 14, paddingHorizontal: 12},
  line: {flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 11},
  lineBorder: {borderTopWidth: StyleSheet.hairlineWidth, borderColor: colors.border},
  name: {fontSize: 13, fontWeight: '700', color: colors.text, flexShrink: 1},
  struck: {textDecorationLine: 'line-through', color: '#9ca3af'},
  sublabel: {fontSize: 11, fontWeight: '700', marginTop: 1},
  qty: {backgroundColor: '#fff', borderWidth: 1, borderColor: colors.border, borderRadius: 10, paddingHorizontal: 9, paddingVertical: 3},
  qtyText: {fontSize: 12, fontWeight: '800', color: colors.muted},
  reviewLine: {paddingVertical: 11, gap: 9},
  reviewHead: {flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8},
  choices: {flexDirection: 'row', gap: 8},
  choice: {flex: 1, alignItems: 'center', paddingVertical: 8, borderRadius: 10, borderWidth: 1.5, borderColor: colors.border, backgroundColor: '#fff'},
  choiceText: {fontSize: 12, fontWeight: '800', color: colors.muted},
  partialRow: {flexDirection: 'row', alignItems: 'center', gap: 8},
  partialInput: {
    flex: 1, borderWidth: 1.5, borderColor: colors.border, borderRadius: 10, backgroundColor: '#fff',
    paddingHorizontal: 10, paddingVertical: 7, fontSize: 13, color: colors.text,
  },
  note: {flexDirection: 'row', alignItems: 'flex-start', gap: 8},
  noteText: {flex: 1, color: colors.muted, fontSize: 12},
  ask: {backgroundColor: '#fffbeb', borderRadius: 14, padding: 12, gap: 10},
  askTitle: {fontWeight: '800', color: '#92400e', fontSize: 13},
  askRow: {flexDirection: 'row', alignItems: 'center', gap: 8},
  askName: {fontWeight: '800', color: colors.text, fontSize: 13},
  askQty: {color: colors.muted, fontSize: 12, marginTop: 1},
  dec: {paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10, borderWidth: 1.5, borderColor: colors.border, backgroundColor: '#fff'},
  decText: {fontSize: 12, fontWeight: '800', color: colors.muted},
  ready: {flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: colors.primarySoft, borderRadius: 12, padding: 12},
  readyText: {flex: 1, color: colors.primaryDark, fontWeight: '800', fontSize: 12},
  warn: {flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: '#fffbeb', borderRadius: 12, padding: 12},
  warnText: {flex: 1, color: '#92400e', fontWeight: '700', fontSize: 12},
});
