import React, { useEffect, useState } from 'react';
import { api } from '../api.js';
import { IconBtn } from '../icons.jsx';

const when = (s) => (s ? new Date(s.replace(' ', 'T') + 'Z').toLocaleString() : '');

export default function Complaints() {
  const [status, setStatus] = useState('open');
  const [rows, setRows] = useState(null);
  const [error, setError] = useState('');
  const load = () => api(`/admin/complaints?status=${status}`).then(setRows).catch((e) => setError(e.message));
  useEffect(() => { setRows(null); load(); }, [status]); // eslint-disable-line react-hooks/exhaustive-deps

  const act = async (c, next) => {
    const note = window.prompt('Note about how this was handled (optional):', c.note || '');
    if (note === null) return;
    try { await api(`/admin/complaints/${c.id}`, 'PUT', { status: next, note }); load(); } catch (e) { setError(e.message); }
  };

  return (
    <>
      <div className="page-head">
        <div><h1>Complaints</h1><p className="sub">Problems reported by customers and shops</p></div>
        <select className="search" value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="open">Open</option><option value="resolved">Resolved</option><option value="dismissed">Dismissed</option>
        </select>
      </div>
      {error ? <div className="error">{error}</div> : null}
      <div className="card table-wrap">
        <table>
          <thead><tr><th>From</th><th>About</th><th>Order</th><th>Problem</th><th>When</th><th className="center">Actions</th></tr></thead>
          <tbody>
            {!rows ? <tr><td colSpan="6" className="empty">Loading…</td></tr> :
              rows.length === 0 ? <tr><td colSpan="6" className="empty">Nothing here.</td></tr> :
                rows.map((c) => (
                  <tr key={c.id}>
                    <td data-label="From"><div className="strong">{c.user_name}<div className="muted fine">{c.user_phone} · {c.user_role}</div></div></td>
                    <td data-label="About">{c.about}{c.shop_name ? ` · ${c.shop_name}` : ''}</td>
                    <td data-label="Order">{c.order_id ? `#${c.order_id}` : '—'}</td>
                    <td data-label="Problem"><div>{c.text}{c.note ? <div className="muted fine">Note: {c.note}</div> : null}</div></td>
                    <td data-label="When">{when(c.created_at)}</td>
                    <td className="actions">
                      {c.status === 'open' ? (
                        <>
                          <IconBtn icon="check" tone="ok" title="Mark as resolved" onClick={() => act(c, 'resolved')} />
                          <IconBtn icon="x" title="Dismiss" onClick={() => act(c, 'dismissed')} />
                        </>
                      ) : <IconBtn icon="undo" title="Reopen" onClick={() => act(c, 'open')} />}
                    </td>
                  </tr>
                ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
