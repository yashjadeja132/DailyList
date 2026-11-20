import React, { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { DownloadButtons, telHref } from './shared.jsx';

const Icon = ({ children }) => (
  <div className="ic">
    <svg viewBox="0 0 24 24" fill="none" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">{children}</svg>
  </div>
);


/** A short summary of the plans for one kind of user, with a button to see them all. */
function PlanSummary({ kind }) {
  const owner = kind === 'owner';
  return (
    <div className="card plan-sum">
      <Icon>
        {owner
          ? <><path d="M3 9l1.5-5h15L21 9" /><path d="M4 9v11h16V9" /><path d="M3 9a3 3 0 0 0 6 0 3 3 0 0 0 6 0 3 3 0 0 0 6 0" /><path d="M10 20v-6h4v6" /></>
          : <><path d="M6 8h12l-1 12H7L6 8Z" /><path d="M9 8a3 3 0 0 1 6 0" /></>}
      </Icon>
      <h3 className="big">{owner ? 'For shop owners' : 'For customers'}</h3>
      <p className="sum-lead">
        {owner
          ? 'Choose a plan after you sign up. Bigger plans let more phones share the shop account.'
          : 'Start on the free plan and upgrade when you need more orders or more shops.'}
      </p>
      <Link className="btn green" to="/pricing" state={{ tab: kind }}>Explore more</Link>
    </div>
  );
}

export default function Home({ info }) {
  useEffect(() => { document.title = 'DailyList - Your everyday shopping, simplified.'; }, []);

  return (
    <>
      <div className="hero">
        <div className="wrap">
          <div>
            <span className="pill">Shop owners &amp; customers</span>
            <h1>Your everyday shopping,<br />simplified.</h1>
            <p className="lead">Send your list to a nearby shop before you go. They check it and pack it, you walk in, pick up and pay at the counter.</p>
            <div className="btns"><DownloadButtons info={info} dark={false} /></div>
            {info.app_version ? <div className="ver">Version {info.app_version} · Android</div> : null}
          </div>

          <div className="phone" aria-hidden="true">
            <div className="screen">
              <div className="hi">Hi, Meena</div>
              <div className="sm">Nearest shops</div>
              <div className="mini"><div className="av">A</div><div><b>Asha General Store</b><span>0.4 km away</span></div><div className="tag">Order</div></div>
              <div className="mini"><div className="av">S</div><div><b>Sharma Kirana</b><span>1.2 km away</span></div><div className="tag">Order</div></div>
              <div className="sm" style={{ marginTop: 14 }}>Your order</div>
              <div className="mini" style={{ display: 'block' }}>
                <div style={{ display: 'flex', marginBottom: 6 }}><b>Asha General Store</b><div className="tag blue">Ready</div></div>
                <div className="line"><span>2 × Milk</span><span style={{ color: '#065E57' }}>Available</span></div>
                <div className="line"><span>1 kg Rice</span><span style={{ color: '#065E57' }}>Available</span></div>
                <div className="line"><span className="strike">Saffron 1 g</span><span style={{ color: '#dc2626' }}>Not available</span></div>
              </div>
              <div className="bar">Ready for pickup</div>
            </div>
          </div>
        </div>
      </div>

      <section id="features">
        <div className="wrap">
          <h2>Shopping without the waiting</h2>
          <p className="sub">A small shop owner can only serve one customer at a time. This app lets everyone&rsquo;s list reach the shop at once.</p>
          <div className="grid4">
            <div className="card">
              <Icon><path d="M12 21s7-6.2 7-11a7 7 0 1 0-14 0c0 4.8 7 11 7 11Z" /><circle cx="12" cy="10" r="2.5" /></Icon>
              <h3>Find shops near you</h3><p>Registered shops around you, nearest first.</p>
            </div>
            <div className="card">
              <Icon><path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8l-5-5Z" /><path d="M14 3v5h5M9 13h6M9 17h6" /></Icon>
              <h3>Send your list</h3><p>Type items and quantities. No product catalog to browse.</p>
            </div>
            <div className="card">
              <Icon><circle cx="12" cy="12" r="9" /><path d="m8 12 3 3 5-6" /></Icon>
              <h3>The shop checks it</h3><p>Anything they don&rsquo;t have is marked &ldquo;not available&rdquo;.</p>
            </div>
            <div className="card">
              <Icon><rect x="2" y="6" width="20" height="12" rx="2" /><circle cx="12" cy="12" r="2.5" /><path d="M6 10v.01M18 14v.01" /></Icon>
              <h3>Pay at the shop</h3><p>Pick up your packed order and pay at the counter.</p>
            </div>
          </div>
        </div>
      </section>

      <section className="alt" id="how">
        <div className="wrap">
          <h2>How it works</h2>
          <p className="sub">Simple for the customer, quick for the shop.</p>
          <div className="grid2">
            <div className="card">
              <h3 className="big">For customers</h3>
              <div className="steps">
                <div className="step"><b>Sign up with your phone number.</b><br /><span>A one-time code confirms it is you. Start on the free plan.</span></div>
                <div className="step"><b>Choose a nearby shop</b><br /><span>See the closest shops and pick one.</span></div>
                <div className="step"><b>Write your list and send it</b><br /><span>Add items and quantities, then send.</span></div>
                <div className="step"><b>Pick up when it&rsquo;s ready</b><br /><span>You are notified in the app. Pay at the shop.</span></div>
              </div>
            </div>
            <div className="card">
              <h3 className="big">For shop owners</h3>
              <div className="steps">
                <div className="step"><b>Register your shop</b><br /><span>Add your shop name and location so nearby customers find you.</span></div>
                <div className="step"><b>Choose a plan</b><br /><span>Pick the plan that fits how many staff phones need access.</span></div>
                <div className="step"><b>Check each list</b><br /><span>Tap only the items you don&rsquo;t have. Everything else counts as available.</span></div>
                <div className="step"><b>Mark it ready</b><br /><span>The customer comes in, picks up and pays.</span></div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section id="plans">
        <div className="wrap">
          <h2>Plans for everyone</h2>
          <p className="sub">Customers start free. Shop owners pick a plan after signing up. You can see every plan and what it includes.</p>
          <div className="grid2">
            <PlanSummary kind="customer" />
            <PlanSummary kind="owner" />
          </div>
        </div>
      </section>

      {info.support_email || info.support_phone ? (
        <section className="alt" id="contact">
          <div className="wrap">
            <h2>Contact us</h2>
            <p className="sub">Questions about the app, your shop or your plan? We are happy to help.</p>
            <div className="contact-cards">
              {info.support_email ? (
                <a className="card contact-card" href={`mailto:${info.support_email}`}>
                  <div className="ic"><svg viewBox="0 0 24 24" fill="none" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="5" width="18" height="14" rx="2" /><path d="m3 7 9 6 9-6" /></svg></div>
                  <h3>Email</h3><p>{info.support_email}</p>
                </a>
              ) : null}
              {info.support_phone ? (
                <a className="card contact-card" href={telHref(info.support_phone)}>
                  <div className="ic"><svg viewBox="0 0 24 24" fill="none" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2Z" /></svg></div>
                  <h3>Phone</h3><p>{info.support_phone}</p>
                </a>
              ) : null}
            </div>
          </div>
        </section>
      ) : null}

      <section id="download">
        <div className="wrap">
          <div className="cta">
            <h2>Get the app</h2>
            <p>Free for customers. Shop owners choose a plan after signing up.</p>
            <div className="btns" style={{ justifyContent: 'center' }}><DownloadButtons info={info} dark /></div>
          </div>
        </div>
      </section>
    </>
  );
}
