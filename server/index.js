require('./env'); // settings from server/.env
const express = require('express');
const push = require('./push');
const path = require('path');
const cors = require('cors');
const crypto = require('crypto');
const Database = require('better-sqlite3');

const PORT = process.env.PORT || 3000;
// Order life cycle (see the product blueprint):
//   New (sent) -> Accepted -> [Awaiting you] -> Preparing -> Ready -> Picked up (completed)
//   New/Accepted/Awaiting you -> Cancelled (customer) | Declined (shop) | Expired (nobody answered in time)
const STATUSES = ['New', 'Accepted', 'Declined', 'Awaiting you', 'Preparing', 'Ready', 'Picked up', 'Cancelled', 'Expired'];
const ORDERS_PER_HOUR = Number(process.env.ORDERS_PER_HOUR) || 15;
const OPEN_STATUSES = ['New', 'Accepted', 'Awaiting you', 'Preparing', 'Ready'];
const ITEM_STATES = ['pending', 'available', 'unavailable', 'partial'];
const SHOP_STATES = ['open', 'busy', 'closed'];
const NEARBY_KM = 5;

const db = new Database(process.env.DB_FILE || 'shop.db');
db.pragma('journal_mode = WAL');
db.exec(`
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  phone TEXT NOT NULL UNIQUE,
  role TEXT NOT NULL CHECK (role IN ('customer','owner'))
);
CREATE TABLE IF NOT EXISTS sessions (
  token TEXT PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id)
);
CREATE TABLE IF NOT EXISTS shops (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  owner_id INTEGER NOT NULL UNIQUE REFERENCES users(id),
  name TEXT NOT NULL,
  address TEXT NOT NULL DEFAULT '',
  lat REAL,
  lng REAL
);
CREATE TABLE IF NOT EXISTS shop_members (
  shop_id INTEGER NOT NULL REFERENCES shops(id),
  user_id INTEGER NOT NULL UNIQUE REFERENCES users(id),
  is_primary INTEGER NOT NULL DEFAULT 0,
  added_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (shop_id, user_id)
);
INSERT OR IGNORE INTO shop_members (shop_id, user_id, is_primary) SELECT id, owner_id, 1 FROM shops;
CREATE TABLE IF NOT EXISTS orders (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  shop_id INTEGER NOT NULL REFERENCES shops(id),
  user_id INTEGER NOT NULL REFERENCES users(id),
  customer_name TEXT NOT NULL,
  phone TEXT NOT NULL,
  note TEXT DEFAULT '',
  status TEXT NOT NULL DEFAULT 'New',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS order_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  order_id INTEGER NOT NULL REFERENCES orders(id),
  name TEXT NOT NULL,
  qty TEXT NOT NULL DEFAULT '1',
  available INTEGER NOT NULL DEFAULT 1
);
`);
// order life cycle columns (added later, so older databases get them here)
const hasCol = (table, col) => db.prepare(`PRAGMA table_info(${table})`).all().some((c) => c.name === col);
if (!hasCol('order_items', 'state')) {
  db.exec("ALTER TABLE order_items ADD COLUMN state TEXT NOT NULL DEFAULT 'pending'");
  db.exec("UPDATE order_items SET state = CASE WHEN available = 0 THEN 'unavailable' ELSE 'available' END " +
    "WHERE order_id IN (SELECT id FROM orders WHERE status != 'New') OR available = 0");
}
if (!hasCol('order_items', 'avail_qty')) db.exec("ALTER TABLE order_items ADD COLUMN avail_qty TEXT NOT NULL DEFAULT ''");
if (!hasCol('order_items', 'response')) db.exec("ALTER TABLE order_items ADD COLUMN response TEXT NOT NULL DEFAULT ''"); // customer: accepted | rejected
if (!hasCol('orders', 'decline_reason')) db.exec("ALTER TABLE orders ADD COLUMN decline_reason TEXT NOT NULL DEFAULT ''");
if (!hasCol('orders', 'updated_at')) {
  db.exec('ALTER TABLE orders ADD COLUMN updated_at TEXT');
  db.exec('UPDATE orders SET updated_at = created_at');
}
if (!hasCol('shops', 'accepting')) db.exec("ALTER TABLE shops ADD COLUMN accepting TEXT NOT NULL DEFAULT 'open'");
// who changed what, and when (basic audit trail for an order)
db.exec(`CREATE TABLE IF NOT EXISTS order_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  order_id INTEGER NOT NULL REFERENCES orders(id),
  actor TEXT NOT NULL,            -- customer | shop | system
  user_id INTEGER,
  event TEXT NOT NULL,
  detail TEXT NOT NULL DEFAULT '',
  at TEXT NOT NULL DEFAULT (datetime('now'))
)`);
// shop profile, approval, abuse counters, order extras (added later, so older databases get them here)
for (const [col, def] of [['phone', "TEXT NOT NULL DEFAULT ''"], ['open_time', "TEXT NOT NULL DEFAULT ''"], ['close_time', "TEXT NOT NULL DEFAULT ''"],
  ['pickup_info', "TEXT NOT NULL DEFAULT ''"], ['category', "TEXT NOT NULL DEFAULT ''"], ['area', "TEXT NOT NULL DEFAULT ''"],
  ['approval', "TEXT NOT NULL DEFAULT 'approved'"], ['approval_note', "TEXT NOT NULL DEFAULT ''"]])
  if (!hasCol('shops', col)) db.exec(`ALTER TABLE shops ADD COLUMN ${col} ${def}`);
for (const [col, def] of [['blocked', 'INTEGER NOT NULL DEFAULT 0'], ['no_show_count', 'INTEGER NOT NULL DEFAULT 0']])
  if (!hasCol('users', col)) db.exec(`ALTER TABLE users ADD COLUMN ${col} ${def}`);
for (const [col, def] of [['code', "TEXT NOT NULL DEFAULT ''"], ['eta_minutes', 'INTEGER'], ['cancel_requested', 'INTEGER NOT NULL DEFAULT 0'],
  ['rating', 'INTEGER'], ['feedback', "TEXT NOT NULL DEFAULT ''"], ['ready_at', 'TEXT'], ['shop_reminded_at', 'TEXT'], ['pickup_reminded_at', 'TEXT']])
  if (!hasCol('orders', col)) db.exec(`ALTER TABLE orders ADD COLUMN ${col} ${def}`);
