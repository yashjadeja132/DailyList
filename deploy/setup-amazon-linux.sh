#!/usr/bin/env bash
# Sets up the DailyList API on Amazon Linux 2023. Run from the repository folder, with sudo:
#   cd ~/DailyList && git pull && sudo bash deploy/setup-amazon-linux.sh
# Needs server/.env to exist already (copy of server/.env.example). The Firebase key is optional at this point.
set -euo pipefail

DOMAIN="dailylist-api.yashrajsinhjadeja.com"
APP_DIR="$(cd "$(dirname "$0")/.." && pwd)"
APP_USER="$(stat -c %U "$APP_DIR")"          # the account that owns the repository runs the server
[ "$APP_USER" = "root" ] && echo "Note: the repository belongs to root, so the server will run as root."

echo ">>> tools"
dnf install -y gcc-c++ make python3 git nginx

echo ">>> Node 22"
if ! command -v node >/dev/null || [ "$(node -v | cut -d. -f1 | tr -d v)" -lt 22 ]; then
  curl -fsSL https://rpm.nodesource.com/setup_22.x | bash -
  dnf install -y nodejs
fi
node -v

echo ">>> packages for the server"
sudo -u "$APP_USER" bash -c "cd '$APP_DIR/server' && rm -rf node_modules && npm ci --omit=dev"
mkdir -p "$APP_DIR/server/secrets"
chown "$APP_USER" "$APP_DIR/server/secrets"
[ -f "$APP_DIR/server/.env" ] || { echo "Create $APP_DIR/server/.env first (copy of .env.example) and run this again."; exit 1; }

echo ">>> Redis (optional, the server also works without it)"
(dnf install -y redis6 && systemctl enable --now redis6) || echo "Redis was not installed, continuing without it."

echo ">>> run the API all the time"
cat > /etc/systemd/system/dailylist-api.service <<UNIT
[Unit]
Description=DailyList API server
After=network.target

[Service]
Type=simple
User=$APP_USER
WorkingDirectory=$APP_DIR/server
ExecStart=$(command -v node) index.js
Restart=always
RestartSec=3
Environment=NODE_ENV=production

[Install]
WantedBy=multi-user.target
UNIT
systemctl daemon-reload
systemctl enable dailylist-api
systemctl restart dailylist-api
sleep 4
curl -fsS http://127.0.0.1:3000/health && echo " <- API is running"

echo ">>> nginx"
cp "$APP_DIR/deploy/nginx-dailylist-api.conf" /etc/nginx/conf.d/dailylist-api.conf
nginx -t
systemctl enable --now nginx
systemctl reload nginx

echo ">>> free HTTPS (Let's Encrypt)"
if ! command -v certbot >/dev/null; then
  python3 -m venv /opt/certbot
  /opt/certbot/bin/pip install -q certbot certbot-nginx
  ln -sf /opt/certbot/bin/certbot /usr/bin/certbot
fi
certbot --nginx -d "$DOMAIN" --non-interactive --agree-tos --register-unsafely-without-email --redirect

echo "Done. Open https://$DOMAIN/health"
