import React, { useEffect, useState } from 'react';
import { Link, Route, Routes, useLocation } from 'react-router-dom';
import './site.css';
import Home from './Home.jsx';
import Pricing from './Pricing.jsx';
import Privacy from './Privacy.jsx';
import Terms from './Terms.jsx';
import { CartIcon, telHref } from './shared.jsx';

const BASE = import.meta.env.VITE_API_URL || (import.meta.env.DEV ? 'http://localhost:3000' : '');

/** Settings the admin can change (download links, version, support email). */
// A static copy of the site (GitHub Pages) has no server to ask, so it falls back to values set when it is built.
const FALLBACK = {
  play_store_url: import.meta.env.VITE_PLAY_STORE_URL || '',
  support_email: import.meta.env.VITE_SUPPORT_EMAIL || '',
  support_phone: import.meta.env.VITE_SUPPORT_PHONE || '',
};

function useAppInfo() {
  const [info, setInfo] = useState(FALLBACK);
  useEffect(() => {
    fetch(BASE + '/public/app-info').then((r) => r.json()).then((r) => setInfo({ ...FALLBACK, ...r })).catch(() => {});
  }, []);
  return info;
}

/** Scrolls to the top on a new page, or to the section named in the link (like /#how). */
function ScrollManager() {
  const { pathname, hash } = useLocation();
  useEffect(() => {
    if (hash) {
      // the section may appear a moment later (e.g. Contact, once the settings have loaded), so keep looking briefly
      let tries = 0;
      const timer = setInterval(() => {
        const el = document.getElementById(hash.slice(1));
        if (el) { clearInterval(timer); el.scrollIntoView({ behavior: 'smooth' }); }
        else if (++tries > 30) { clearInterval(timer); window.scrollTo(0, 0); }
      }, 100);
      return () => clearInterval(timer);
    }
    window.scrollTo(0, 0);
  }, [pathname, hash]);
  return null;
}

function Header() {
  return (
    <header className="top">
      <div className="wrap">
        <Link className="brand" to="/"><span className="logo"><CartIcon /></span><span>DailyList</span></Link>
        <nav>
          <Link className="opt" to={{ pathname: '/', hash: '#features' }}>Features</Link>
          <Link className="opt" to={{ pathname: '/', hash: '#how' }}>How it works</Link>
          {/* scrolls to the Plans section on the home page; "Explore more" there opens all plans */}
          <Link to={{ pathname: '/', hash: '#plans' }}>Plans</Link>
          <Link className="cta-link" to={{ pathname: '/', hash: '#download' }}>Download</Link>
        </nav>
      </div>
    </header>
  );
}

function Footer({ info }) {
  return (
    <footer>
      <div className="wrap">
        <div className="foot-grid">
          <div>
            <div className="foot-brand"><span className="logo"><CartIcon /></span>DailyList</div>
            <p>Send your list to a nearby shop before you go. They pack it, you pick it up and pay at the shop.</p>
          </div>
          <div>
            <h4>Explore</h4>
            <ul>
              <li><Link to={{ pathname: '/', hash: '#features' }}>Features</Link></li>
              <li><Link to={{ pathname: '/', hash: '#how' }}>How it works</Link></li>
              <li><Link to={{ pathname: '/', hash: '#plans' }}>Plans</Link></li>
              <li><Link to={{ pathname: '/', hash: '#download' }}>Download the app</Link></li>
            </ul>
          </div>
          <div>
            <h4>Legal</h4>
            <ul>
              <li><Link to="/privacy">Privacy Policy</Link></li>
              <li><Link to="/terms">Terms &amp; Conditions</Link></li>
            </ul>
          </div>
          <div>
            <h4>Contact</h4>
            <ul>
              {info.support_email ? <li><a href={`mailto:${info.support_email}`}>{info.support_email}</a></li> : null}
              {info.support_phone ? <li><a href={telHref(info.support_phone)}>{info.support_phone}</a></li> : null}
              {!info.support_email && !info.support_phone ? <li>Questions? Contact us from the app.</li> : null}
              {info.app_version ? <li>App version {info.app_version}</li> : null}
            </ul>
          </div>
        </div>
        <div className="foot-bottom">
          <span>&copy; {new Date().getFullYear()} DailyList. All rights reserved.</span>
          <span>Made for local shops and their customers.</span>
        </div>
      </div>
    </footer>
  );
}

function NotFound() {
  return (
    <section>
      <div className="wrap" style={{ textAlign: 'center' }}>
        <h2>Page not found</h2>
        <p className="sub">This page does not exist.</p>
        <Link className="btn green" to="/">Go to the home page</Link>
      </div>
    </section>
  );
}

export default function PublicSite() {
  const info = useAppInfo();
  return (
    <div className="site">
      <Header />
      <ScrollManager />
      <main>
        <Routes>
          <Route index element={<Home info={info} />} />
          <Route path="pricing" element={<Pricing info={info} />} />
          <Route path="privacy" element={<Privacy info={info} />} />
          <Route path="terms" element={<Terms info={info} />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </main>
      <Footer info={info} />
    </div>
  );
}
