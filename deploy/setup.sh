#!/usr/bin/env bash
# Sets up the DailyList API on a fresh Ubuntu server (run as the "ubuntu" user, with sudo).
#   curl -fsSL https://raw.githubusercontent.com/yashjadeja132/DailyList/main/deploy/setup.sh | bash
# (the repository must be public for that, otherwise copy this file to the server and run it)
set -euo pipefail

DOMAIN="dailylist-api.yashrajsinhjadeja.com"
APP="$HOME/DailyList"

sudo apt-get update
sudo apt-get install -y nginx redis-server git certbot python3-certbot-nginx curl

# Node 22
if ! command -v node >/dev/null || [ "$(node -v | cut -d. -f1 | tr -d v)" -lt 22 ]; then
  curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
  sudo apt-get install -y nodejs
fi

# the code
if [ -d "$APP/.git" ]; then git -C "$APP" pull; else git clone https://github.com/yashjadeja132/DailyList.git "$APP"; fi
(cd "$APP/server" && npm ci --omit=dev)
(cd "$APP/admin" && npm ci && npm run build)

# private files (not in the repository): fill these in before starting
mkdir -p "$APP/server/secrets"
if [ ! -f "$APP/server/.env" ]; then
  cp "$APP/server/.env.example" "$APP/server/.env"
  sed -i "s#^PUBLIC_URL=.*#PUBLIC_URL=https://$DOMAIN#" "$APP/server/.env"
  echo ">>> Edit $APP/server/.env: Cashfree keys, ADMIN_PASSWORD (change it!)"
fi
echo ">>> Copy the Firebase key to $APP/server/secrets/firebase-service-account.json"

# run the server all the time
sudo cp "$APP/deploy/dailylist-api.service" /etc/systemd/system/dailylist-api.service
sudo systemctl daemon-reload
sudo systemctl enable --now dailylist-api

# web server in front, then free HTTPS from Let's Encrypt
sudo cp "$APP/deploy/nginx-dailylist-api.conf" /etc/nginx/sites-available/dailylist-api
sudo ln -sf /etc/nginx/sites-available/dailylist-api /etc/nginx/sites-enabled/dailylist-api
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t && sudo systemctl reload nginx
sudo certbot --nginx -d "$DOMAIN" --non-interactive --agree-tos --register-unsafely-without-email --redirect

echo "Done. Check: https://$DOMAIN/health"