db.exec(`CREATE TABLE IF NOT EXISTS notifications (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  order_id INTEGER,
  title TEXT NOT NULL,
  body TEXT NOT NULL DEFAULT '',
  read INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
)`);
db.exec('CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications (user_id, id)');
db.exec(`CREATE TABLE IF NOT EXISTS complaints (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  order_id INTEGER,
  shop_id INTEGER,
  about TEXT NOT NULL DEFAULT 'other',      -- shop | customer | other
  text TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'open',      -- open | resolved | dismissed
  note TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  resolved_at TEXT
)`);
const newCode = () => { // short pickup code, easy to read out at the counter (no 0/O/1/I)
  const a = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let c; do { c = Array.from({ length: 4 }, () => a[Math.floor(Math.random() * a.length)]).join(''); }
  while (db.prepare('SELECT 1 FROM orders WHERE code = ?').get(c));
  return c;
};
db.prepare("SELECT id FROM orders WHERE code = ''").all().forEach((o) => db.prepare('UPDATE orders SET code = ? WHERE id = ?').run(newCode(), o.id));
db.exec(`CREATE TABLE IF NOT EXISTS order_requests (
  user_id INTEGER NOT NULL, request_id TEXT NOT NULL, order_id INTEGER NOT NULL,
  PRIMARY KEY (user_id, request_id)
)`);
const logEvent = (orderId, actor, userId, event, detail = '') =>
  db.prepare('INSERT INTO order_events (order_id, actor, user_id, event, detail) VALUES (?, ?, ?, ?, ?)').run(orderId, actor, userId || null, event, detail);
push.init(db);
// In-app notifications; critical ones are also sent as an SMS (the SMS queue is a stub until a provider is set up).
const notify = (userId, title, body, orderId, sms = false) => {
  db.prepare('INSERT INTO notifications (user_id, order_id, title, body) VALUES (?, ?, ?, ?)').run(userId, orderId || null, title, body);
  push.send(db, userId, title, body, { order_id: orderId || '' });
  if (sms) {
    const u = db.prepare('SELECT phone FROM users WHERE id = ?').get(userId);
    if (u && infra.enqueueSms) infra.enqueueSms(u.phone, 'DailyList: ' + title + (body ? '. ' + body : '')).catch(() => {});
  }
};
const notifyShop = (shopId, title, body, orderId, sms = false) =>
  db.prepare('SELECT user_id FROM shop_members WHERE shop_id = ?').all(shopId).forEach((m) => notify(m.user_id, title, body, orderId, sms));
const shopName = (id) => db.prepare('SELECT name FROM shops WHERE id = ?').get(id)?.name || 'The shop';
const setStatus = (o, status, actor, userId, detail = '') => {
  db.prepare("UPDATE orders SET status = ?, updated_at = datetime('now'), ready_at = CASE WHEN ? = 'Ready' THEN datetime('now') ELSE ready_at END WHERE id = ?").run(status, status, o.id);
  logEvent(o.id, actor, userId, 'status: ' + status, detail);
  const ref = '#' + o.id, shop = shopName(o.shop_id);
  switch (status) {
    case 'Accepted': notify(o.user_id, shop + ' is checking your items', 'Order ' + ref, o.id); break;
    case 'Awaiting you': notify(o.user_id, 'Please answer: ' + shop + ' has less than you asked', 'Order ' + ref + '. Open the app to accept or skip.', o.id, true); break;
    case 'Preparing':
      if (actor === 'customer') notifyShop(o.shop_id, o.customer_name + ' answered', 'Order ' + ref + ' is ready to prepare', o.id);
      else notify(o.user_id, shop + ' is preparing your order', 'Order ' + ref, o.id);
      break;
    case 'Ready': notify(o.user_id, 'Your order is ready at ' + shop, 'Order ' + ref + '. Check the goods and pay at the shop.', o.id, true); break;
    case 'Declined': notify(o.user_id, shop + ' could not take your order', detail ? 'Reason: ' + detail : 'Order ' + ref, o.id, true); break;
    case 'Cancelled':
      if (actor === 'customer') notifyShop(o.shop_id, o.customer_name + ' cancelled order ' + ref, '', o.id);
      else notify(o.user_id, 'Order ' + ref + ' was cancelled', '', o.id);
      break;
    case 'Expired':
      if (detail.includes('shop did not')) { notify(o.user_id, shop + ' did not reply in time', 'Order ' + ref + ' expired. You can try another shop.', o.id, true); notifyShop(o.shop_id, 'Order ' + ref + ' expired', 'You did not reply in time', o.id); }
      else if (detail.includes('no-show')) notify(o.user_id, 'Order ' + ref + ' was marked as not collected', '', o.id);
      else notify(o.user_id, 'Order ' + ref + ' expired', 'You did not answer in time', o.id);
      break;
    default:
  }
};
// when the user agreed to the Terms & Conditions and Privacy Policy (added later, so older databases get it here)
if (!db.prepare('PRAGMA table_info(users)').all().some((c) => c.name === 'terms_accepted_at'))
  db.exec('ALTER TABLE users ADD COLUMN terms_accepted_at TEXT');

// ---- OTP. In development the code is always DEV_OTP. In production a random code is
// generated and sent by SMS. Plug your SMS provider into deliverSms in infra.js.
const IS_DEV = process.env.NODE_ENV !== 'production';
const DEV_OTP = process.env.DEV_OTP || '132020';
const OTP_TTL_MS = 5 * 60 * 1000;
// how many codes one phone number may ask for in 15 minutes
const OTP_SEND_LIMIT = Number(process.env.OTP_SEND_LIMIT) || (IS_DEV ? 50 : 5);
const infra = require('./infra'); // Redis + BullMQ (falls back to memory when Redis is off)
const cleanPhone = (p) => String(p || '').replace(/[^\d+]/g, '');

