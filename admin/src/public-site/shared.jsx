import React, { useEffect, useState } from 'react';

export const CartIcon = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true">
    <path fillRule="evenodd" clipRule="evenodd" d="M14.4678 2.6495C14.9353 2.35572 15.5527 2.49652 15.8467 2.96395L19.5527 8.85848H22C22.5522 8.85848 22.9999 9.30631 23 9.85848C23 10.4108 22.5523 10.8585 22 10.8585H21.625L20.082 18.8009C19.8569 20.0569 18.8131 21.5289 17.1006 21.502L6.7998 21.503C5.1099 21.5027 4.03745 20.0735 3.81445 18.7804L2.36719 10.8585H2C1.44772 10.8585 1 10.4108 1 9.85848C1.00013 9.30631 1.4478 8.85848 2 8.85848H4.44727L8.15723 2.96395C8.45127 2.49669 9.06876 2.35577 9.53613 2.6495C10.0034 2.94356 10.1444 3.56102 9.85059 4.0284L6.81152 8.85848H17.1904L14.1533 4.0284C13.8595 3.56086 14.0003 2.94342 14.4678 2.6495ZM10.9111 19.503H13.0889L13.4189 15.9923H10.5811L10.9111 19.503ZM15.0986 19.503H17.124C17.5117 19.5123 17.9954 19.1292 18.1143 18.4405L18.1182 18.42L18.5898 15.9923H15.4287L15.0986 19.503ZM5.78418 18.4307L5.78613 18.4405C5.90026 19.102 6.38191 19.5027 6.7998 19.503H8.90137L8.57129 15.9923H5.33789L5.78418 18.4307ZM10.3936 13.9923H13.6064L13.9014 10.8585H10.0986L10.3936 13.9923ZM15.6162 13.9923H18.9785L19.5869 10.8585H15.9111L15.6162 13.9923ZM4.97266 13.9923H8.38379L8.08887 10.8585H4.39941L4.97266 13.9923Z" />
  </svg>
);

const AndroidIcon = () => (
  <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
    <path d="M17.6 9.5 19 7.1a.5.5 0 0 0-.9-.5l-1.4 2.4A8.4 8.4 0 0 0 12 8c-1.7 0-3.3.4-4.7 1L5.9 6.6a.5.5 0 0 0-.9.5l1.4 2.4A7.6 7.6 0 0 0 3 16h18a7.6 7.6 0 0 0-3.4-6.5ZM8.5 14a1 1 0 1 1 0-2 1 1 0 0 1 0 2Zm7 0a1 1 0 1 1 0-2 1 1 0 0 1 0 2Z" />
  </svg>
);

const PlayIcon = () => (
  <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
    <path d="M4 3.5v17a1 1 0 0 0 1.5.9l15-8.5a1 1 0 0 0 0-1.8l-15-8.5A1 1 0 0 0 4 3.5Z" />
  </svg>
);

/** The download buttons. The links come from the admin panel (App & download page). */
export function DownloadButtons({ info, dark, dim }) {
  const hasApk = !!info.apk_url;
  const hasPlay = !!info.play_store_url;
  if (!hasApk && !hasPlay) return <div className={`soon${dim ? ' dim' : ''}`}>The download link is coming soon.</div>;
  return (
    <>
      {hasApk ? <a className={`btn${dark ? ' dark' : ' green'}`} href={info.apk_url} download><AndroidIcon /> Download for Android</a> : null}
      {hasPlay ? <a className={`btn${dark ? ' dark' : ''}`} href={info.play_store_url}><PlayIcon /> Get it on Google Play</a> : null}
    </>
  );
}

/** A phone number as a tap-to-call link (digits and a leading + only). */
export const telHref = (phone) => {
  const p = String(phone || '').trim();
  return 'tel:' + (p.startsWith('+') ? '+' : '') + p.replace(/\D/g, '');
};

/** The contact details used in the legal pages, e.g. "help@x.com or call +91 98765 43210". */
export function ContactDetails({ info }) {
  const { support_email: email, support_phone: phone } = info;
  if (!email && !phone) return <span>the contact details in the app</span>;
  return (
    <>
      {email ? <a href={'mailto:' + email}>{email}</a> : null}
      {email && phone ? ' or call ' : null}
      {phone ? <a href={telHref(phone)}>{phone}</a> : null}
    </>
  );
}

// ---- plans (read from the admin panel's live plans)
export const BASE = import.meta.env.VITE_API_URL || (import.meta.env.DEV ? 'http://localhost:3000' : '');
export const plural = (n, w) => `${n} ${w}${n === 1 ? '' : 's'}`;
export const money = (n) => '₹' + (Math.round(n * 100) / 100).toLocaleString('en-IN');

/** The active plans, as { customer: [...], owner: [...] }. null while loading, false if it failed. */
export function usePublicPlans() {
  const [data, setData] = useState(null);
  useEffect(() => {
    fetch(BASE + '/public/plans').then((r) => r.json()).then(setData).catch(() => setData(false));
  }, []);
  return data;
}
