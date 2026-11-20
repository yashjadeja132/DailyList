import React, { useEffect, useState } from 'react';
import { api, money, unlimited } from '../api.js';
import { IconBtn } from '../icons.jsx';
import Modal from '../Modal.jsx';

const blank = (audience) => ({
  audience,
  name: '',
  description: '',
  price: '0',
  duration_days: audience === 'owner' ? '30' : '30',
  max_users: '1',
  max_orders_per_shop: '0',
  max_shops: '0',
  is_default: false,
  active: true,
  sort: '0',
});

function PlanForm({ plan, onClose, onSaved }) {
  const [f, setF] = useState(
    plan.id
      ? { ...plan, price: String(plan.price), duration_days: String(plan.duration_days), max_users: String(plan.max_users),
          max_orders_per_shop: String(plan.max_orders_per_shop), max_shops: String(plan.max_shops), sort: String(plan.sort),
          is_default: !!plan.is_default, active: !!plan.active }
      : plan
  );
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const owner = f.audience === 'owner';
  const set = (k) => (e) => setF({ ...f, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value });

  const save = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      const body = {
        ...f,
        price: Number(f.price) || 0,
        duration_days: Number(f.duration_days) || 0,
        max_users: Number(f.max_users) || 1,
        max_orders_per_shop: Number(f.max_orders_per_shop) || 0,
        max_shops: Number(f.max_shops) || 0,
        sort: Number(f.sort) || 0,
      };
      await (plan.id ? api('/admin/plans/' + plan.id, 'PUT', body) : api('/admin/plans', 'POST', body));
      onSaved();
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  };

  return (
    <Modal
      title={plan.id ? 'Edit plan' : owner ? 'New shop owner plan' : 'New customer plan'}
      subtitle={owner ? 'Shop owners must buy a plan after creating their account.' : 'Customers can use the app with the free default plan, or upgrade.'}
      onClose={onClose}>
      <form onSubmit={save}>
        {error ? <div className="error">{error}</div> : null}
        <div className="field">
          <label>Plan name</label>
          <input value={f.name} onChange={set('name')} placeholder={owner ? 'e.g. Shop Plus' : 'e.g. Unlimited'} autoFocus />
        </div>
        <div className="field">
          <label>Description (shown in the app)</label>
          <input value={f.description} onChange={set('description')} placeholder="One short line" />
        </div>
        <div className="grid2">
          <div className="field">
            <label>Price (₹)</label>
            <input type="number" min="0" step="1" value={f.price} onChange={set('price')} />
            <div className="hint">0 = free</div>
          </div>
          <div className="field">
            <label>Duration (days)</label>
            <input type="number" min="0" step="1" value={f.duration_days} onChange={set('duration_days')} />
            <div className="hint">0 = never expires</div>
          </div>
        </div>

        {owner ? (
          <div className="field">
            <label>Users per shop account</label>
            <input type="number" min="1" step="1" value={f.max_users} onChange={set('max_users')} />
            <div className="hint">How many phone numbers can use the same shop account (the owner counts as 1).</div>
          </div>
        ) : (
          <>
            <div className="grid2">
              <div className="field">
                <label>Orders per shop</label>
                <input type="number" min="0" step="1" value={f.max_orders_per_shop} onChange={set('max_orders_per_shop')} />
                <div className="hint">Per billing cycle. 0 = unlimited.</div>
              </div>
              <div className="field">
                <label>Shops they can order from</label>
                <input type="number" min="0" step="1" value={f.max_shops} onChange={set('max_shops')} />
                <div className="hint">Per billing cycle. 0 = unlimited.</div>
              </div>
            </div>
            <label className="check">
              <input type="checkbox" checked={f.is_default} onChange={set('is_default')} />
              Default plan: given to every new customer (must be free)
            </label>
          </>
        )}

        <div className="grid2">
          <div className="field">
            <label>Sort order</label>
            <input type="number" step="1" value={f.sort} onChange={set('sort')} />
            <div className="hint">Smaller numbers show first.</div>
          </div>
          <label className="check" style={{ alignSelf: 'center', marginTop: 8 }}>
            <input type="checkbox" checked={f.active} onChange={set('active')} />
            Active (visible in the app)
          </label>
        </div>

        <div className="row">
          <button type="button" className="ghost" onClick={onClose}>Cancel</button>
          <button className="btn" disabled={busy}>{busy ? 'Saving…' : 'Save plan'}</button>
        </div>
      </form>
    </Modal>
  );
}

