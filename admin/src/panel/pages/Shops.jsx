import React, { useEffect, useState } from 'react';
import { api, dateOnly } from '../api.js';
import { IconBtn } from '../icons.jsx';
import Modal from '../Modal.jsx';

function SetPlan({ shop, plans, onClose, onSaved }) {
  const [planId, setPlanId] = useState(plans[0]?.id || '');
  const [days, setDays] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const save = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      await api(`/admin/shops/${shop.id}/subscription`, 'POST', { plan_id: Number(planId), days: Number(days) || 0 });
      onSaved();
    } catch (err) { setError(err.message); setBusy(false); }
  };

  return (
    <Modal title="Set plan" subtitle={`${shop.name} · ${shop.owner_name} (${shop.owner_phone})`} onClose={onClose}>
      <form onSubmit={save}>
        {error ? <div className="error">{error}</div> : null}
        <div className="field">
          <label>Plan</label>
          <select value={planId} onChange={(e) => setPlanId(e.target.value)}>
            {plans.map((p) => <option key={p.id} value={p.id}>{p.name} · up to {p.max_users} user{p.max_users > 1 ? 's' : ''}{p.price > 0 ? ` · ₹${p.price}` : ' · free'}</option>)}
          </select>
        </div>
        <div className="field">
          <label>Valid for (days, optional)</label>
          <input type="number" min="0" value={days} onChange={(e) => setDays(e.target.value)} placeholder="Leave empty to use the plan's own duration" />
          <div className="hint">Use this to give a free trial or extend a shop without a payment.</div>
        </div>
        <div className="row">
          <button type="button" className="ghost" onClick={onClose}>Cancel</button>
          <button className="btn" disabled={busy || !planId}>{busy ? 'Saving…' : 'Set plan'}</button>
        </div>
      </form>
    </Modal>
  );
}

