// Push notifications through Firebase Cloud Messaging.
// Needs the Firebase service account key. Default location: server/secrets/firebase-service-account.json
// (or set FIREBASE_SERVICE_ACCOUNT to another path). Without it, push is switched off and the app
// still shows notifications inside the app.
const fs = require('fs');
const path = require('path');

const KEY = process.env.FIREBASE_SERVICE_ACCOUNT || path.join(__dirname, 'secrets', 'firebase-service-account.json');
let messaging = null;
let state = 'off';

function init(db) {
  db.exec(`CREATE TABLE IF NOT EXISTS device_tokens (
    token TEXT PRIMARY KEY,
    user_id INTEGER NOT NULL,
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  )`);
  db.exec('CREATE INDEX IF NOT EXISTS idx_device_tokens_user ON device_tokens (user_id)');
  if (!fs.existsSync(KEY)) { console.log('[push] No Firebase key found, push notifications are off.'); return; }
  try {
    const { initializeApp, cert } = require('firebase-admin/app');
    const { getMessaging } = require('firebase-admin/messaging');
    initializeApp({ credential: cert(JSON.parse(fs.readFileSync(KEY, 'utf8'))) });
    messaging = getMessaging();
    state = 'on';
    console.log('[push] Firebase push notifications are on.');
  } catch (e) {
    state = 'error';
    console.log('[push] Could not start Firebase: ' + e.message);
  }
}

/** Sends a notification to every phone this user is logged in on. Never throws. */
async function send(db, userId, title, body, data = {}) {
  if (!messaging) return;
  const tokens = db.prepare('SELECT token FROM device_tokens WHERE user_id = ?').all(userId).map((r) => r.token);
  if (!tokens.length) return;
  try {
    const res = await messaging.sendEachForMulticast({
      tokens,
      notification: { title, body: body || '' },
      data: Object.fromEntries(Object.entries(data).map(([k, v]) => [k, String(v)])),
      android: { priority: 'high', notification: { channelId: 'orders', color: '#087E75' } },
    });
    // forget phones that uninstalled the app or whose token is no longer valid
    res.responses.forEach((r, i) => {
      const code = r.error && r.error.code;
      if (code === 'messaging/registration-token-not-registered' || code === 'messaging/invalid-registration-token')
        db.prepare('DELETE FROM device_tokens WHERE token = ?').run(tokens[i]);
    });
  } catch (e) { console.log('[push] send failed: ' + e.message); }
}

module.exports = { init, send, status: () => state };