const publicUser = (u) => ({ id: u.id, name: u.name, phone: u.phone, role: u.role });
// the shop a user works for (the owner or any team member)
const shopOf = (userId) => db.prepare('SELECT s.* FROM shops s JOIN shop_members m ON m.shop_id = s.id WHERE m.user_id = ?').get(userId);
const num = (v) => (v === null || v === undefined || v === '' || isNaN(Number(v)) ? null : Number(v));

const km = (aLat, aLng, bLat, bLng) => {
  const r = Math.PI / 180;
  const dLat = (bLat - aLat) * r, dLng = (bLng - aLng) * r;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(aLat * r) * Math.cos(bLat * r) * Math.sin(dLng / 2) ** 2;
  return 6371 * 2 * Math.asin(Math.sqrt(h));
};

const app = express();
app.use(cors());
// the raw body is kept for webhook signature checks (see /webhooks/cashfree)
app.use(express.json({ verify: (req, res, buf) => { req.rawBody = buf; } }));

const auth = (req, res, next) => {
  const token = (req.get('authorization') || '').replace('Bearer ', '');
  const row = token && db.prepare(
    'SELECT u.* FROM sessions s JOIN users u ON u.id = s.user_id WHERE s.token = ?').get(token);
  if (!row) return res.status(401).json({ error: 'Please log in again' });
  if (row.blocked) return res.status(403).json({ error: 'This account has been suspended. Please contact support.', code: 'blocked' });
  req.user = row;
  next();
};
const owner = (req, res, next) => {
  if (req.user.role !== 'owner') return res.status(403).json({ error: 'Shop owners only' });
  req.shop = shopOf(req.user.id);
  if (!req.shop) return res.status(400).json({ error: 'No shop registered for this account' });
  req.isPrimary = !!db.prepare('SELECT is_primary FROM shop_members WHERE shop_id = ? AND user_id = ?').get(req.shop.id, req.user.id)?.is_primary;
  next();
};

// Plans, subscriptions, team and order limits (see billing.js)
const ctx = { db, auth, owner, shopOf, cleanPhone, num, km };
require('./billing')(app, ctx);
require('./admin')(app, ctx);

const startSession = (user) => {
  const token = crypto.randomBytes(24).toString('hex');
  db.prepare('INSERT INTO sessions (token, user_id) VALUES (?, ?)').run(token, user.id);
  const shop = user.role === 'owner' ? shopOf(user.id) : null;
  return { token, user: publicUser(user), shop, ...ctx.accountInfo(user, shop) };
};

const withDetails = (o) => ({
  ...o,
  shop_name: db.prepare('SELECT name FROM shops WHERE id = ?').get(o.shop_id)?.name,
  items: db.prepare("SELECT id, name, qty, CASE WHEN state = 'unavailable' THEN 0 ELSE 1 END AS available, state, avail_qty, response FROM order_items WHERE order_id = ? ORDER BY id").all(o.id),
  shop_accepting: db.prepare('SELECT accepting FROM shops WHERE id = ?').get(o.shop_id)?.accepting,
});

app.get('/health', (_, res) => res.json({ ok: true, redis: infra.mode }));

// ---- Accounts: phone number + OTP. Same flow for login and sign-up.
// Lets the app tell the user right away whether this number already has an account.
app.post('/auth/check', (req, res) => {
  const phone = cleanPhone(req.body.phone);
  if (phone.replace(/\D/g, '').length < 10) return res.status(400).json({ error: 'Enter a valid phone number' });
  res.json({ exists: !!db.prepare('SELECT id FROM users WHERE phone = ?').get(phone) });
});

app.post('/auth/send-otp', async (req, res) => {
  const phone = cleanPhone(req.body.phone);
  if (phone.replace(/\D/g, '').length < 10) return res.status(400).json({ error: 'Enter a valid phone number' });
  const limit = await infra.rate(`rl:otp:${phone}`, OTP_SEND_LIMIT, 15 * 60);
  if (!limit.ok) return res.status(429).json({ error: 'Too many codes requested for this number. Please try again in a few minutes.' });
  const code = IS_DEV ? DEV_OTP : String(crypto.randomInt(100000, 1000000));
  await infra.otp.put(phone, code, OTP_TTL_MS);
  await infra.enqueueSms(phone, `Your DailyList code is ${code}. It expires in 5 minutes.`); // sent by the SMS queue
  res.json({ ok: true, dev_hint: IS_DEV ? `Development mode: use code ${DEV_OTP}` : undefined });
});

// Verifies the code. Existing user -> logged in. New user -> must send `signup` details
// (the code stays valid so the app can ask for them and call this again).
app.post('/auth/verify', async (req, res) => {
  const phone = cleanPhone(req.body.phone);
  const rec = await infra.otp.get(phone);
  if (!rec) return res.status(400).json({ error: 'Code expired. Please request a new one.' });
  if (rec.tries >= 5) { await infra.otp.del(phone); return res.status(400).json({ error: 'Too many wrong attempts. Request a new code.' }); }
  if (String(req.body.otp) !== rec.code) {
    await infra.otp.fail(phone);
    return res.status(400).json({ error: 'Wrong code. Please try again.' });
  }

  const existing = db.prepare('SELECT * FROM users WHERE phone = ?').get(phone);
  if (existing) {
    if (req.body.mode === 'signup')
      return res.status(400).json({ error: 'This number is already registered. Please log in instead.', code: 'exists' });
    await infra.otp.del(phone);
    return res.json(startSession(existing));
  }

  const { signup } = req.body;
  if (!signup) return res.json({ needs_signup: true });
  const { name, role, shop } = signup;
  if (!name?.trim()) return res.status(400).json({ error: 'Enter your name' });
  // creating an account means agreeing to the Terms & Conditions and Privacy Policy
  if (signup.accepted_terms !== true)
    return res.status(400).json({ error: 'Please agree to the Terms & Conditions and Privacy Policy to create an account.', code: 'terms_required' });
  const r = role === 'owner' ? 'owner' : 'customer';
  if (r === 'owner' && !shop?.name?.trim()) return res.status(400).json({ error: 'Enter your shop name' });

  const create = db.transaction(() => {
    const info = db.prepare("INSERT INTO users (name, phone, role, terms_accepted_at) VALUES (?, ?, ?, datetime('now'))").run(name.trim(), phone, r);
    if (r === 'owner') {
      const s = db.prepare("INSERT INTO shops (owner_id, name, address, lat, lng, approval) VALUES (?, ?, ?, ?, ?, 'pending')")
        .run(info.lastInsertRowid, shop.name.trim(), (shop.address || '').trim(), num(shop.lat), num(shop.lng));
      db.prepare('INSERT INTO shop_members (shop_id, user_id, is_primary) VALUES (?, ?, 1)').run(s.lastInsertRowid, info.lastInsertRowid);
    }
    return info.lastInsertRowid;
  });
  await infra.otp.del(phone);
  res.json(startSession(db.prepare('SELECT * FROM users WHERE id = ?').get(create())));
});

