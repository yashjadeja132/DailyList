# Deploying the DailyList API

The website and the admin panel (dailylist.yashrajsinhjadeja.com and /panel) are published by GitHub Pages. Only the API and the
database run on your server: **dailylist-api.yashrajsinhjadeja.com** (DNS A record to the server's IP). The server needs no website build.

1. On the server (Ubuntu, ports 22, 80, 443 open) run `deploy/setup.sh`.
2. Fill in `~/DailyList/server/.env` (copy of `.env.example`): `PAYMENT_MODE`, Cashfree keys, a new `ADMIN_PASSWORD`.
   `PUBLIC_URL` is already `https://dailylist-api.yashrajsinhjadeja.com`.
3. Copy `firebase-service-account.json` to `~/DailyList/server/secrets/`, then `sudo systemctl restart dailylist-api`.
4. Open `https://dailylist-api.yashrajsinhjadeja.com/health`. It should answer `{"ok":true,...}`.
5. In the Cashfree dashboard set the webhook to `https://dailylist-api.yashrajsinhjadeja.com/webhooks/cashfree`.
6. Nothing else is needed on GitHub: the website and panel already use this API address (set a repository variable `API_URL` only if it ever moves).

To update later: `cd ~/DailyList && git pull && (cd server && npm ci --omit=dev) && sudo systemctl restart dailylist-api`.
The database file is `server/shop.db`. Back it up regularly.
