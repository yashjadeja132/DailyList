// Plans, subscriptions, team members (several phones on one shop account) and order limits.
//
//  Shop owners  -> must buy a plan after sign-up. A plan says how many phones (users) can share the
//                  same shop account (max_users).
//  Customers    -> start on the default (free) plan automatically. A plan limits how many orders they
//                  can send to each shop (max_orders_per_shop) and how many different shops they can
//                  order from (max_shops) in one billing cycle. 0 means "unlimited".
//
// Billing cycle: a paid plan's cycle is the whole subscription (start -> expiry). A plan with no
// expiry (the free plan) uses rolling 30-day cycles counted from when it started.

const DAY_MS = 24 * 60 * 60 * 1000;
const sqlTime = (ms) => new Date(ms).toISOString().slice(0, 19).replace('T', ' ');
const parseTime = (s) => Date.parse(String(s).replace(' ', 'T') + 'Z');

const ACTIVE = "status = 'active' AND (expires_at IS NULL OR expires_at > datetime('now'))";

function setup(db) {
  db.exec(`
  CREATE TABLE IF NOT EXISTS plans (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    audience TEXT NOT NULL CHECK (audience IN ('owner','customer')),
    name TEXT NOT NULL,
    description TEXT NOT NULL DEFAULT '',
    price REAL NOT NULL DEFAULT 0,
    duration_days INTEGER NOT NULL DEFAULT 30,      -- 0 = never expires (free plans)
    max_users INTEGER NOT NULL DEFAULT 1,           -- owner plans: phones that can share one shop account
    max_orders_per_shop INTEGER NOT NULL DEFAULT 0, -- customer plans: orders per shop per cycle (0 = unlimited)
    max_shops INTEGER NOT NULL DEFAULT 0,           -- customer plans: shops they can order from per cycle (0 = unlimited)
    is_default INTEGER NOT NULL DEFAULT 0,          -- given automatically (customer free plan)
    active INTEGER NOT NULL DEFAULT 1,
    sort INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
  CREATE TABLE IF NOT EXISTS subscriptions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER REFERENCES users(id),   -- customer subscriptions
    shop_id INTEGER REFERENCES shops(id),   -- shop owner subscriptions
    plan_id INTEGER NOT NULL REFERENCES plans(id),
    status TEXT NOT NULL DEFAULT 'active',  -- active | replaced | cancelled
    started_at TEXT NOT NULL DEFAULT (datetime('now')),
    expires_at TEXT,
    source TEXT NOT NULL DEFAULT 'purchase', -- purchase | admin | default
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
  CREATE TABLE IF NOT EXISTS payments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    subscription_id INTEGER REFERENCES subscriptions(id),
    user_id INTEGER REFERENCES users(id),
    shop_id INTEGER REFERENCES shops(id),
    plan_id INTEGER REFERENCES plans(id),
    amount REAL NOT NULL,
    currency TEXT NOT NULL DEFAULT 'INR',
    status TEXT NOT NULL DEFAULT 'paid',
    method TEXT NOT NULL DEFAULT 'mock',
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
  CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT NOT NULL DEFAULT '');
  CREATE TABLE IF NOT EXISTS admin_sessions (token TEXT PRIMARY KEY, created_at TEXT NOT NULL DEFAULT (datetime('now')));
  CREATE INDEX IF NOT EXISTS idx_sub_shop ON subscriptions(shop_id);
  CREATE INDEX IF NOT EXISTS idx_sub_user ON subscriptions(user_id);
  `);

  // online payments: our order id at the gateway, its payment id, and when it was paid
  for (const [col, def] of [['gateway_order_id', 'TEXT'], ['gateway_payment_id', 'TEXT'], ['paid_at', 'TEXT']])
    if (!db.prepare('PRAGMA table_info(payments)').all().some((c) => c.name === col)) db.exec(`ALTER TABLE payments ADD COLUMN ${col} ${def}`);
  db.exec('CREATE UNIQUE INDEX IF NOT EXISTS idx_payments_gateway_order ON payments (gateway_order_id)');

  // when the 'plan ends soon' reminder was sent (so it is only sent once)
  if (!db.prepare('PRAGMA table_info(subscriptions)').all().some((c) => c.name === 'reminded_at'))
    db.exec('ALTER TABLE subscriptions ADD COLUMN reminded_at TEXT');

  if (db.prepare('SELECT COUNT(*) c FROM plans').get().c === 0) {
    const ins = db.prepare(`INSERT INTO plans
      (audience, name, description, price, duration_days, max_users, max_orders_per_shop, max_shops, is_default, sort)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`);
    ins.run('owner', 'Shop Basic', 'One phone can use the shop account.', 299, 30, 1, 0, 0, 0, 1);
    ins.run('owner', 'Shop Plus', 'Up to 5 phones can share the shop account.', 599, 30, 5, 0, 0, 0, 2);
    ins.run('customer', 'Starter (Free)', 'Free plan. A few orders per shop each month.', 0, 0, 1, 5, 3, 1, 1);
    ins.run('customer', 'Plus', 'More orders and more shops.', 49, 30, 1, 20, 10, 0, 2);
    ins.run('customer', 'Unlimited', 'No limits on orders or shops.', 99, 30, 1, 0, 0, 0, 3);
  }

  const defaults = {
    apk_url: '',
    play_store_url: '',
    app_version: '1.0.0',
    support_email: '',
    support_phone: '',
    shop_response_minutes: '30',      // a shop that does not answer a new order in this time: order expires
    customer_response_minutes: '60',
    pickup_window_minutes: '240',     // a ready order not collected in this time: the shop may mark it as not collected
    pickup_reminder_minutes: '120',   // reminder to the customer after this long
    shop_categories: 'Grocery,Dairy,Bakery,Stationery,Hardware,General store',  // a customer who does not answer a partial-quantity question in this time: order expires
  };
  const has = db.prepare('SELECT 1 FROM settings WHERE key = ?');
  const put = db.prepare('INSERT INTO settings (key, value) VALUES (?, ?)');
  for (const [k, v] of Object.entries(defaults)) if (!has.get(k)) put.run(k, v);
}

