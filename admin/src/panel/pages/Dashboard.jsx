import React, { useEffect, useState } from 'react';
import { api, money } from '../api.js';

const pct = (v) => (v === null || v === undefined ? '—' : `${v}%`);

function Cards({ items }) {
  return (
    <div className="cards">
      {items.map(([ic, num, lbl], i) => (
        <div className="card stat" key={i}>
          <div className="ic">{ic}</div>
          <div className="num">{num}</div>
          <div className="lbl">{lbl}</div>
        </div>
      ))}
    </div>
  );
}

export default function Dashboard() {
  const [s, setS] = useState(null);
  const [r, setR] = useState(null);
  const [days, setDays] = useState(30);
  const [error, setError] = useState('');

  useEffect(() => { api('/admin/stats').then(setS).catch((e) => setError(e.message)); }, []);
  useEffect(() => { setR(null); api(`/admin/reports?days=${days}`).then(setR).catch((e) => setError(e.message)); }, [days]);

  return (
    <>
      <div className="page-head">
        <div><h1>Dashboard</h1><p className="sub">How DailyList is doing</p></div>
      </div>
      {error ? <div className="error">{error}</div> : null}

      <h2 className="section-title">Overview</h2>
      {!s && !error ? <p className="muted">Loading…</p> : null}
      {s ? (
        <Cards items={[
          ['▣', s.shops, 'Shops registered'],
          ['☺', s.customers, 'Customers'],
          ['▤', s.orders, 'Orders (all time)'],
          ['₹', money(s.revenue_30d), 'Plan revenue (30 days)'],
        ]} />
      ) : null}

      <div className="page-head" style={{ marginTop: 8 }}>
        <h2 className="section-title" style={{ margin: 0 }}>Performance</h2>
        <select className="search" value={days} onChange={(e) => setDays(Number(e.target.value))}>
          <option value="7">Last 7 days</option><option value="30">Last 30 days</option><option value="90">Last 90 days</option>
        </select>
      </div>
      {r ? (
        <Cards items={[
          ['▤', r.orders, 'Orders'],
          ['✓', pct(r.completion_rate), 'Collected (completion rate)'],
          ['⏱', r.median_response_minutes === null ? '—' : `${r.median_response_minutes} min`, 'Median shop response time'],
          ['✕', r.declined + r.expired, 'Declined or expired'],
          ['⚐', r.no_shows, 'Not collected'],
          ['★', r.avg_rating ?? '—', 'Average rating'],
          ['…', r.pending_shops, 'Shops waiting for approval'],
          ['⚑', r.open_complaints, 'Open complaints'],
        ]} />
      ) : <p className="muted">Loading…</p>}
    </>
  );
}