// ---- Google Maps: find places matching the shop name around the owner's position.
// Needs GOOGLE_MAPS_API_KEY (Places API (New) enabled). Without it the app just uses GPS.
const MAPS_KEY = process.env.GOOGLE_MAPS_API_KEY || '';
// The map picker in the app uses this browser key (Maps JavaScript API). Public on purpose (needed on the sign-up screen);
// restrict the key in Google Cloud Console.
app.get('/public/maps-config', (req, res) => res.json({ key: MAPS_KEY || null }));
app.get('/places/nearby', auth, async (req, res) => {
  const lat = num(req.query.lat), lng = num(req.query.lng), q = String(req.query.q || '').trim();
  if (!MAPS_KEY) return res.json({ configured: false, places: [] });
  if (lat === null || lng === null || !q) return res.status(400).json({ error: 'Location and shop name required' });
  try {
    const r = await fetch('https://places.googleapis.com/v1/places:searchText', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': MAPS_KEY,
        'X-Goog-FieldMask': 'places.displayName,places.formattedAddress,places.location',
      },
      body: JSON.stringify({
        textQuery: q,
        maxResultCount: 5,
        locationBias: { circle: { center: { latitude: lat, longitude: lng }, radius: 300 } },
      }),
    });
    const data = await r.json();
    if (!r.ok) return res.status(502).json({ error: data.error?.message || 'Google Maps lookup failed' });
    const places = (data.places || [])
      .map((p) => ({
        name: p.displayName?.text || '',
        address: p.formattedAddress || '',
        lat: p.location?.latitude,
        lng: p.location?.longitude,
      }))
      .filter((p) => p.lat != null && p.lng != null)
      .map((p) => ({ ...p, distance_m: Math.round(km(lat, lng, p.lat, p.lng) * 1000) }))
      .filter((p) => p.distance_m <= 500) // only places really near the owner
      .sort((a, b) => a.distance_m - b.distance_m);
    res.json({ configured: true, places });
  } catch (e) {
    res.status(502).json({ error: 'Could not reach Google Maps' });
  }
});

app.get('/auth/me', auth, (req, res) => {
  const shop = req.user.role === 'owner' ? shopOf(req.user.id) : null;
  res.json({ user: publicUser(req.user), shop, ...ctx.accountInfo(req.user, shop) });
});

app.put('/auth/me', auth, (req, res) => {
  const name = String(req.body.name || '').trim();
  if (!name) return res.status(400).json({ error: 'Name cannot be empty' });
  db.prepare('UPDATE users SET name = ? WHERE id = ?').run(name.slice(0, 60), req.user.id);
  res.json({ user: publicUser(db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id)) });
});

app.post('/auth/logout', auth, (req, res) => {
  db.prepare('DELETE FROM sessions WHERE token = ?').run((req.get('authorization') || '').replace('Bearer ', ''));
  res.json({ ok: true });
});

// ---- Shops: nearest first when the customer's location is known
// opening hours: the shop may set open_time / close_time (HH:MM). Outside them it counts as closed.
const toMin = (hhmm) => { const m = /^(\d{1,2}):(\d{2})$/.exec(hhmm || ''); return m && Number(m[1]) < 24 && Number(m[2]) < 60 ? Number(m[1]) * 60 + Number(m[2]) : null; };
const outsideHours = (s) => {
  const o = toMin(s.open_time), c = toMin(s.close_time);
  if (o === null || c === null || o === c) return false;
  const now = new Date(), n = now.getHours() * 60 + now.getMinutes();
  return o < c ? !(n >= o && n < c) : !(n >= o || n < c); // also handles shops that stay open past midnight
};
const effectiveState = (s) => (s.accepting === 'closed' || outsideHours(s) ? 'closed' : s.accepting);
app.get('/shops', auth, (req, res) => {
  const lat = num(req.query.lat), lng = num(req.query.lng);
  const list = db.prepare("SELECT * FROM shops WHERE approval = 'approved'").all().filter((s) => ctx.shopHasPlan(s.id)).map((s) => ({
    ...s, accepting: effectiveState(s), hours_closed: outsideHours(s),
    distance_km: lat !== null && lng !== null && s.lat !== null && s.lng !== null
      ? Math.round(km(lat, lng, s.lat, s.lng) * 10) / 10 : null,
  }));
  list.sort((a, b) => (a.distance_km ?? 1e9) - (b.distance_km ?? 1e9) || a.name.localeCompare(b.name));
  res.json({ nearby_km: NEARBY_KM, shops: list });
});

