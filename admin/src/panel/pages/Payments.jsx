import React, { useEffect, useState } from 'react';
import { api, money, when } from '../api.js';

export default function Payments() {
  const [rows, setRows] = useState(null);
  const [error, setError] = useState('');
  useEffect(() => { api('/admin/payments').then(setRows).catch((e) => setError(e.message)); }, []);

  const total = (rows || []).reduce((n, r) => n + (r.status === 'paid' ? r.amount : 0), 0);

  return (
    <>
      <div className="page-head">
        <div><h1>Payments</h1><p className="sub">Plan purchases{rows ? ` · total ${money(total)}` : ''}</p></div>
      </div>
      {error ? <div className="error">{error}</div> : null}
      <div className="card table-wrap">
        <table>
          <thead><tr><th>Date</th><th>Who</th><th>Type</th><th>Plan</th><th>Amount</th><th>Method</th><th>Status</th></tr></thead>
          <tbody>
            {!rows ? <tr><td colSpan="7" className="empty">Loading…</td></tr> :
              rows.length === 0 ? <tr><td colSpan="7" className="empty">No payments yet.</td></tr> :
                rows.map((r) => (
                  <tr key={r.id}>
                    <td data-label="Date">{when(r.created_at)}</td>
                    <td data-label="Who">
                      <div>
                        <div className="strong">{r.shop_name || r.user_name}</div>
                        <div className="muted fine">{r.user_name} · {r.user_phone}</div>
                      </div>
                    </td>
                    <td data-label="Type"><span className={`badge ${r.audience === 'owner' ? 'blue' : ''}`}>{r.audience === 'owner' ? 'Shop owner' : 'Customer'}</span></td>
                    <td data-label="Plan">{r.plan_name}</td>
                    <td className="strong" data-label="Amount">{money(r.amount)}</td>
                    <td data-label="Method">{r.method === 'mock' ? <span className="badge amber">Test payment</span> : r.method}</td>
                    <td data-label="Status"><span className="badge green">{r.status}</span></td>
                  </tr>
                ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
