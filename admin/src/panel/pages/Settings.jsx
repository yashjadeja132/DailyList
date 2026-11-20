import React, { useEffect, useState } from 'react';
import { api } from '../api.js';

const GROUPS = [
  ['Download links', 'Shown on the public website.', [
    ['apk_url', 'Android download link (APK)', 'https://…/dailylist.apk', 'Leave empty to hide this button.'],
    ['play_store_url', 'Google Play link', 'https://play.google.com/store/apps/details?id=com.dailylist', 'Shows a Google Play button when filled.'],
    ['app_version', 'App version', '1.0.0', 'Shown next to the download button.'],
  ]],
  ['Contact', 'Shown in the website footer and in the Privacy Policy and Terms.', [
    ['support_email', 'Contact email', 'help@example.com', 'Leave empty to hide.'],
    ['support_phone', 'Contact phone', '+91 98765 43210', 'Leave empty to hide.'],
  ]],
  ['Order timing rules', 'How long people have to answer and to collect.', [
    ['shop_response_minutes', 'Shop response time (minutes)', '30', 'A new order the shop does not accept or decline in this time expires.'],
    ['customer_response_minutes', 'Customer response time (minutes)', '60', 'An order waiting for the customer to accept changed quantities expires after this time.'],
    ['pickup_window_minutes', 'Pickup window (minutes)', '240', 'After this time a ready order that was not collected can be marked as not collected.'],
    ['pickup_reminder_minutes', 'Pickup reminder (minutes)', '120', 'The customer gets a reminder this long after the order became ready.'],
  ]],
];

export default function Settings() {
  const [f, setF] = useState(null);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => { api('/admin/settings').then(setF).catch((e) => setError(e.message)); }, []);

  const save = async (e) => {
    e.preventDefault();
    setBusy(true); setError(''); setSaved(false);
    try { setF(await api('/admin/settings', 'PUT', f)); setSaved(true); }
    catch (err) { setError(err.message); }
    finally { setBusy(false); }
  };

  return (
    <>
      <div className="page-head">
        <div><h1>Settings</h1><p className="sub">Website details and order rules</p></div>
        <a className="btn outline" href="/" target="_blank" rel="noreferrer">Open website ↗</a>
      </div>
      {error ? <div className="error">{error}</div> : null}
      {saved ? <div className="notice">Saved.</div> : null}
      {!f ? <p className="muted">Loading…</p> : (
        <form className="settings-grid" onSubmit={save}>
          {GROUPS.map(([title, hint, fields]) => (
            <div className="card form-card" key={title}>
              <h2 className="section-title">{title}</h2>
              <p className="sub" style={{ marginTop: -6, marginBottom: 14 }}>{hint}</p>
              {fields.map(([key, label, ph, h]) => (
                <div className="field" key={key}>
                  <label>{label}</label>
                  <input value={f[key] || ''} placeholder={ph} onChange={(e) => setF({ ...f, [key]: e.target.value })} />
                  <div className="hint">{h}</div>
                </div>
              ))}
            </div>
          ))}
          <div><button className="btn" disabled={busy}>{busy ? 'Saving…' : 'Save settings'}</button></div>
        </form>
      )}
    </>
  );
}
