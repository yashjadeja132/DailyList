import React, { useEffect, useState } from 'react';
import { api, dateOnly } from '../api.js';
import { IconBtn } from '../icons.jsx';
import Modal from '../Modal.jsx';

function SetPlan({ customer, plans, onClose, onSaved }) {
  const [planId, setPlanId] = useState(customer.subscription?.plan_id || plans[0]?.id || '');
  const [days, setDays] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const save = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      await api(`/admin/customers/${customer.id}/subscription`, 'POST', { plan_id: Number(planId), days: Number(days) || 0 });
      onSaved();
    } catch (err) { setError(err.message); setBusy(false); }
  };

  return (
    <Modal title="Set plan" subtitle={`${customer.name} (${customer.phone})`} onClose={onClose}>
      <form onSubmit={save}>
        {error ? <div className="error">{error}</div> : null}
        <div className="field">
          <label>Plan</label>
          <select value={planId} onChange={(e) => setPlanId(e.target.value)}>
            {plans.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name} · {p.max_orders_per_shop || '∞'} orders/shop · {p.max_shops || '∞'} shops{p.price > 0 ? ` · ₹${p.price}` : ' · free'}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label>Valid for (days, optional)</label>
          <input type="number" min="0" value={days} onChange={(e) => setDays(e.target.value)} placeholder="Leave empty to use the plan's own duration" />
        </div>
        <div className="row">
          <button type="button" className="ghost" onClick={onClose}>Cancel</button>
          <button className="btn" disabled={busy || !planId}>{busy ? 'Saving…' : 'Set plan'}</button>
        </div>
      </form>
    </Modal>
  );
}

export default function Customers() {
  const [rows, setRows] = useState(null);
  const [plans, setPlans] = useState([]);
  const [error, setError] = useState('');
  const [setFor, setSetFor] = useState(null);
  const [q, setQ] = useState('');

  const load = () => api('/admin/customers').then(setRows).catch((e) => setError(e.message));
  useEffect(() => {
    load();
    api('/admin/plans').then((p) => setPlans(p.filter((x) => x.audience === 'customer' && x.active))).catch(() => {});
  }, []);

  const toggleBlock = async (c) => {
    if (!window.confirm(`${c.blocked ? 'Unblock' : 'Block'} ${c.name} (${c.phone})?`)) return;
    try { await api(`/admin/users/${c.id}/block`, 'POST', { blocked: !c.blocked }); load(); } catch (e) { setError(e.message); }
  };
  const list = (rows || []).filter((c) => `${c.name} ${c.phone}`.toLowerCase().includes(q.toLowerCase()));

  return (
    <>
      <div className="page-head">
        <div><h1>Customers</h1><p className="sub">Everyone who ordered through the app</p></div>
        <input className="search" placeholder="Search name or phone"
          value={q} onChange={(e) => setQ(e.target.value)} />
      </div>
      {error ? <div className="error">{error}</div> : null}
      <div className="card table-wrap">
        <table>
          <thead><tr><th>Customer</th><th>Plan</th><th>Expires</th><th>Orders</th><th>Shops used</th><th>Not collected</th><th className="center">Actions</th></tr></thead>
          <tbody>
            {!rows ? <tr><td colSpan="7" className="empty">Loading…</td></tr> :
              list.length === 0 ? <tr><td colSpan="7" className="empty">No customers found.</td></tr> :
                list.map((c) => (
                  <tr key={c.id}>
                    <td data-label="Customer"><div><div className="strong">{c.name} {c.blocked ? <span className="badge red">blocked</span> : null}</div><div className="muted fine">{c.phone}</div></div></td>
                    <td data-label="Plan">{c.subscription ? <span className={`badge ${c.subscription.expires_at ? 'green' : ''}`}>{c.subscription.plan_name}</span> : '—'}</td>
                    <td data-label="Expires">{c.subscription ? dateOnly(c.subscription.expires_at) : '—'}</td>
                    <td data-label="Orders">{c.orders}</td>
                    <td data-label="Shops used">{c.shops}</td>
                    <td data-label="Not collected">{c.no_show_count ? <span className="badge amber">{c.no_show_count}</span> : 0}</td>
                    <td className="actions">
                      <IconBtn icon="ban" tone={c.blocked ? '' : 'danger'} title={c.blocked ? 'Unblock customer' : 'Block customer'} onClick={() => toggleBlock(c)} />
                      <IconBtn icon="plan" title="Set plan" onClick={() => setSetFor(c)} />
                    </td>
                  </tr>
                ))}
          </tbody>
        </table>
      </div>
      {setFor ? <SetPlan customer={setFor} plans={plans} onClose={() => setSetFor(null)} onSaved={() => { setSetFor(null); load(); }} /> : null}
    </>
  );
}
