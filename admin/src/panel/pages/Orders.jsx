import React, { useEffect, useState } from 'react';
import { api } from '../api.js';
import { IconBtn } from '../icons.jsx';
import Modal from '../Modal.jsx';

const when = (s) => (s ? new Date(s.replace(' ', 'T') + 'Z').toLocaleString() : '');
const tone = (s) => (['Picked up'].includes(s) ? 'green' : ['Cancelled', 'Declined', 'Expired'].includes(s) ? 'red' : 'amber');

function Detail({ id, onClose }) {
  const [o, setO] = useState(null);
  useEffect(() => { api(`/admin/orders/${id}`).then(setO).catch(() => setO(false)); }, [id]);
  return (
    <Modal title={`Order #${id}`} subtitle={o ? `${o.shop_name} · ${o.customer_name} (${o.phone}) · code ${o.code}` : ''} onClose={onClose}>
      {o === null ? <p className="muted">Loading…</p> : o === false ? <p className="error">Could not load.</p> : (
        <>
          <p><span className={`badge ${tone(o.status)}`}>{o.status}</span> {o.rating ? <span className="badge">★ {o.rating}</span> : null}</p>
          <h3>Items</h3>
          <table><tbody>
            {o.items.map((i, k) => (
              <tr key={k}><td className="strong">{i.name}</td><td>{i.qty}</td>
                <td>{i.state}{i.state === 'partial' ? ` (${i.avail_qty}${i.response ? ', ' + i.response : ''})` : ''}</td></tr>
            ))}
          </tbody></table>
          {o.note ? <p className="muted">Note: {o.note}</p> : null}
          <h3 style={{ marginTop: 16 }}>History</h3>
          <table><tbody>
            {o.events.map((e, k) => (
              <tr key={k}><td className="muted fine">{when(e.at)}</td><td>{e.actor}</td><td>{e.event}{e.detail ? ` · ${e.detail}` : ''}</td></tr>
            ))}
          </tbody></table>
        </>
      )}
      <div className="row"><button className="ghost" onClick={onClose}>Close</button></div>
    </Modal>
  );
}

export default function Orders() {
  const [q, setQ] = useState('');
  const [rows, setRows] = useState(null);
  const [open, setOpen] = useState(null);
  const [error, setError] = useState('');
  useEffect(() => {
    const t = setTimeout(() => api(`/admin/orders?q=${encodeURIComponent(q)}`).then(setRows).catch((e) => setError(e.message)), 250);
    return () => clearTimeout(t);
  }, [q]);
  return (
    <>
      <div className="page-head">
        <div><h1>Orders</h1><p className="sub">Find an order for support: number, pickup code, phone, name or shop</p></div>
        <input className="search" placeholder="Search" value={q} onChange={(e) => setQ(e.target.value)} />
      </div>
      {error ? <div className="error">{error}</div> : null}
      <div className="card table-wrap">
        <table>
          <thead><tr><th>#</th><th>Code</th><th>Shop</th><th>Customer</th><th>Status</th><th>Placed</th><th className="center">Actions</th></tr></thead>
          <tbody>
            {!rows ? <tr><td colSpan="7" className="empty">Loading…</td></tr> :
              rows.length === 0 ? <tr><td colSpan="7" className="empty">No orders found.</td></tr> :
                rows.map((o) => (
                  <tr key={o.id}>
                    <td data-label="#">{o.id}</td>
                    <td data-label="Code" className="strong">{o.code}</td>
                    <td data-label="Shop">{o.shop_name}</td>
                    <td data-label="Customer"><div>{o.customer_name}<div className="muted fine">{o.phone}</div></div></td>
                    <td data-label="Status"><span className={`badge ${tone(o.status)}`}>{o.status}</span></td>
                    <td data-label="Placed">{when(o.created_at)}</td>
                    <td className="actions"><IconBtn icon="eye" title="View order and history" onClick={() => setOpen(o.id)} /></td>
                  </tr>
                ))}
          </tbody>
        </table>
      </div>
      {open ? <Detail id={open} onClose={() => setOpen(null)} /> : null}
    </>
  );
}