app.put('/shop', auth, owner, (req, res) => {
  if (!req.isPrimary) return res.status(403).json({ error: 'Only the main shop owner can change shop details' });
  const { name, address, lat, lng, phone, open_time, close_time, pickup_info, category, area } = req.body;
  for (const [k, v] of [['open_time', open_time], ['close_time', close_time]])
    if (v !== undefined && v !== '' && toMin(v) === null) return res.status(400).json({ error: 'Time must look like 09:30' });
  const text = (v, cur, n) => (v === undefined ? cur : String(v).trim().slice(0, n));
  const n = { ...req.shop, ...(name !== undefined && { name }), ...(address !== undefined && { address }) };
  const nlat = lat !== undefined ? num(lat) : req.shop.lat;
  const nlng = lng !== undefined ? num(lng) : req.shop.lng;
  if (!n.name?.trim()) return res.status(400).json({ error: 'Shop name is required' });
  db.prepare('UPDATE shops SET name=?, address=?, lat=?, lng=?, phone=?, open_time=?, close_time=?, pickup_info=?, category=?, area=? WHERE id=?')
    .run(n.name.trim(), (n.address || '').trim(), nlat, nlng, text(phone, req.shop.phone, 20), text(open_time, req.shop.open_time, 5),
      text(close_time, req.shop.close_time, 5), text(pickup_info, req.shop.pickup_info, 300), text(category, req.shop.category, 40),
      text(area, req.shop.area, 60), req.shop.id);
  res.json(shopOf(req.user.id));
});

// ---- Shop: accepting orders / busy / closed (any phone on the shop account may change it)
app.put('/shop/status', auth, owner, ctx.activeOwner, (req, res) => {
  if (!SHOP_STATES.includes(req.body.accepting)) return res.status(400).json({ error: 'Invalid shop status' });
  db.prepare('UPDATE shops SET accepting = ? WHERE id = ?').run(req.body.accepting, req.shop.id);
  res.json(shopOf(req.user.id));
});

// ---- Orders: a free-form list sent to one shop
const minutes = (key, fallback) => Number(db.prepare('SELECT value FROM settings WHERE key = ?').get(key)?.value) || fallback;
const orderById = (id) => withDetails(db.prepare('SELECT * FROM orders WHERE id = ?').get(id));

app.post('/orders', auth, (req, res) => {
  if (req.user.role !== 'customer') return res.status(403).json({ error: 'Only customers can place orders' });
  const { shop_id, note, lines, request_id } = req.body;
  const shop = db.prepare('SELECT * FROM shops WHERE id = ?').get(shop_id);
  if (!shop) return res.status(400).json({ error: 'Please choose a shop' });
  if (!ctx.shopHasPlan(shop_id))
    return res.status(400).json({ error: 'This shop is not taking orders right now', code: 'shop_inactive' });
  if (shop.approval !== 'approved')
    return res.status(400).json({ error: 'This shop is not available yet', code: 'shop_inactive' });
  if (effectiveState(shop) === 'closed')
    return res.status(400).json({ error: `${shop.name} is closed for new orders right now${outsideHours(shop) ? ` (open ${shop.open_time} to ${shop.close_time})` : ''}. Please try later or choose another shop.`, code: 'shop_closed' });
  // spam protection: a customer can send a limited number of orders per hour
  if (db.prepare("SELECT COUNT(*) c FROM orders WHERE user_id = ? AND created_at >= datetime('now', '-1 hour')").get(req.user.id).c >= ORDERS_PER_HOUR)
    return res.status(429).json({ error: 'You have sent many orders in the last hour. Please wait a while before sending another.', code: 'too_many_orders' });
  const blocked = ctx.checkOrderLimits(req.user.id, shop_id);
  if (blocked) return res.status(403).json(blocked);
  const clean = (Array.isArray(lines) ? lines : [])
    .map((l) => ({ name: String(l.name || '').trim(), qty: String(l.qty || '1').trim() || '1' }))
    .filter((l) => l.name);
  if (!clean.length) return res.status(400).json({ error: 'Add at least one item to your list' });

  // A repeated tap or a retry after a bad connection must not create a second order:
  // the same request_id returns the order that was already created.
  if (request_id) {
    const dup = db.prepare('SELECT order_id FROM order_requests WHERE user_id = ? AND request_id = ?').get(req.user.id, String(request_id));
    if (dup) return res.json(orderById(dup.order_id));
  }
  const id = db.transaction(() => {
    const o = db.prepare(
      'INSERT INTO orders (shop_id, user_id, customer_name, phone, note, updated_at, code) VALUES (?, ?, ?, ?, ?, datetime(\'now\'), ?)')
      .run(shop_id, req.user.id, req.user.name, req.user.phone, (note || '').trim(), newCode());
    const ins = db.prepare('INSERT INTO order_items (order_id, name, qty) VALUES (?, ?, ?)');
    clean.forEach((l) => ins.run(o.lastInsertRowid, l.name.slice(0, 80), l.qty.slice(0, 30)));
    if (request_id) db.prepare('INSERT INTO order_requests (user_id, request_id, order_id) VALUES (?, ?, ?)').run(req.user.id, String(request_id), o.lastInsertRowid);
    logEvent(o.lastInsertRowid, 'customer', req.user.id, 'status: New', `${clean.length} item(s)`);
    notifyShop(shop_id, 'New order from ' + req.user.name, clean.length + ' item(s)', o.lastInsertRowid);
    return o.lastInsertRowid;
  })();
  res.json(orderById(id));
});

app.get('/orders/mine', auth, (req, res) =>
  res.json(db.prepare('SELECT * FROM orders WHERE user_id = ? ORDER BY id DESC').all(req.user.id).map(withDetails)));

// The customer can cancel until the shop starts preparing.
app.post('/orders/:id/cancel', auth, (req, res) => {
  const o = db.prepare('SELECT * FROM orders WHERE id = ? AND user_id = ?').get(req.params.id, req.user.id);
  if (!o) return res.status(404).json({ error: 'Order not found' });
  if (['Preparing', 'Ready'].includes(o.status)) { // the shop has started: it has to agree
    if (o.cancel_requested) return res.status(400).json({ error: 'You already asked the shop to cancel. Please wait for their reply.' });
    db.prepare('UPDATE orders SET cancel_requested = 1 WHERE id = ?').run(o.id);
    logEvent(o.id, 'customer', req.user.id, 'asked to cancel');
    notifyShop(o.shop_id, o.customer_name + ' wants to cancel order #' + o.id, 'Open the order to agree or keep it', o.id);
    return res.json(orderById(o.id));
  }
  if (!['New', 'Accepted', 'Awaiting you'].includes(o.status)) return res.status(400).json({ error: 'This order can no longer be cancelled' });
  setStatus(o, 'Cancelled', 'customer', req.user.id);
  res.json(orderById(o.id));
});

