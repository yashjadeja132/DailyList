// Admin API (used by the admin panel) and the public app-info endpoint (used by the download page).
const crypto = require('crypto');

const ADMIN_USER = process.env.ADMIN_USER || 'admin';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'admin123';

const same = (a, b) => {
  const x = crypto.createHash('sha256').update(String(a)).digest();
  const y = crypto.createHash('sha256').update(String(b)).digest();
  return crypto.timingSafeEqual(x, y);
};

// The app name and tagline are fixed text on the public page; only these can be changed.
const ADMIN_ONLY_KEYS = ['shop_response_minutes', 'customer_response_minutes', 'pickup_window_minutes', 'pickup_reminder_minutes'];
const SETTING_KEYS = ['apk_url', 'play_store_url', 'app_version', 'support_email', 'support_phone'];

module.exports = function admin(app, ctx) {
  const { db, cleanPhone } = ctx;
  const { planOf, newSub, shopSub, userSub, describe, memberCount, sqlTime } = ctx.billingHelpers;

  if (ADMIN_PASSWORD === 'admin123')
    console.log('[admin] Using the default admin login (admin / admin123). Set ADMIN_USER and ADMIN_PASSWORD before going live.');

  const settings = () => Object.fromEntries(db.prepare('SELECT key, value FROM settings').all().map((r) => [r.key, r.value]));

  // ---- public: what the download page shows
  app.get('/public/app-info', (_, res) => {
    const s = settings();
    res.json(Object.fromEntries(SETTING_KEYS.map((k) => [k, s[k] || ''])));
  });

  // ---- public: the plans shown on the website (always the current ones from the admin panel)
  app.get('/public/plans', (_, res) => {
    const rows = db.prepare(
      "SELECT id, audience, name, description, price, duration_days, max_users, max_orders_per_shop, max_shops, is_default FROM plans WHERE active = 1 ORDER BY sort, price, id").all();
    res.json({
      customer: rows.filter((p) => p.audience === 'customer'),
      owner: rows.filter((p) => p.audience === 'owner'),
    });
  });

  // ---- admin login
  app.post('/admin/login', (req, res) => {
    const { username, password } = req.body || {};
    if (!same(username || '', ADMIN_USER) || !same(password || '', ADMIN_PASSWORD))
      return res.status(401).json({ error: 'Wrong username or password' });
    const token = crypto.randomBytes(24).toString('hex');
    db.prepare('INSERT INTO admin_sessions (token) VALUES (?)').run(token);
    res.json({ token });
  });

  const adminAuth = (req, res, next) => {
    const token = (req.get('authorization') || '').replace('Bearer ', '');
    if (!token || !db.prepare('SELECT 1 FROM admin_sessions WHERE token = ?').get(token))
      return res.status(401).json({ error: 'Please log in again' });
    req.adminToken = token;
    next();
  };

  app.post('/admin/logout', adminAuth, (req, res) => {
    db.prepare('DELETE FROM admin_sessions WHERE token = ?').run(req.adminToken);
    res.json({ ok: true });
  });

  // ---- dashboard numbers
  app.get('/admin/stats', adminAuth, (_, res) => {
    const one = (sql) => db.prepare(sql).get();
    const activeShopSubs = db.prepare(
      "SELECT COUNT(DISTINCT shop_id) c FROM subscriptions WHERE shop_id IS NOT NULL AND status = 'active' AND (expires_at IS NULL OR expires_at > datetime('now'))").get().c;
    res.json({
      shops: one('SELECT COUNT(*) c FROM shops').c,
      shops_with_plan: activeShopSubs,
      customers: one("SELECT COUNT(*) c FROM users WHERE role = 'customer'").c,
      orders: one('SELECT COUNT(*) c FROM orders').c,
      orders_7d: one("SELECT COUNT(*) c FROM orders WHERE created_at >= datetime('now', '-7 days')").c,
      revenue: one("SELECT COALESCE(SUM(amount), 0) s FROM payments WHERE status = 'paid'").s,
      revenue_30d: one("SELECT COALESCE(SUM(amount), 0) s FROM payments WHERE status = 'paid' AND created_at >= datetime('now', '-30 days')").s,
      plans: one('SELECT COUNT(*) c FROM plans WHERE active = 1').c,
    });
  });

  // ---- Redis and background-job status
  app.get('/admin/system', adminAuth, async (_, res) => res.json(await require('./infra').status()));

  // ---- plans
  const planBody = (b) => {
    const int = (v, min = 0) => Math.max(min, Math.floor(Number(v) || 0));
    const audience = b.audience === 'owner' ? 'owner' : 'customer';
    return {
      audience,
      name: String(b.name || '').trim().slice(0, 60),
      description: String(b.description || '').trim().slice(0, 300),
      price: Math.max(0, Number(b.price) || 0),
      duration_days: int(b.duration_days),
      max_users: audience === 'owner' ? int(b.max_users, 1) : 1,
      max_orders_per_shop: audience === 'customer' ? int(b.max_orders_per_shop) : 0,
      max_shops: audience === 'customer' ? int(b.max_shops) : 0,
      is_default: audience === 'customer' && b.is_default ? 1 : 0,
      active: b.active === false || b.active === 0 ? 0 : 1,
      sort: int(b.sort),
    };
  };

  const subCount = (planId) => db.prepare('SELECT COUNT(*) c FROM subscriptions WHERE plan_id = ?').get(planId).c;
  const activeSubCount = (planId) => db.prepare(
    "SELECT COUNT(*) c FROM subscriptions WHERE plan_id = ? AND status = 'active' AND (expires_at IS NULL OR expires_at > datetime('now'))").get(planId).c;

  app.get('/admin/plans', adminAuth, (_, res) => {
    const plans = db.prepare('SELECT * FROM plans ORDER BY audience, sort, price, id').all()
      .map((p) => ({ ...p, subscribers: activeSubCount(p.id) }));
    res.json(plans);
  });

  const savePlan = (id, b, res) => {
    const p = planBody(b);
    if (!p.name) return res.status(400).json({ error: 'Plan name is required' });
    if (p.is_default && p.price > 0) return res.status(400).json({ error: 'The default plan must be free' });
    db.transaction(() => {
      if (p.is_default) db.prepare("UPDATE plans SET is_default = 0 WHERE audience = 'customer'").run();
      if (id) {
        db.prepare(`UPDATE plans SET name=?, description=?, price=?, duration_days=?, max_users=?, max_orders_per_shop=?,
          max_shops=?, is_default=?, active=?, sort=? WHERE id=?`)
          .run(p.name, p.description, p.price, p.duration_days, p.max_users, p.max_orders_per_shop, p.max_shops, p.is_default, p.active, p.sort, id);
      } else {
        id = db.prepare(`INSERT INTO plans (audience, name, description, price, duration_days, max_users, max_orders_per_shop,
          max_shops, is_default, active, sort) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
          .run(p.audience, p.name, p.description, p.price, p.duration_days, p.max_users, p.max_orders_per_shop, p.max_shops, p.is_default, p.active, p.sort).lastInsertRowid;
      }
    })();
    res.json(planOf(id));
  };

  app.post('/admin/plans', adminAuth, (req, res) => savePlan(null, req.body || {}, res));
  app.put('/admin/plans/:id', adminAuth, (req, res) => {
    const cur = planOf(req.params.id);
    if (!cur) return res.status(404).json({ error: 'Plan not found' });
    savePlan(cur.id, { ...req.body, audience: cur.audience }, res); // audience cannot change
  });
  app.delete('/admin/plans/:id', adminAuth, (req, res) => {
    const cur = planOf(req.params.id);
    if (!cur) return res.status(404).json({ error: 'Plan not found' });
    if (subCount(cur.id) > 0) {
      db.prepare('UPDATE plans SET active = 0, is_default = 0 WHERE id = ?').run(cur.id);
      return res.json({ deactivated: true });
    }
    db.prepare('DELETE FROM plans WHERE id = ?').run(cur.id);
    res.json({ deleted: true });
  });

  // ---- shops (owners) and their subscriptions
  const shopRow = (s) => {
    const sub = describe(shopSub(s.id));
    const o = db.prepare('SELECT name, phone FROM users WHERE id = ?').get(s.owner_id);
    return {
      id: s.id, name: s.name, address: s.address, has_location: s.lat != null,
      approval: s.approval, approval_note: s.approval_note, phone: s.phone, category: s.category, accepting: s.accepting,
      owner_id: s.owner_id, owner_name: o?.name, owner_phone: o?.phone,
      owner_blocked: db.prepare('SELECT blocked FROM users WHERE id = ?').get(s.owner_id)?.blocked,
      members: memberCount(s.id),
      orders: db.prepare('SELECT COUNT(*) c FROM orders WHERE shop_id = ?').get(s.id).c,
      subscription: sub && { plan_id: sub.plan.id, plan_name: sub.plan.name, max_users: sub.plan.max_users, expires_at: sub.expires_at, days_left: sub.days_left },
    };
  };

  app.get('/admin/shops', adminAuth, (_, res) =>
    res.json(db.prepare('SELECT * FROM shops ORDER BY id DESC').all().map(shopRow)));

  app.get('/admin/shops/:id/team', adminAuth, (req, res) =>
    res.json(db.prepare(`SELECT u.id, u.name, u.phone, m.is_primary FROM shop_members m JOIN users u ON u.id = m.user_id
      WHERE m.shop_id = ? ORDER BY m.is_primary DESC, m.added_at`).all(req.params.id)));

  // give a shop a plan (optionally for a custom number of days)
  app.post('/admin/shops/:id/subscription', adminAuth, (req, res) => {
    const shop = db.prepare('SELECT * FROM shops WHERE id = ?').get(req.params.id);
    const plan = planOf(req.body.plan_id);
    if (!shop) return res.status(404).json({ error: 'Shop not found' });
    if (!plan || plan.audience !== 'owner') return res.status(400).json({ error: 'Choose a shop owner plan' });
    const days = Math.floor(Number(req.body.days) || 0);
    db.transaction(() => {
      const sub = newSub({ shopId: shop.id, plan, source: 'admin' });
      if (days > 0) db.prepare('UPDATE subscriptions SET expires_at = ? WHERE id = ?').run(sqlTime(Date.now() + days * 86400000), sub.id);
    })();
    res.json(shopRow(shop));
  });

  app.delete('/admin/shops/:id/subscription', adminAuth, (req, res) => {
    db.prepare("UPDATE subscriptions SET status = 'cancelled' WHERE shop_id = ? AND status = 'active'").run(req.params.id);
    const shop = db.prepare('SELECT * FROM shops WHERE id = ?').get(req.params.id);
    res.json(shop ? shopRow(shop) : { ok: true });
  });

  // ---- customers
  const customerRow = (u) => {
    const sub = describe(userSub(u.id));
    return {
      id: u.id, name: u.name, phone: u.phone, blocked: u.blocked, no_show_count: u.no_show_count,
      orders: db.prepare('SELECT COUNT(*) c FROM orders WHERE user_id = ?').get(u.id).c,
      shops: db.prepare('SELECT COUNT(DISTINCT shop_id) c FROM orders WHERE user_id = ?').get(u.id).c,
      subscription: sub && { plan_id: sub.plan.id, plan_name: sub.plan.name, expires_at: sub.expires_at, days_left: sub.days_left },
    };
  };

  app.get('/admin/customers', adminAuth, (_, res) =>
    res.json(db.prepare("SELECT * FROM users WHERE role = 'customer' ORDER BY id DESC").all().map(customerRow)));

  app.post('/admin/customers/:id/subscription', adminAuth, (req, res) => {
    const user = db.prepare("SELECT * FROM users WHERE id = ? AND role = 'customer'").get(req.params.id);
    const plan = planOf(req.body.plan_id);
    if (!user) return res.status(404).json({ error: 'Customer not found' });
    if (!plan || plan.audience !== 'customer') return res.status(400).json({ error: 'Choose a customer plan' });
    const days = Math.floor(Number(req.body.days) || 0);
    db.transaction(() => {
      const sub = newSub({ userId: user.id, plan, source: 'admin' });
      if (days > 0) db.prepare('UPDATE subscriptions SET expires_at = ? WHERE id = ?').run(sqlTime(Date.now() + days * 86400000), sub.id);
    })();
    res.json(customerRow(user));
  });

  // ---- payments
  app.get('/admin/payments', adminAuth, (_, res) =>
    res.json(db.prepare(`SELECT p.id, p.amount, p.currency, p.status, p.method, p.created_at,
        pl.name AS plan_name, pl.audience, u.name AS user_name, u.phone AS user_phone, s.name AS shop_name
      FROM payments p LEFT JOIN plans pl ON pl.id = p.plan_id LEFT JOIN users u ON u.id = p.user_id
      LEFT JOIN shops s ON s.id = p.shop_id ORDER BY p.id DESC LIMIT 500`).all()));


  // ---- shop approval: pending | approved | suspended | rejected
  app.put('/admin/shops/:id/approval', adminAuth, (req, res) => {
    const shop = db.prepare('SELECT * FROM shops WHERE id = ?').get(req.params.id);
    if (!shop) return res.status(404).json({ error: 'Shop not found' });
    if (!['pending', 'approved', 'suspended', 'rejected'].includes(req.body.approval)) return res.status(400).json({ error: 'Invalid status' });
    const note = String(req.body.note || '').trim().slice(0, 300);
    db.prepare('UPDATE shops SET approval = ?, approval_note = ? WHERE id = ?').run(req.body.approval, note, shop.id);
    const msg = { approved: 'Your shop is approved. Customers can now find you.', suspended: 'Your shop has been suspended' + (note ? ': ' + note : '.'),
      rejected: 'Your shop registration was not approved' + (note ? ': ' + note : '.'), pending: 'Your shop is under review.' }[req.body.approval];
    db.prepare('INSERT INTO notifications (user_id, title, body) VALUES (?, ?, ?)').run(shop.owner_id, 'Shop review', msg);
    res.json(shopRow(db.prepare('SELECT * FROM shops WHERE id = ?').get(shop.id)));
  });

  // ---- block / unblock an account (abuse, fake shops, harassment)
  app.post('/admin/users/:id/block', adminAuth, (req, res) => {
    const u = db.prepare('SELECT * FROM users WHERE id = ?').get(req.params.id);
    if (!u) return res.status(404).json({ error: 'User not found' });
    const blocked = req.body.blocked ? 1 : 0;
    db.transaction(() => {
      db.prepare('UPDATE users SET blocked = ? WHERE id = ?').run(blocked, u.id);
      if (blocked) db.prepare('DELETE FROM sessions WHERE user_id = ?').run(u.id);
    })();
    res.json({ id: u.id, blocked });
  });

  // ---- order lookup for support: by order number, pickup code, phone or shop name
  app.get('/admin/orders', adminAuth, (req, res) => {
    const q = String(req.query.q || '').trim();
    const like = '%' + q + '%';
    const rows = db.prepare(`SELECT o.id, o.code, o.status, o.created_at, o.customer_name, o.phone, o.rating, s.name AS shop_name
      FROM orders o JOIN shops s ON s.id = o.shop_id
      WHERE ? = '' OR CAST(o.id AS TEXT) = ? OR o.code = upper(?) OR o.phone LIKE ? OR s.name LIKE ? OR o.customer_name LIKE ?
      ORDER BY o.id DESC LIMIT 100`).all(q, q, q, like, like, like);
    res.json(rows);
  });
  app.get('/admin/orders/:id', adminAuth, (req, res) => {
    const o = db.prepare('SELECT o.*, s.name AS shop_name FROM orders o JOIN shops s ON s.id = o.shop_id WHERE o.id = ?').get(req.params.id);
    if (!o) return res.status(404).json({ error: 'Order not found' });
    res.json({
      ...o,
      items: db.prepare('SELECT name, qty, state, avail_qty, response FROM order_items WHERE order_id = ? ORDER BY id').all(o.id),
      events: db.prepare('SELECT actor, event, detail, at FROM order_events WHERE order_id = ? ORDER BY id').all(o.id),
    });
  });

  // ---- complaints
  app.get('/admin/complaints', adminAuth, (req, res) => {
    const status = ['open', 'resolved', 'dismissed'].includes(req.query.status) ? req.query.status : null;
    res.json(db.prepare(`SELECT c.*, u.name AS user_name, u.phone AS user_phone, u.role AS user_role, s.name AS shop_name
      FROM complaints c JOIN users u ON u.id = c.user_id LEFT JOIN shops s ON s.id = c.shop_id
      WHERE (? IS NULL OR c.status = ?) ORDER BY (c.status = 'open') DESC, c.id DESC LIMIT 200`).all(status, status));
  });
  app.put('/admin/complaints/:id', adminAuth, (req, res) => {
    const c = db.prepare('SELECT * FROM complaints WHERE id = ?').get(req.params.id);
    if (!c) return res.status(404).json({ error: 'Complaint not found' });
    const status = ['open', 'resolved', 'dismissed'].includes(req.body.status) ? req.body.status : c.status;
    db.prepare("UPDATE complaints SET status = ?, note = ?, resolved_at = CASE WHEN ? = 'open' THEN NULL ELSE datetime('now') END WHERE id = ?")
      .run(status, String(req.body.note ?? c.note).trim().slice(0, 500), status, c.id);
    res.json(db.prepare('SELECT * FROM complaints WHERE id = ?').get(c.id));
  });

  // ---- platform reporting
  app.get('/admin/reports', adminAuth, (req, res) => {
    const days = Math.min(365, Math.max(1, Math.floor(Number(req.query.days) || 30)));
    const since = `-${days} days`;
    const n = (sql, ...p) => db.prepare(sql).get(...p).c;
    const total = n("SELECT COUNT(*) c FROM orders WHERE created_at >= datetime('now', ?)", since);
    const by = (status) => n("SELECT COUNT(*) c FROM orders WHERE status = ? AND created_at >= datetime('now', ?)", status, since);
    // how fast shops answer: from sent to accepted/declined
    const rt = db.prepare(`SELECT (julianday(MIN(e.at)) - julianday(o.created_at)) * 1440 AS minutes
      FROM orders o JOIN order_events e ON e.order_id = o.id AND e.actor = 'shop' AND (e.event = 'status: Accepted' OR e.event = 'status: Declined')
      WHERE o.created_at >= datetime('now', ?) GROUP BY o.id`).all(since).map((r) => r.minutes).sort((a, b) => a - b);
    const median = rt.length ? Math.round(rt[Math.floor(rt.length / 2)] * 10) / 10 : null;
    const answered = by('Picked up') + by('Ready') + by('Preparing');
    const cancelledBy = (actor) => n("SELECT COUNT(DISTINCT e.order_id) c FROM order_events e JOIN orders o ON o.id = e.order_id WHERE e.event = 'status: Cancelled' AND e.actor = ? AND o.created_at >= datetime('now', ?)", actor, since);
    res.json({
      days, orders: total, completed: by('Picked up'), declined: by('Declined'), expired: by('Expired'), cancelled: by('Cancelled'),
      cancelled_by_customer: cancelledBy('customer'), cancelled_by_shop: cancelledBy('shop'),
      no_shows: n("SELECT COUNT(*) c FROM order_events WHERE event = 'status: Expired' AND detail LIKE 'no-show%' AND at >= datetime('now', ?)", since),
      completion_rate: total ? Math.round((by('Picked up') / total) * 100) : null,
      acceptance_rate: total ? Math.round(((total - by('Declined') - by('Expired')) / total) * 100) : null,
      median_response_minutes: median,
      active_shops: n("SELECT COUNT(DISTINCT shop_id) c FROM orders WHERE created_at >= datetime('now', ?)", since),
      open_shops: n("SELECT COUNT(*) c FROM shops WHERE approval = 'approved' AND accepting != 'closed'"),
      pending_shops: n("SELECT COUNT(*) c FROM shops WHERE approval = 'pending'"),
      open_complaints: n("SELECT COUNT(*) c FROM complaints WHERE status = 'open'"),
      avg_rating: db.prepare("SELECT ROUND(AVG(rating), 2) a FROM orders WHERE rating IS NOT NULL AND created_at >= datetime('now', ?)").get(since).a,
      repeat_customers: n("SELECT COUNT(*) c FROM (SELECT user_id FROM orders WHERE created_at >= datetime('now', ?) GROUP BY user_id HAVING COUNT(*) > 1)", since),
      in_progress: answered,
    });
  });

  // ---- shop categories: { name, active }
  const catRow = (c) => ({ ...c, shops: db.prepare('SELECT COUNT(*) c FROM shops WHERE category = ? COLLATE NOCASE').get(c.name).c });
  app.get('/admin/categories', adminAuth, (_, res) =>
    res.json(db.prepare('SELECT * FROM categories ORDER BY sort, name').all().map(catRow)));
  app.post('/admin/categories', adminAuth, (req, res) => {
    const name = String(req.body.name || '').trim().slice(0, 40);
    if (!name) return res.status(400).json({ error: 'Enter a category name' });
    if (db.prepare('SELECT 1 FROM categories WHERE name = ? COLLATE NOCASE').get(name)) return res.status(400).json({ error: 'This category already exists' });
    const sort = (db.prepare('SELECT COALESCE(MAX(sort), 0) m FROM categories').get().m || 0) + 1;
    const r = db.prepare('INSERT INTO categories (name, sort) VALUES (?, ?)').run(name, sort);
    res.json(catRow(db.prepare('SELECT * FROM categories WHERE id = ?').get(r.lastInsertRowid)));
  });
  app.put('/admin/categories/:id', adminAuth, (req, res) => {
    const c = db.prepare('SELECT * FROM categories WHERE id = ?').get(req.params.id);
    if (!c) return res.status(404).json({ error: 'Category not found' });
    const name = req.body.name === undefined ? c.name : String(req.body.name).trim().slice(0, 40);
    if (!name) return res.status(400).json({ error: 'Enter a category name' });
    const dup = db.prepare('SELECT id FROM categories WHERE name = ? COLLATE NOCASE AND id != ?').get(name, c.id);
    if (dup) return res.status(400).json({ error: 'This category already exists' });
    db.transaction(() => {
      db.prepare('UPDATE categories SET name = ?, active = ? WHERE id = ?').run(name, req.body.active === undefined ? c.active : (req.body.active ? 1 : 0), c.id);
      if (name !== c.name) db.prepare('UPDATE shops SET category = ? WHERE category = ? COLLATE NOCASE').run(name, c.name);
    })();
    res.json(catRow(db.prepare('SELECT * FROM categories WHERE id = ?').get(c.id)));
  });
  app.delete('/admin/categories/:id', adminAuth, (req, res) => {
    const c = db.prepare('SELECT * FROM categories WHERE id = ?').get(req.params.id);
    if (!c) return res.status(404).json({ error: 'Category not found' });
    if (catRow(c).shops > 0) return res.status(400).json({ error: 'Shops use this category. Switch it off instead of deleting it.' });
    db.prepare('DELETE FROM categories WHERE id = ?').run(c.id);
    res.json({ ok: true });
  });

  // ---- settings (also what the public download page shows)
  app.get('/admin/settings', adminAuth, (_, res) => res.json(settings()));
  app.put('/admin/settings', adminAuth, (req, res) => {
    const put = db.prepare('INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value');
    db.transaction(() => {
      for (const k of [...SETTING_KEYS, ...ADMIN_ONLY_KEYS]) if (req.body[k] !== undefined) put.run(k, String(req.body[k]).trim().slice(0, 500));
    })();
    res.json(settings());
  });
};
