import React, { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { BASE, DownloadButtons, money, plural } from './shared.jsx';

const Check = () => (
  <svg viewBox="0 0 24 24" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <circle cx="12" cy="12" r="9" /><path d="m8 12 3 3 5-6" />
  </svg>
);

// What a plan includes (same wording as the app).
function features(p, kind) {
  if (kind === 'owner') {
    return [
      `Up to ${plural(p.max_users, 'phone')} can use one shop account`,
      'Receive and manage all customer orders',
      'Shown to nearby customers',
      p.duration_days > 0 ? `Valid for ${plural(p.duration_days, 'day')}` : 'No expiry',
    ];
  }
  return [
    p.max_orders_per_shop > 0 ? `${plural(p.max_orders_per_shop, 'order')} per shop` : 'Unlimited orders per shop',
    p.max_shops > 0 ? `Order from ${plural(p.max_shops, 'shop')}` : 'Order from any number of shops',
    p.duration_days > 0 ? `Valid for ${plural(p.duration_days, 'day')}` : 'Free, limits renew every 30 days',
    'Pay at the shop when you pick up',
  ];
}

export default function Pricing({ info }) {
  const location = useLocation();
  const [tab, setTab] = useState(location.state?.tab === 'owner' ? 'owner' : 'customer');
  const [data, setData] = useState(null); // { customer: [], owner: [] }
  const [failed, setFailed] = useState(false);

  useEffect(() => { document.title = 'Plans - DailyList'; }, []);
  useEffect(() => {
    fetch(BASE + '/public/plans').then((r) => r.json()).then(setData).catch(() => setFailed(true));
  }, []);

  const list = data ? data[tab] : [];
  const featured = list.length >= 3 ? 1 : -1; // the middle plan is highlighted when there are three or more

  return (
    <>
      <div className="banner">
        <div className="wrap">
          <h1>Simple plans for everyone</h1>
          <p>Customers start free. Shop owners pick a plan after signing up, based on how many phones need to use the shop account.</p>
        </div>
      </div>

      <section>
        <div className="wrap">
          <div className="tabs">
            <div className="seg" role="tablist">
              <button className={tab === 'customer' ? 'on' : ''} role="tab" onClick={() => setTab('customer')}>For customers</button>
              <button className={tab === 'owner' ? 'on' : ''} role="tab" onClick={() => setTab('owner')}>For shop owners</button>
            </div>
          </div>
          <p className="tab-note">
            {tab === 'customer'
              ? 'Send your list to nearby shops. The limits below apply to each billing cycle.'
              : 'Choose how many phones can share your shop account, for example you and your staff.'}
          </p>

          <div className="plans">
            {failed ? <div className="empty-box" style={{ gridColumn: '1 / -1' }}>Could not load the plans. Please try again.</div> :
              !data ? <div className="empty-box" style={{ gridColumn: '1 / -1' }}>Loading plans…</div> :
                list.length === 0 ? <div className="empty-box" style={{ gridColumn: '1 / -1' }}>Plans will be shown here soon.</div> :
                  list.map((p, i) => {
                    const free = !(p.price > 0);
                    const isFeat = i === featured;
                    return (
                      <div className={`card plan${isFeat ? ' feat' : ''}`} key={p.id}>
                        <div className="top-row">
                          <h3>{p.name}</h3>
                          {p.is_default ? <span className="badge">Starts here</span> : isFeat ? <span className="badge">Popular</span> : null}
                        </div>
                        <div className="price">
                          <b>{free ? 'Free' : money(p.price)}</b>
                          {!free && p.duration_days > 0 ? <span>/ {plural(p.duration_days, 'day')}</span> : null}
                        </div>
                        <p className="desc">{p.description}</p>
                        <ul>
                          {features(p, tab).map((f) => <li key={f}><Check /><span>{f}</span></li>)}
                        </ul>
                        <a className={`btn ${isFeat ? 'green' : 'dark'}`} href="/#download">
                          {tab === 'owner' ? 'Get the app to start' : 'Get the app'}
                        </a>
                      </div>
                    );
                  })}
          </div>

          <div className="facts">
            <div className="card"><h3>Customers</h3><p>Everyone starts on a free plan automatically. Upgrade inside the app any time for more orders and more shops.</p></div>
            <div className="card"><h3>Shop owners</h3><p>A plan is needed to receive orders. Your shop shows to nearby customers while your plan is active.</p></div>
            <div className="card"><h3>Where to buy</h3><p>Plans are chosen inside the DailyList app after you create your account. There is nothing to pay on this website.</p></div>
          </div>
        </div>
      </section>

      <section className="alt" id="download-plans">
        <div className="wrap" style={{ textAlign: 'center' }}>
          <h2>Ready to start?</h2>
          <p className="sub" style={{ marginBottom: 24 }}>Download the app, sign up with your phone number and pick a plan.</p>
          <div className="btns" style={{ justifyContent: 'center' }}><DownloadButtons info={info} dim /></div>
        </div>
      </section>
    </>
  );
}