// The customer answers the shop's partial quantities: { decisions: { [itemId]: true | false } }
app.post('/orders/:id/respond', auth, (req, res) => {
  const o = db.prepare('SELECT * FROM orders WHERE id = ? AND user_id = ?').get(req.params.id, req.user.id);
  if (!o) return res.status(404).json({ error: 'Order not found' });
  if (o.status !== 'Awaiting you') return res.status(400).json({ error: 'This order does not need your answer' });
  const decisions = req.body.decisions || {};
  const partial = db.prepare("SELECT id FROM order_items WHERE order_id = ? AND state = 'partial'").all(o.id);
  if (partial.some((p) => typeof decisions[p.id] !== 'boolean'))
    return res.status(400).json({ error: 'Please accept or reject every changed item' });
  db.transaction(() => {
    const set = db.prepare('UPDATE order_items SET response = ? WHERE id = ?');
    partial.forEach((p) => set.run(decisions[p.id] ? 'accepted' : 'rejected', p.id));
    // anything the customer will receive? if not, there is nothing to prepare
    const anything = db.prepare(
      "SELECT 1 FROM order_items WHERE order_id = ? AND (state = 'available' OR (state = 'partial' AND response = 'accepted'))").get(o.id);
    setStatus(o, anything ? 'Preparing' : 'Cancelled', 'customer', req.user.id, anything ? 'accepted changes' : 'rejected all changes');
  })();
  res.json(orderById(o.id));
});

// ---- Shop owner
app.get('/owner/orders', auth, owner, ctx.activeOwner, (req, res) =>
  res.json(db.prepare(`SELECT * FROM orders WHERE shop_id = ? ORDER BY
    CASE WHEN status IN ('Picked up','Cancelled','Declined','Expired') THEN 1 ELSE 0 END, id`).all(req.shop.id).map(withDetails)));

const ownOrder = (req, res) => {
  const o = db.prepare('SELECT * FROM orders WHERE id = ? AND shop_id = ?').get(req.params.id, req.shop.id);
  if (!o) res.status(404).json({ error: 'Order not found' });
  return o;
};
const bad = (res, msg) => res.status(400).json({ error: msg });

// the shop agrees to look at the order
app.post('/orders/:id/accept', auth, owner, ctx.activeOwner, (req, res) => {
  const o = ownOrder(req, res);
  if (!o) return;
  if (o.status !== 'New') return bad(res, 'This order was already answered');
  setStatus(o, 'Accepted', 'shop', req.user.id);
  res.json(orderById(o.id));
});

app.post('/orders/:id/decline', auth, owner, ctx.activeOwner, (req, res) => {
  const o = ownOrder(req, res);
  if (!o) return;
  if (!['New', 'Accepted'].includes(o.status)) return bad(res, 'This order can no longer be declined');
  const reason = String(req.body.reason || '').trim().slice(0, 200);
  db.prepare('UPDATE orders SET decline_reason = ? WHERE id = ?').run(reason, o.id);
  setStatus(o, 'Declined', 'shop', req.user.id, reason);
  res.json(orderById(o.id));
});

// mark one line: { state: 'available' | 'unavailable' | 'partial', avail_qty? }
app.patch('/orders/:id/items/:itemId', auth, owner, ctx.activeOwner, (req, res) => {
  const o = ownOrder(req, res);
  if (!o) return;
  if (!['New', 'Accepted'].includes(o.status)) return bad(res, 'Items can only be marked while you are reviewing the order');
  const state = req.body.state ?? (req.body.available === false ? 'unavailable' : 'available'); // old apps send `available`
  if (!ITEM_STATES.includes(state) || state === 'pending') return bad(res, 'Invalid item state');
  const qty = String(req.body.avail_qty || '').trim().slice(0, 30);
  if (state === 'partial' && !qty) return bad(res, 'Enter the quantity you can give');
  const r = db.prepare('UPDATE order_items SET state = ?, avail_qty = ?, response = ? WHERE id = ? AND order_id = ?')
    .run(state, state === 'partial' ? qty : '', '', req.params.itemId, o.id);
  if (!r.changes) return res.status(404).json({ error: 'Item not found' });
  if (o.status === 'New') setStatus(o, 'Accepted', 'shop', req.user.id, 'started reviewing');
  logEvent(o.id, 'shop', req.user.id, 'item ' + req.params.itemId + ': ' + state, qty);
  res.json(orderById(o.id));
});

// The shop finished checking: ask the customer about partial lines, otherwise start preparing.
app.post('/orders/:id/review-done', auth, owner, ctx.activeOwner, (req, res) => {
  const o = ownOrder(req, res);
  if (!o) return;
  if (!['New', 'Accepted'].includes(o.status)) return bad(res, 'This order is not being reviewed');
  const items = db.prepare('SELECT state FROM order_items WHERE order_id = ?').all(o.id);
  if (items.some((i) => i.state === 'pending')) return bad(res, 'Mark every item first');
  if (items.every((i) => i.state === 'unavailable')) return bad(res, 'Nothing is available. Decline the order instead.');
  const eta = Math.floor(Number(req.body.eta_minutes) || 0);
  if (eta > 0) db.prepare('UPDATE orders SET eta_minutes = ? WHERE id = ?').run(Math.min(eta, 600), o.id);
  if (items.some((i) => i.state === 'partial')) setStatus(o, 'Awaiting you', 'shop', req.user.id, 'partial quantities');
  else setStatus(o, 'Preparing', 'shop', req.user.id);
  res.json(orderById(o.id));
});

// Preparing -> Ready -> Picked up (completed: goods handed over and paid at the shop)
const NEXT = { 'Preparing': 'Ready', 'Ready': 'Picked up' };
app.patch('/orders/:id/status', auth, owner, ctx.activeOwner, (req, res) => {
  const o = ownOrder(req, res);
  if (!o) return;
  const to = req.body.status;
  if (!STATUSES.includes(to)) return bad(res, 'Invalid status');
  if (NEXT[o.status] !== to) return bad(res, `An order that is "${o.status}" cannot be moved to "${to}"`);
  setStatus(o, to, 'shop', req.user.id);
  res.json(orderById(o.id));
});