// PAYMENT_MODE: 'mock' (default, nobody is charged) or 'cashfree' (real payments, see services/cashfree)
const PAYMENT_MODE = process.env.PAYMENT_MODE || 'mock';
const cashfree = require('./services/cashfree');

module.exports = function billing(app, ctx) {
  const { db, auth, owner, cleanPhone } = ctx;
  setup(db);

  const planOf = (id) => db.prepare('SELECT * FROM plans WHERE id = ?').get(id);

  // ---- current subscriptions
  const shopSub = (shopId) =>
    db.prepare(`SELECT * FROM subscriptions WHERE shop_id = ? AND ${ACTIVE} ORDER BY id DESC LIMIT 1`).get(shopId);

  function newSub({ userId = null, shopId = null, plan, source, baseExpiry = null }) {
    const started = sqlTime(Date.now());
    let expires = null;
    if (plan.duration_days > 0) expires = sqlTime(Math.max(Date.now(), baseExpiry ? parseTime(baseExpiry) : 0) + plan.duration_days * DAY_MS);
    const col = shopId ? 'shop_id' : 'user_id';
    db.prepare(`UPDATE subscriptions SET status = 'replaced' WHERE ${col} = ? AND status = 'active'`).run(shopId || userId);
    const info = db.prepare(
      'INSERT INTO subscriptions (user_id, shop_id, plan_id, status, started_at, expires_at, source) VALUES (?, ?, ?, ?, ?, ?, ?)')
      .run(userId, shopId, plan.id, 'active', started, expires, source);
    return db.prepare('SELECT * FROM subscriptions WHERE id = ?').get(info.lastInsertRowid);
  }

  // customers always have a plan: the default (free) one unless they bought another
  function userSub(userId) {
    let sub = db.prepare(`SELECT * FROM subscriptions WHERE user_id = ? AND ${ACTIVE} ORDER BY id DESC LIMIT 1`).get(userId);
    if (!sub) {
      const def = db.prepare("SELECT * FROM plans WHERE audience = 'customer' AND is_default = 1 AND active = 1 ORDER BY id LIMIT 1").get();
      if (def) sub = newSub({ userId, plan: def, source: 'default' });
    }
    return sub || null;
  }

  // start of the customer's current billing cycle
  function cycleStart(sub) {
    const started = parseTime(sub.started_at);
    if (sub.expires_at) return sub.started_at; // paid plan: whole subscription
    const n = Math.floor((Date.now() - started) / (30 * DAY_MS));
    return sqlTime(started + Math.max(0, n) * 30 * DAY_MS);
  }

  const memberCount = (shopId) => db.prepare('SELECT COUNT(*) c FROM shop_members WHERE shop_id = ?').get(shopId).c;

  function describe(sub) {
    if (!sub) return null;
    const plan = planOf(sub.plan_id);
    const daysLeft = sub.expires_at ? Math.max(0, Math.ceil((parseTime(sub.expires_at) - Date.now()) / DAY_MS)) : null;
    return {
      id: sub.id, active: true, started_at: sub.started_at, expires_at: sub.expires_at, days_left: daysLeft,
      plan,
    };
  }

  function customerUsage(userId, sub) {
    const since = cycleStart(sub);
    const orders = db.prepare(
      "SELECT shop_id, COUNT(*) c FROM orders WHERE user_id = ? AND status NOT IN ('Cancelled','Declined','Expired') AND created_at >= ? GROUP BY shop_id")
      .all(userId, since);
    return {
      cycle_start: since,
      orders_total: orders.reduce((n, o) => n + o.c, 0),
      shops_used: orders.length,
      per_shop: Object.fromEntries(orders.map((o) => [o.shop_id, o.c])),
    };
  }

  // Everything the app needs to know about the caller's plan.
  function accountInfo(user, shop) {
    if (user.role === 'owner') {
      if (!shop) return { subscription: null, team: null };
      const sub = describe(shopSub(shop.id));
      const primary = db.prepare('SELECT is_primary FROM shop_members WHERE shop_id = ? AND user_id = ?').get(shop.id, user.id);
      return {
        subscription: sub,
        team: { count: memberCount(shop.id), max: sub ? sub.plan.max_users : 0, is_primary: !!primary?.is_primary },
      };
    }
    const raw = userSub(user.id);
    return { subscription: describe(raw), usage: raw ? customerUsage(user.id, raw) : null };
  }

  // ---- used by index.js
  ctx.shopHasPlan = (shopId) => !!shopSub(shopId);
  ctx.accountInfo = accountInfo;
  ctx.activeOwner = (req, res, next) => {
    if (shopSub(req.shop.id)) return next();
    res.status(402).json({ error: 'Your shop needs an active plan. Please choose a plan.', code: 'plan_required' });
  };
  ctx.billingHelpers = { planOf, newSub, shopSub, userSub, describe, customerUsage, memberCount, sqlTime };

  // May this customer send another order to this shop? Returns null when fine, or an error object.
  ctx.checkOrderLimits = (userId, shopId) => {
    const sub = userSub(userId);
    if (!sub) return null; // no plans configured: no limits
    const plan = planOf(sub.plan_id);
    const usage = customerUsage(userId, sub);
    const sentToShop = usage.per_shop[shopId] || 0;
    if (!sentToShop && plan.max_shops > 0 && usage.shops_used >= plan.max_shops)
      return {
        code: 'limit_reached', kind: 'shops',
        error: `Your ${plan.name} plan lets you order from ${plan.max_shops} shop${plan.max_shops > 1 ? 's' : ''}. Upgrade your plan to use more shops.`,
      };
    if (plan.max_orders_per_shop > 0 && sentToShop >= plan.max_orders_per_shop)
      return {
        code: 'limit_reached', kind: 'orders',
        error: `You have used all ${plan.max_orders_per_shop} orders for this shop in your ${plan.name} plan. Upgrade your plan to send more.`,
      };
    return null;
  };

  // ---- plans & subscription (app)
  app.get('/plans', auth, (req, res) => {
    res.json(db.prepare('SELECT * FROM plans WHERE audience = ? AND active = 1 ORDER BY sort, price, id').all(req.user.role));
  });

  app.get('/subscription', auth, (req, res) => {
    const shop = req.user.role === 'owner' ? ctx.shopOf(req.user.id) : null;
    res.json({ ...accountInfo(req.user, shop), payment_mode: PAYMENT_MODE });
  });

  // Buying a plan. There is no payment gateway yet: with PAYMENT_MODE=mock (default) the payment is
  // simply recorded as paid. Connect a real gateway here before charging real money.
  app.post('/subscription/purchase', auth, (req, res) => {
    const plan = planOf(req.body.plan_id);
    if (!plan || !plan.active || plan.audience !== req.user.role)
      return res.status(400).json({ error: 'This plan is not available' });

    let shop = null;
    if (req.user.role === 'owner') {
      shop = ctx.shopOf(req.user.id);
      if (!shop) return res.status(400).json({ error: 'No shop found for this account' });
      const m = db.prepare('SELECT is_primary FROM shop_members WHERE shop_id = ? AND user_id = ?').get(shop.id, req.user.id);
      if (!m?.is_primary) return res.status(403).json({ error: 'Only the main shop owner can change the plan' });
      const extra = memberCount(shop.id) - plan.max_users;
      if (extra > 0)
        return res.status(400).json({ error: `This plan allows ${plan.max_users} user${plan.max_users > 1 ? 's' : ''}. Remove ${extra} team member${extra > 1 ? 's' : ''} first.` });
    }

    const current = shop ? shopSub(shop.id) : userSub(req.user.id);
    const renew = current && current.plan_id === plan.id && current.expires_at ? current.expires_at : null;

    // real payment: create a Cashfree order, the app opens the checkout and then asks us to confirm
    if (plan.price > 0 && PAYMENT_MODE === 'cashfree') {
      if (!cashfree.enabled()) return res.status(501).json({ error: 'Online payment is not set up yet' });
      const orderId = `DL${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`.toUpperCase();
      const p = db.prepare("INSERT INTO payments (user_id, shop_id, plan_id, amount, status, method, gateway_order_id) VALUES (?, ?, ?, ?, 'pending', 'cashfree', ?)")
        .run(req.user.id, shop ? shop.id : null, plan.id, plan.price, orderId);
      cashfree.createOrder({
        orderId, amount: plan.price, note: `DailyList ${plan.name}`,
        customer: { id: `u${req.user.id}`, phone: req.user.phone, name: req.user.name },
        returnUrl: cashfree.returnUrlFor(), notifyUrl: cashfree.notifyUrl(),
      }).then((o) => res.json({
        payment_required: true, order_id: orderId, payment_session_id: o.payment_session_id,
        environment: cashfree.environment, amount: plan.price, plan_name: plan.name,
      })).catch((e) => {
        db.prepare("UPDATE payments SET status = 'failed' WHERE id = ?").run(p.lastInsertRowid);
        res.status(e.status && e.status < 500 ? 400 : 502).json({ error: e.message });
      });
      return;
    }
    if (plan.price > 0 && PAYMENT_MODE !== 'mock')
      return res.status(501).json({ error: 'Online payment is not set up yet' });

    const result = db.transaction(() => {
      const sub = newSub({ userId: shop ? null : req.user.id, shopId: shop ? shop.id : null, plan, source: 'purchase', baseExpiry: renew });
      if (plan.price > 0)
        db.prepare('INSERT INTO payments (subscription_id, user_id, shop_id, plan_id, amount, method) VALUES (?, ?, ?, ?, ?, ?)')
          .run(sub.id, req.user.id, shop ? shop.id : null, plan.id, plan.price, PAYMENT_MODE);
      return sub;
    })();
    res.json({ ok: true, ...accountInfo(req.user, shop), subscription: describe(result) });
  });

  // A payment is complete: switch the plan on. Safe to call twice (the webhook and the app both do).
  const settle = (payment, gatewayPaymentId) => {
    const done = db.transaction(() => {
      const p = db.prepare('SELECT * FROM payments WHERE id = ?').get(payment.id);
      if (p.status === 'paid') return null;
      const plan = planOf(p.plan_id);
      const current = p.shop_id ? shopSub(p.shop_id) : userSub(p.user_id);
      const renew = current && current.plan_id === plan.id && current.expires_at ? current.expires_at : null;
      const sub = newSub({ userId: p.shop_id ? null : p.user_id, shopId: p.shop_id || null, plan, source: 'purchase', baseExpiry: renew });
      db.prepare("UPDATE payments SET status = 'paid', subscription_id = ?, gateway_payment_id = ?, paid_at = datetime('now') WHERE id = ?")
        .run(sub.id, gatewayPaymentId || null, p.id);
      return sub;
    })();
    return done;
  };

  // The app calls this after the checkout closes: we ask Cashfree what really happened. { order_id }
  app.post('/subscription/confirm', auth, async (req, res) => {
    const p = db.prepare('SELECT * FROM payments WHERE gateway_order_id = ? AND user_id = ?').get(String(req.body.order_id || ''), req.user.id);
    if (!p) return res.status(404).json({ error: 'Payment not found' });
    const shop = req.user.role === 'owner' ? ctx.shopOf(req.user.id) : null;
    const reply = (status) => res.json({ status, ...accountInfo(req.user, shop) });
    if (p.status === 'paid') return reply('paid');
    try {
      const order = await cashfree.getOrder(p.gateway_order_id);
      if (order.order_status === 'PAID') {
        const pays = await cashfree.getPayments(p.gateway_order_id).catch(() => []);
        const ok = Array.isArray(pays) ? pays.find((x) => x.payment_status === 'SUCCESS') : null;
        settle(p, ok ? String(ok.cf_payment_id) : '');
        return reply('paid');
      }
      if (['EXPIRED', 'TERMINATED', 'TERMINATION_REQUESTED'].includes(order.order_status)) {
        db.prepare("UPDATE payments SET status = 'failed' WHERE id = ? AND status = 'pending'").run(p.id);
        return reply('failed');
      }
      return reply('pending'); // still waiting (for example a UPI approval)
    } catch (e) { res.status(502).json({ error: e.message }); }
  });

  // Cashfree calls this when a payment finishes. It is checked with the signature, nobody else can use it.
  app.post('/webhooks/cashfree', (req, res) => {
    if (!cashfree.verifyWebhook(req.rawBody, req.get('x-webhook-signature'), req.get('x-webhook-timestamp')))
      return res.status(401).json({ error: 'Bad signature' });
    const ev = cashfree.parseEvent(req.body);
    if (ev) {
      const p = db.prepare('SELECT * FROM payments WHERE gateway_order_id = ?').get(ev.orderId);
      if (p && ev.status === 'paid') settle(p, ev.paymentId);
      else if (p && ev.status === 'failed') db.prepare("UPDATE payments SET status = 'failed' WHERE id = ? AND status = 'pending'").run(p.id);
    }
    res.json({ ok: true });
  });

  // Where the checkout lands when it is done. The app is watching for this address, the page is only a fallback.
  app.get('/pay/return', (_, res) => res.type('html').send(
    '<!doctype html><meta name="viewport" content="width=device-width,initial-scale=1"><body style="font-family:sans-serif;text-align:center;padding:48px 20px;color:#111827">' +
    '<h2>Payment received</h2><p>You can go back to the DailyList app.</p></body>'));

  // ---- team: several phones using one shop account (limited by the plan's max_users)
  const primaryOnly = (req, res, next) => {
    const m = db.prepare('SELECT is_primary FROM shop_members WHERE shop_id = ? AND user_id = ?').get(req.shop.id, req.user.id);
    if (!m?.is_primary) return res.status(403).json({ error: 'Only the main shop owner can manage the team' });
    next();
  };

  const teamList = (shopId) => db.prepare(`SELECT u.id, u.name, u.phone, m.is_primary FROM shop_members m
    JOIN users u ON u.id = m.user_id WHERE m.shop_id = ? ORDER BY m.is_primary DESC, m.added_at`).all(shopId);

  app.get('/team', auth, owner, (req, res) => {
    const sub = describe(shopSub(req.shop.id));
    res.json({ members: teamList(req.shop.id), max: sub ? sub.plan.max_users : 0 });
  });

  app.post('/team', auth, owner, primaryOnly, (req, res) => {
    const sub = describe(shopSub(req.shop.id));
    if (!sub) return res.status(402).json({ error: 'Choose a plan before adding team members', code: 'plan_required' });
    const phone = cleanPhone(req.body.phone);
    const name = String(req.body.name || '').trim();
    if (phone.replace(/\D/g, '').length < 10) return res.status(400).json({ error: 'Enter a valid phone number' });
    if (!name) return res.status(400).json({ error: 'Enter the team member\'s name' });
    if (memberCount(req.shop.id) >= sub.plan.max_users)
      return res.status(403).json({
        error: `Your ${sub.plan.name} plan allows ${sub.plan.max_users} user${sub.plan.max_users > 1 ? 's' : ''}. Upgrade your plan to add more.`,
        code: 'limit_reached',
      });

    const existing = db.prepare('SELECT * FROM users WHERE phone = ?').get(phone);
    if (existing && existing.role !== 'owner')
      return res.status(400).json({ error: 'This number is already registered as a customer.' });
    if (existing && db.prepare('SELECT 1 FROM shop_members WHERE user_id = ?').get(existing.id))
      return res.status(400).json({ error: 'This number already belongs to a shop account.' });

    db.transaction(() => {
      const uid = existing ? existing.id : db.prepare('INSERT INTO users (name, phone, role) VALUES (?, ?, ?)').run(name.slice(0, 60), phone, 'owner').lastInsertRowid;
      db.prepare('INSERT INTO shop_members (shop_id, user_id, is_primary) VALUES (?, ?, 0)').run(req.shop.id, uid);
    })();
    res.json({ members: teamList(req.shop.id), max: sub.plan.max_users });
  });

  app.delete('/team/:userId', auth, owner, primaryOnly, (req, res) => {
    const uid = Number(req.params.userId);
    const m = db.prepare('SELECT * FROM shop_members WHERE shop_id = ? AND user_id = ?').get(req.shop.id, uid);
    if (!m) return res.status(404).json({ error: 'Team member not found' });
    if (m.is_primary) return res.status(400).json({ error: 'The main owner cannot be removed' });
    db.transaction(() => {
      db.prepare('DELETE FROM shop_members WHERE shop_id = ? AND user_id = ?').run(req.shop.id, uid);
      db.prepare('DELETE FROM sessions WHERE user_id = ?').run(uid); // signs them out right away
    })();
    const sub = describe(shopSub(req.shop.id));
    res.json({ members: teamList(req.shop.id), max: sub ? sub.plan.max_users : 0 });
  });
};

module.exports.sqlTime = sqlTime;
module.exports.parseTime = parseTime;
