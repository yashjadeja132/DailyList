import React, { Suspense, lazy } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, Route, Routes } from 'react-router-dom';

// One React app with two parts. Each part (and its styles) is loaded on its own, so they never mix:
//   /panel/*  the admin panel (login needed)
//   /*        the public website: home, pricing, privacy, terms
const PanelApp = lazy(() => import('./panel/PanelApp.jsx'));
const PublicSite = lazy(() => import('./public-site/PublicSite.jsx'));

createRoot(document.getElementById('root')).render(
  <BrowserRouter>
    <Suspense fallback={null}>
      <Routes>
        <Route path="/panel/*" element={<PanelApp />} />
        <Route path="/*" element={<PublicSite />} />
      </Routes>
    </Suspense>
  </BrowserRouter>
);