export default function Plans() {
  const [tab, setTab] = useState('owner');
  const [plans, setPlans] = useState(null);
  const [error, setError] = useState('');
  const [edit, setEdit] = useState(null);
  const [msg, setMsg] = useState('');

  const load = () => api('/admin/plans').then(setPlans).catch((e) => setError(e.message));
  useEffect(() => { load(); }, []);

  const remove = async (p) => {
    if (!window.confirm(`Delete "${p.name}"?\n\nIf people already used this plan it will only be hidden.`)) return;
    try {
      const r = await api('/admin/plans/' + p.id, 'DELETE');
      setMsg(r.deactivated ? `"${p.name}" is in use, so it was hidden instead of deleted.` : `"${p.name}" deleted.`);
      load();
    } catch (e) { setError(e.message); }
  };

  const shown = (plans || []).filter((p) => p.audience === tab);

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Billing plans</h1>
          <p className="sub">Plans for shop owners and customers. Changes show in the app right away.</p>
        </div>
        <button className="btn" onClick={() => setEdit(blank(tab))}>+ Add {tab === 'owner' ? 'shop owner' : 'customer'} plan</button>
      </div>

      <div className="tabs">
        <button className={tab === 'owner' ? 'on' : ''} onClick={() => setTab('owner')}>Shop owner plans</button>
        <button className={tab === 'customer' ? 'on' : ''} onClick={() => setTab('customer')}>Customer plans</button>
      </div>

      {error ? <div className="error">{error}</div> : null}
      {msg ? <div className="notice">{msg}</div> : null}

      <div className="card table-wrap">
        <table>
          <thead>
            <tr>
              <th>Plan</th>
              <th>Price</th>
              <th>Duration</th>
              {tab === 'owner' ? <th>Users per shop</th> : <><th>Orders / shop</th><th>Shops</th></>}
              <th>Subscribers</th>
              <th>Status</th>
              <th className="center">Actions</th>
            </tr>
          </thead>
          <tbody>
            {!plans ? <tr><td colSpan="8" className="empty">Loading…</td></tr> :
              shown.length === 0 ? <tr><td colSpan="8" className="empty">No plans yet. Add the first one.</td></tr> :
                shown.map((p) => (
                  <tr key={p.id}>
                    <td data-label="Plan">
                      <div className="strong">{p.name} {p.is_default ? <span className="badge blue">Default</span> : null}</div>
                      <div className="muted" style={{ fontSize: 12 }}>{p.description}</div>
                    </td>
                    <td className="strong" data-label="Price">{p.price > 0 ? money(p.price) : 'Free'}</td>
                    <td data-label="Duration">{p.duration_days > 0 ? `${p.duration_days} days` : 'No expiry'}</td>
                    {tab === 'owner' ? <td data-label="Users per shop">{p.max_users}</td> : <><td data-label="Orders / shop">{unlimited(p.max_orders_per_shop)}</td><td data-label="Shops">{unlimited(p.max_shops)}</td></>}
                    <td data-label="Subscribers">{p.subscribers}</td>
                    <td data-label="Status">{p.active ? <span className="badge green">Active</span> : <span className="badge">Hidden</span>}</td>
                    <td className="actions">
                      <IconBtn icon="edit" title="Edit plan" onClick={() => setEdit(p)} />
                      <IconBtn icon="trash" tone="danger" title="Delete plan" onClick={() => remove(p)} />
                    </td>
                  </tr>
                ))}
          </tbody>
        </table>
      </div>

      {edit ? <PlanForm plan={edit} onClose={() => setEdit(null)} onSaved={() => { setEdit(null); setMsg('Plan saved.'); load(); }} /> : null}
    </>
  );
}