app.get('/orders/:id/events', auth, (req, res) => {
  const o = db.prepare('SELECT * FROM orders WHERE id = ?').get(req.params.id);
  const member = o && db.prepare('SELECT 1 FROM shop_members WHERE shop_id = ? AND user_id = ?').get(o.shop_id, req.user.id);
  if (!o || (o.user_id !== req.user.id && !member)) return res.status(404).json({ error: 'Order not found' });
  res.json(db.prepare('SELECT actor, event, detail, at FROM order_events WHERE order_id = ? ORDER BY id').all(o.id));
});

// ---- Expiry: an order nobody answered in time (job in infra.js calls this)
function expireOrders() {
  const shopMin = minutes('shop_response_minutes', 30), custMin = minutes('customer_response_minutes', 60);
  const due = db.prepare(`SELECT * FROM orders WHERE
    (status = 'New' AND created_at <= datetime('now', ?)) OR
    (status = 'Awaiting you' AND updated_at <= datetime('now', ?))`).all(`-${shopMin} minutes`, `-${custMin} minutes`);
  due.forEach((o) => setStatus(o, 'Expired', 'system', null,
    o.status === 'New' ? 'the shop did not answer in time' : 'the customer did not answer in time'));
  // reminders: a shop that has not answered for half the window, a customer who has not collected a ready order
  const half = Math.max(1, Math.floor(shopMin / 2)), pickupRem = minutes('pickup_reminder_minutes', 120);
  db.prepare("SELECT * FROM orders WHERE status = 'New' AND shop_reminded_at IS NULL AND created_at <= datetime('now', ?)").all(`-${half} minutes`)
    .forEach((o) => { notifyShop(o.shop_id, 'Order #' + o.id + ' is waiting', o.customer_name + ' is waiting for your reply', o.id, true); db.prepare("UPDATE orders SET shop_reminded_at = datetime('now') WHERE id = ?").run(o.id); });
  db.prepare("SELECT * FROM orders WHERE status = 'Ready' AND pickup_reminded_at IS NULL AND ready_at <= datetime('now', ?)").all(`-${pickupRem} minutes`)
    .forEach((o) => { notify(o.user_id, 'Your order is still waiting at ' + shopName(o.shop_id), 'Order #' + o.id + ' (code ' + o.code + ')', o.id, true); db.prepare("UPDATE orders SET pickup_reminded_at = datetime('now') WHERE id = ?").run(o.id); });
  return due.length;
}


// ---- Customer edits the list after sending (before the shop has finished checking): { add: [{name, qty}], remove: [itemId] }
app.put('/orders/:id/items', auth, (req, res) => {
  const o = db.prepare('SELECT * FROM orders WHERE id = ? AND user_id = ?').get(req.params.id, req.user.id);
  if (!o) return res.status(404).json({ error: 'Order not found' });
  if (!['New', 'Accepted'].includes(o.status)) return bad(res, 'The list can only be changed before the shop finishes checking it');
  const add = (Array.isArray(req.body.add) ? req.body.add : []).map((l) => ({ name: String(l.name || '').trim().slice(0, 80), qty: String(l.qty || '1').trim().slice(0, 30) || '1' })).filter((l) => l.name);
  const remove = (Array.isArray(req.body.remove) ? req.body.remove : []).map(Number);
  const left = db.prepare('SELECT id FROM order_items WHERE order_id = ?').all(o.id).filter((i) => !remove.includes(i.id)).length + add.length;
  if (!left) return bad(res, 'The order must keep at least one item. Cancel it instead.');
  db.transaction(() => {
    remove.forEach((id) => db.prepare('DELETE FROM order_items WHERE id = ? AND order_id = ?').run(id, o.id));
    add.forEach((l) => db.prepare('INSERT INTO order_items (order_id, name, qty) VALUES (?, ?, ?)').run(o.id, l.name, l.qty));
    logEvent(o.id, 'customer', req.user.id, 'list changed', `+${add.length} -${remove.length}`);
  })();
  if (o.status === 'Accepted') notifyShop(o.shop_id, o.customer_name + ' changed the list of order #' + o.id, 'Please check the new items', o.id);
  res.json(orderById(o.id));
});

// shop answers a customer's request to cancel after preparing started: { approve: true | false }
app.post('/orders/:id/cancel-response', auth, owner, ctx.activeOwner, (req, res) => {
  const o = ownOrder(req, res);
  if (!o) return;
  if (!o.cancel_requested) return bad(res, 'The customer did not ask to cancel');
  db.prepare('UPDATE orders SET cancel_requested = 0 WHERE id = ?').run(o.id);
  if (req.body.approve) setStatus(o, 'Cancelled', 'shop', req.user.id, 'cancel request approved');
  else { logEvent(o.id, 'shop', req.user.id, 'cancel request declined'); notify(o.user_id, shopName(o.shop_id) + ' is keeping your order', 'Order #' + o.id + ' is already prepared', o.id); }
  res.json(orderById(o.id));
});

// the customer did not come: allowed once the pickup window has passed
app.post('/orders/:id/no-show', auth, owner, ctx.activeOwner, (req, res) => {
  const o = ownOrder(req, res);
  if (!o) return;
  if (o.status !== 'Ready') return bad(res, 'Only a ready order can be marked as not collected');
  const win = minutes('pickup_window_minutes', 240);
  if (db.prepare("SELECT 1 FROM orders WHERE id = ? AND ready_at <= datetime('now', ?)").get(o.id, `-${win} minutes`) === undefined)
    return bad(res, `Please wait. Customers have ${win} minutes to collect a ready order.`);
  db.prepare('UPDATE users SET no_show_count = no_show_count + 1 WHERE id = ?').run(o.user_id);
  setStatus(o, 'Expired', 'shop', req.user.id, 'no-show: customer did not collect');
  res.json(orderById(o.id));
});

