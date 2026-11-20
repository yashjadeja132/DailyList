# Deploying the DailyList API

The website (dailylist.yashrajsinhjadeja.com) is published by GitHub Pages. The API, the admin panel (`/panel`) and the
database run on one server: **dailylist-api.yashrajsinhjadeja.com** (DNS A record to the server's IP).

1. On the server (Ubuntu, ports 22, 80, 443 open) run `deploy/setup.sh`.
2. Fill in `~/DailyList/server/.env` (copy of `.env.example`): `PAYMENT_MODE`, Cashfree keys, a new `ADMIN_PASSWORD`.
   `PUBLIC_URL` is already `https://dailylist-api.yashrajsinhjadeja.com`.
3. Copy `firebase-service-account.json` to `~/DailyList/server/secrets/`, then `sudo systemctl restart dailylist-api`.
4. Open `https://dailylist-api.yashrajsinhjadeja.com/health`. It should answer `{"ok":true,...}`.
5. In the Cashfree dashboard set the webhook to `https://dailylist-api.yashrajsinhjadeja.com/webhooks/cashfree`.
6. In GitHub, repository **Settings, Secrets and variables, Actions, Variables**, add `API_URL` =
   `https://dailylist-api.yashrajsinhjadeja.com`, then re-run the "Deploy website" workflow. The website then shows live plans and download links.

To update later: `cd ~/DailyList && git pull && (cd admin && npm ci && npm run build) && sudo systemctl restart dailylist-api`.
The database file is `server/shop.db`. Back it up regularly.
