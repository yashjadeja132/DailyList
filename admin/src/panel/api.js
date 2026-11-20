// Talks to the shop server. When the panel is served by the server itself the address is "".
// While developing with `npm run dev`, the server runs on port 3000.
const BASE = import.meta.env.DEV ? 'http://localhost:3000' : '';
const KEY = 'admin_token';

export const getToken = () => localStorage.getItem(KEY) || '';
export const setToken = (t) => (t ? localStorage.setItem(KEY, t) : localStorage.removeItem(KEY));

let onLoggedOut = () => {};
export const setLoggedOutHandler = (fn) => { onLoggedOut = fn; };

export async function api(path, method = 'GET', body) {
  let res;
  try {
    res = await fetch(BASE + path, {
      method,
      headers: {
        'Content-Type': 'application/json',
        ...(getToken() ? { Authorization: 'Bearer ' + getToken() } : {}),
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new Error('Cannot reach the server. Is it running?');
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    if (res.status === 401 && getToken()) { setToken(''); onLoggedOut(); }
    throw new Error(data.error || 'Something went wrong');
  }
  return data;
}

export const money = (n) => '₹' + (Math.round(Number(n || 0) * 100) / 100).toLocaleString('en-IN');
export const unlimited = (n) => (Number(n) === 0 ? 'Unlimited' : n);
export const when = (s) => {
  if (!s) return '—';
  const d = new Date(String(s).replace(' ', 'T') + 'Z');
  return d.toLocaleString([], { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
};
export const dateOnly = (s) => {
  if (!s) return 'No expiry';
  const d = new Date(String(s).replace(' ', 'T') + 'Z');
  return d.toLocaleDateString([], { day: 'numeric', month: 'short', year: 'numeric' });
};
