// Creates the test accounts for the Google Play reviewers (run once on the server, from the server folder):
//   node scripts/seed-review.js
// - Customer 9000000099 and shop owner 9000000098 (shop "Review Store", approved, with a plan).
// Their login code is REVIEW_OTP, set together with REVIEW_PHONES in server/.env.
require('../env');
const Database = require('better-sqlite3');
const db = new Database(process.env.DB_FILE || 'shop.db');
db.pragma('journal_mode = WAL');

const upsertUser = (phone, name, role) => {
  const u = db.prepare('SELECT * FROM users WHERE phone = ?').get(phone);
  if (u) return u.id;
  return db.prepare("INSERT INTO users (name, phone, role, terms_accepted_at) VALUES (?, ?, ?, datetime('now'))").run(name, phone, role).lastInsertRowid;
};

upsertUser('9000000099', 'Review Customer', 'customer');
const ownerId = upsertUser('9000000098', 'Review Owner', 'owner');
let shop = db.prepare('SELECT * FROM shops WHERE owner_id = ?').get(ownerId);
if (!shop) {
  const id = db.prepare("INSERT INTO shops (owner_id, name, address, lat, lng, approval, category, phone, open_time, close_time, pickup_info) VALUES (?, 'Review Store', 'Test street, test city', 23.0225, 72.5714, 'approved', 'Grocery', '9000000098', '00:00', '23:59', 'Collect at the counter')").run(ownerId).lastInsertRowid;
  db.prepare('INSERT INTO shop_members (shop_id, user_id, is_primary) VALUES (?, ?, 1)').run(id, ownerId);
  shop = db.prepare('SELECT * FROM shops WHERE id = ?').get(id);
}
const hasPlan = db.prepare("SELECT 1 FROM subscriptions WHERE shop_id = ? AND status = 'active'").get(shop.id);
if (!hasPlan) {
  const plan = db.prepare("SELECT * FROM plans WHERE audience = 'owner' AND active = 1 ORDER BY price LIMIT 1").get();
  db.prepare("INSERT INTO subscriptions (user_id, shop_id, plan_id, status, started_at, expires_at, source) VALUES (NULL, ?, ?, 'active', datetime('now'), datetime('now', '+3650 days'), 'admin')").run(shop.id, plan.id);
}
console.log('Review accounts are ready: customer 9000000099, shop owner 9000000098 (shop: Review Store).');