// feedback after collecting: { rating: 1-5, feedback? }
app.post('/orders/:id/rate', auth, (req, res) => {
  const o = db.prepare('SELECT * FROM orders WHERE id = ? AND user_id = ?').get(req.params.id, req.user.id);
  if (!o) return res.status(404).json({ error: 'Order not found' });
  if (o.status !== 'Picked up') return bad(res, 'You can rate an order after collecting it');
  if (o.rating) return bad(res, 'You already rated this order');
  const rating = Math.floor(Number(req.body.rating));
  if (!(rating >= 1 && rating <= 5)) return bad(res, 'Choose 1 to 5 stars');
  db.prepare('UPDATE orders SET rating = ?, feedback = ? WHERE id = ?').run(rating, String(req.body.feedback || '').trim().slice(0, 300), o.id);
  logEvent(o.id, 'customer', req.user.id, 'rated ' + rating);
  res.json(orderById(o.id));
});

// ---- In-app notifications
// the phone registers its Firebase token so it can receive push notifications: { token }
app.post('/devices', auth, (req, res) => {
  const token = String(req.body.token || '').trim();
  if (token.length < 20 || token.length > 4096) return res.status(400).json({ error: 'Invalid token' });
  db.prepare("INSERT INTO device_tokens (token, user_id, updated_at) VALUES (?, ?, datetime('now')) ON CONFLICT(token) DO UPDATE SET user_id = excluded.user_id, updated_at = datetime('now')").run(token, req.user.id);
  res.json({ ok: true });
});
app.delete('/devices', auth, (req, res) => {
  db.prepare('DELETE FROM device_tokens WHERE token = ? AND user_id = ?').run(String(req.body.token || ''), req.user.id);
  res.json({ ok: true });
});
app.get('/notifications', auth, (req, res) => {
  res.json({
    unread: db.prepare('SELECT COUNT(*) c FROM notifications WHERE user_id = ? AND read = 0').get(req.user.id).c,
    items: db.prepare('SELECT id, order_id, title, body, read, created_at FROM notifications WHERE user_id = ? ORDER BY id DESC LIMIT 60').all(req.user.id),
  });
});
app.post('/notifications/read', auth, (req, res) => {
  db.prepare('UPDATE notifications SET read = 1 WHERE user_id = ?').run(req.user.id);
  res.json({ ok: true });
});

// ---- Complaints / reports to the platform team: { text, order_id?, about: 'shop' | 'customer' | 'other' }
app.post('/complaints', auth, (req, res) => {
  const text = String(req.body.text || '').trim().slice(0, 1000);
  if (!text) return bad(res, 'Please describe the problem');
  const o = req.body.order_id ? db.prepare('SELECT * FROM orders WHERE id = ?').get(req.body.order_id) : null;
  if (o) {
    const member = db.prepare('SELECT 1 FROM shop_members WHERE shop_id = ? AND user_id = ?').get(o.shop_id, req.user.id);
    if (o.user_id !== req.user.id && !member) return res.status(404).json({ error: 'Order not found' });
  }
  const about = ['shop', 'customer', 'other'].includes(req.body.about) ? req.body.about : 'other';
  const r = db.prepare('INSERT INTO complaints (user_id, order_id, shop_id, about, text) VALUES (?, ?, ?, ?, ?)').run(req.user.id, o?.id || null, o?.shop_id || null, about, text);
  if (o) logEvent(o.id, req.user.role === 'owner' ? 'shop' : 'customer', req.user.id, 'complaint filed');
  res.json({ id: r.lastInsertRowid });
});

// ---- Find a place by area or pincode when the phone's location is not available (OpenStreetMap search)
app.get('/geocode', auth, async (req, res) => {
  const q = String(req.query.q || '').trim().slice(0, 100);
  if (q.length < 3) return bad(res, 'Type an area name or a pincode');
  try {
    const r = await fetch('https://nominatim.openstreetmap.org/search?format=jsonv2&limit=6&countrycodes=in&q=' + encodeURIComponent(q),
      { headers: { 'User-Agent': 'LocalShopApp/1.0 (shop order app)' }, signal: AbortSignal.timeout(8000) });
    const rows = await r.json();
    res.json((Array.isArray(rows) ? rows : []).map((p) => ({ name: p.display_name, lat: Number(p.lat), lng: Number(p.lon) })));
  } catch (e) { res.status(502).json({ error: 'Could not search places right now. Please try again.' }); }
});

// shop categories (managed by the admin)
db.exec(`CREATE TABLE IF NOT EXISTS categories (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE COLLATE NOCASE,
  active INTEGER NOT NULL DEFAULT 1,
  sort INTEGER NOT NULL DEFAULT 0
)`);
if (!db.prepare('SELECT 1 FROM categories').get()) { // first start: take over the old comma separated list
  const old = String(db.prepare("SELECT value FROM settings WHERE key = 'shop_categories'").get()?.value || 'Grocery,Dairy,Bakery,Stationery,Hardware,General store')
    .split(',').map((s) => s.trim()).filter(Boolean);
  old.forEach((n, i) => db.prepare('INSERT OR IGNORE INTO categories (name, sort) VALUES (?, ?)').run(n, i));
}
const categoriesList = () => db.prepare('SELECT name FROM categories WHERE active = 1 ORDER BY sort, name').all().map((r) => r.name);
app.get('/public/categories', (_, res) => res.json(categoriesList()));


// The website and the admin panel are one React app (admin/). Build it with: cd admin && npm run build
//   public pages: /  /pricing  /privacy  /terms        admin panel: /panel
const webDist = path.join(__dirname, '..', 'admin', 'dist');
app.get('/admin', (req, res) => res.redirect('/panel')); // the old admin panel address
app.use(express.static(webDist));
// any other page address is handled by the React app (browser page requests only, never the API)
app.use((req, res, next) => {
  if (req.method === 'GET' && (req.get('accept') || '').includes('text/html'))
    return res.sendFile(path.join(webDist, 'index.html'), (err) => err && next());
  next();
});

infra.init({ db, expireOrders }).then(() => {
  app.listen(PORT, process.env.HOST || '0.0.0.0', () => console.log(`Shop server on port ${PORT} (storage: ${infra.mode})`));
});

for (const sig of ['SIGINT', 'SIGTERM']) {
  process.on(sig, () => infra.close().finally(() => process.exit(0)));
}
