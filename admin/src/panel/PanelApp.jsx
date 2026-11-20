import React, { useEffect, useState } from 'react';
import { NavLink, Navigate, Route, Routes } from 'react-router-dom';
import './panel.css';
import { api, getToken, setLoggedOutHandler, setToken } from './api.js';
import Login from './pages/Login.jsx';
import Dashboard from './pages/Dashboard.jsx';
import Plans from './pages/Plans.jsx';
import Shops from './pages/Shops.jsx';
import Customers from './pages/Customers.jsx';
import Payments from './pages/Payments.jsx';
import Settings from './pages/Settings.jsx';
import Orders from './pages/Orders.jsx';
import Complaints from './pages/Complaints.jsx';
import Categories from './pages/Categories.jsx';

const NAV = [
  ['/panel', 'Dashboard', '▦'],
  ['/panel/plans', 'Billing plans', '◈'],
  ['/panel/shops', 'Shop owners', '▣'],
  ['/panel/customers', 'Customers', '☺'],
  ['/panel/orders', 'Orders', '▤'],
  ['/panel/complaints', 'Complaints', '⚑'],
  ['/panel/categories', 'Categories', '▦'],
  ['/panel/payments', 'Payments', '₹'],
  ['/panel/settings', 'Settings', '⚙'],
];

export default function PanelApp() {
  const [loggedIn, setLoggedIn] = useState(!!getToken());

  useEffect(() => { document.title = 'DailyList Admin'; }, []);

  useEffect(() => { setLoggedOutHandler(() => setLoggedIn(false)); }, []);

  if (!loggedIn) return <Login onDone={() => setLoggedIn(true)} />;

  const logout = async () => {
    try { await api('/admin/logout', 'POST', {}); } catch { /* already signed out */ }
    setToken('');
    setLoggedIn(false);
  };

  return (
    <div className="shell">
      <aside className="side">
        <div className="brand">
          <span className="logo"><svg viewBox="0 0 24 24" aria-hidden="true"><path fillRule="evenodd" clipRule="evenodd" d="M14.4678 2.6495C14.9353 2.35572 15.5527 2.49652 15.8467 2.96395L19.5527 8.85848H22C22.5522 8.85848 22.9999 9.30631 23 9.85848C23 10.4108 22.5523 10.8585 22 10.8585H21.625L20.082 18.8009C19.8569 20.0569 18.8131 21.5289 17.1006 21.502L6.7998 21.503C5.1099 21.5027 4.03745 20.0735 3.81445 18.7804L2.36719 10.8585H2C1.44772 10.8585 1 10.4108 1 9.85848C1.00013 9.30631 1.4478 8.85848 2 8.85848H4.44727L8.15723 2.96395C8.45127 2.49669 9.06876 2.35577 9.53613 2.6495C10.0034 2.94356 10.1444 3.56102 9.85059 4.0284L6.81152 8.85848H17.1904L14.1533 4.0284C13.8595 3.56086 14.0003 2.94342 14.4678 2.6495ZM10.9111 19.503H13.0889L13.4189 15.9923H10.5811L10.9111 19.503ZM15.0986 19.503H17.124C17.5117 19.5123 17.9954 19.1292 18.1143 18.4405L18.1182 18.42L18.5898 15.9923H15.4287L15.0986 19.503ZM5.78418 18.4307L5.78613 18.4405C5.90026 19.102 6.38191 19.5027 6.7998 19.503H8.90137L8.57129 15.9923H5.33789L5.78418 18.4307ZM10.3936 13.9923H13.6064L13.9014 10.8585H10.0986L10.3936 13.9923ZM15.6162 13.9923H18.9785L19.5869 10.8585H15.9111L15.6162 13.9923ZM4.97266 13.9923H8.38379L8.08887 10.8585H4.39941L4.97266 13.9923Z" /></svg></span>
          <span className="name"><span>DailyList</span><small>Admin</small></span>
        </div>
        <nav>
          {NAV.map(([to, label, icon]) => (
            <NavLink key={to} to={to} end={to === '/panel'} className={({ isActive }) => (isActive ? 'on' : '')}>
              <span className="ico">{icon}</span> <span className="lbl-text">{label}</span>
            </NavLink>
          ))}
        </nav>
        <a className="ghost site-link" href="/">
          <span className="ico">↗</span><span className="lbl-text"> View website</span>
        </a>
        <button className="ghost logout" onClick={logout} aria-label="Log out" title="Log out">
          <span className="ico">⏻</span><span className="lbl-text"> Log out</span>
        </button>
      </aside>
      <main className="main">
        <Routes>
          <Route index element={<Dashboard />} />
          <Route path="plans" element={<Plans />} />
          <Route path="shops" element={<Shops />} />
          <Route path="customers" element={<Customers />} />
          <Route path="orders" element={<Orders />} />
          <Route path="complaints" element={<Complaints />} />
          <Route path="categories" element={<Categories />} />
          <Route path="payments" element={<Payments />} />
          <Route path="settings" element={<Settings />} />
          <Route path="*" element={<Navigate to="/panel" replace />} />
        </Routes>
      </main>
    </div>
  );
}