function Team({ shop, onClose }) {
  const [members, setMembers] = useState(null);
  useEffect(() => { api(`/admin/shops/${shop.id}/team`).then(setMembers).catch(() => setMembers([])); }, [shop.id]);
  return (
    <Modal title="Team" subtitle={`Phones using the ${shop.name} account`} onClose={onClose}>
      {!members ? <p className="muted">Loading…</p> : (
        <table>
          <tbody>
            {members.map((m) => (
              <tr key={m.id}>
                <td className="strong">{m.name}</td>
                <td>{m.phone}</td>
                <td>{m.is_primary ? <span className="badge green">Main owner</span> : <span className="badge">Team member</span>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      <div className="row"><button className="ghost" onClick={onClose}>Close</button></div>
    </Modal>
  );
}

export default function Shops() {
  const [shops, setShops] = useState(null);
  const [plans, setPlans] = useState([]);
  const [error, setError] = useState('');
  const [setFor, setSetFor] = useState(null);
  const [teamFor, setTeamFor] = useState(null);
  const [q, setQ] = useState('');

  const load = () => api('/admin/shops').then(setShops).catch((e) => setError(e.message));
  useEffect(() => {
    load();
    api('/admin/plans').then((p) => setPlans(p.filter((x) => x.audience === 'owner' && x.active))).catch(() => {});
  }, []);

  const cancel = async (s) => {
    if (!window.confirm(`Cancel the plan of "${s.name}"?\n\nThe shop will be hidden from customers until it buys or is given a plan.`)) return;
    try { await api(`/admin/shops/${s.id}/subscription`, 'DELETE'); load(); } catch (e) { setError(e.message); }
  };

  const review = async (s, approval) => {
    const note = approval === 'approved' ? '' : window.prompt(`${approval === 'suspended' ? 'Suspend' : 'Reject'} "${s.name}". Reason shown to the owner (optional):`, '');
    if (note === null) return;
    try { await api(`/admin/shops/${s.id}/approval`, 'PUT', { approval, note }); load(); } catch (e) { setError(e.message); }
  };
  const block = async (s) => {
    if (!window.confirm(`${s.owner_blocked ? 'Unblock' : 'Block'} the owner ${s.owner_name}?`)) return;
    try { await api(`/admin/users/${s.owner_id}/block`, 'POST', { blocked: !s.owner_blocked }); load(); } catch (e) { setError(e.message); }
  };

  const list = (shops || []).filter((s) =>
    `${s.name} ${s.owner_name} ${s.owner_phone} ${s.address}`.toLowerCase().includes(q.toLowerCase()));

  return (
    <>
      <div className="page-head">
        <div><h1>Shop owners</h1><p className="sub">Registered shops and their plans</p></div>
        <input className="search" placeholder="Search name, phone, address"
          value={q} onChange={(e) => setQ(e.target.value)} />
      </div>
      {error ? <div className="error">{error}</div> : null}
      <div className="card table-wrap">
        <table>
          <thead>
            <tr><th>Shop</th><th>Owner</th><th>Review</th><th>Plan</th><th>Expires</th><th>Team</th><th>Orders</th><th className="center">Actions</th></tr>
          </thead>
          <tbody>
            {!shops ? <tr><td colSpan="8" className="empty">Loading…</td></tr> :
              list.length === 0 ? <tr><td colSpan="8" className="empty">No shops found.</td></tr> :
                list.map((s) => (
                  <tr key={s.id}>
                    <td data-label="Shop">
                      <div className="strong">{s.name}</div>
                      <div className="muted" style={{ fontSize: 12 }}>{s.address || 'No address'} {s.has_location ? '· 📍' : ''}</div>
                    </td>
                    <td data-label="Owner"><div>{s.owner_name}<div className="muted fine">{s.owner_phone}</div></div></td>
                    <td data-label="Review">
                      <span className={`badge ${s.approval === 'approved' ? 'green' : s.approval === 'pending' ? 'amber' : 'red'}`}>{s.approval}</span>
                      {s.owner_blocked ? <span className="badge red" style={{ marginLeft: 6 }}>blocked</span> : null}
                      {s.approval_note ? <div className="muted fine">{s.approval_note}</div> : null}
                    </td>
                    <td data-label="Plan">
                      {s.subscription ? <span className="badge green">{s.subscription.plan_name}</span> : <span className="badge red">No plan</span>}
                    </td>
                    <td data-label="Expires"><span>{s.subscription ? dateOnly(s.subscription.expires_at) : '—'}
                      {s.subscription?.days_left != null && s.subscription.days_left <= 7 ? <span className="badge amber" style={{ marginLeft: 6 }}>{s.subscription.days_left}d left</span> : null}</span>
                    </td>
                    <td data-label="Team">
                      <button className="btn small outline" onClick={() => setTeamFor(s)}>
                        {s.members}{s.subscription ? ` / ${s.subscription.max_users}` : ''} users
                      </button>
                    </td>
                    <td data-label="Orders">{s.orders}</td>
                    <td className="actions">
                      {s.approval !== 'approved' ? <IconBtn icon="check" tone="ok" title="Approve shop" onClick={() => review(s, 'approved')} /> : null}
                      {s.approval === 'pending' ? <IconBtn icon="x" tone="danger" title="Reject shop" onClick={() => review(s, 'rejected')} /> : null}
                      {s.approval === 'approved' ? <IconBtn icon="pause" tone="danger" title="Suspend shop" onClick={() => review(s, 'suspended')} /> : null}
                      <IconBtn icon="ban" tone={s.owner_blocked ? '' : 'danger'} title={s.owner_blocked ? 'Unblock owner' : 'Block owner'} onClick={() => block(s)} />
                      <IconBtn icon="plan" title="Set plan" onClick={() => setSetFor(s)} />
                      {s.subscription ? <IconBtn icon="planoff" tone="danger" title="Cancel plan" onClick={() => cancel(s)} /> : null}
                    </td>
                  </tr>
                ))}
          </tbody>
        </table>
      </div>
      {setFor ? <SetPlan shop={setFor} plans={plans} onClose={() => setSetFor(null)} onSaved={() => { setSetFor(null); load(); }} /> : null}
      {teamFor ? <Team shop={teamFor} onClose={() => setTeamFor(null)} /> : null}
    </>
  );
}
