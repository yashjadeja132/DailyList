# DailyList Orders

Customers send a shopping list to a nearby shop before they go. The shop owner checks it, marks anything
missing as "not available", and tells the customer when it is ready. Payment is at the shop.

| Folder   | What it is |
|----------|------------|
| `server/` | Node.js + SQLite API, with Redis + BullMQ for one-time codes and background jobs. Also serves the React app in `admin/`. |
| `app/`    | React Native mobile app (Metro, no Expo). |
| `admin/`  | One React app (plain JavaScript, Vite) with two parts: the **public website** (`/` home and download, `/pricing` plans, `/privacy`, `/terms`) and the **admin panel** (`/panel`). |

## Run

1. Server
   ```
   cd server
   node index.js
   ```
2. Website and admin panel (one React app; build it after changing it, the server hosts the build)
   ```
   cd admin
   npm install
   npm run build
   ```
   - Public website: `http://127.0.0.1:3000/`, plans at `/pricing`, privacy at `/privacy`, terms at `/terms`.
     The plans shown there are the live plans from the admin panel. Set the APK / Google Play link, version and
     the contact email and phone in the panel under **App & download page**. The contact details appear in the
     website footer, in a Contact us section on the home page, and in the Privacy Policy and Terms.
   - Admin panel: `http://127.0.0.1:3000/panel`. Default dev login: `admin` / `admin123`.
     Set `ADMIN_USER` and `ADMIN_PASSWORD` before going live.
   - For live editing use `npm run dev` (port 5173, talks to the server on port 3000).
   - The website and the panel are loaded separately, so their styles never mix. The privacy policy and terms
     text is in `admin/src/public-site/Privacy.jsx` and `Terms.jsx`.
4. Mobile app (Android phone over USB)
   ```
   adb reverse tcp:3000 tcp:3000
   adb reverse tcp:8081 tcp:8081
   cd app
   npx react-native start
   ```
   Build once with `cd app/android && gradlew.bat app:installDebug`.

## Plans

Managed in the admin panel under **Billing plans**.

- **Shop owner plans** - a shop owner must buy a plan after sign-up. A plan sets *users per shop account*
  (how many phone numbers can share the same shop account).
- **Customer plans** - everyone starts on the free **default** plan. A plan sets *orders per shop* and
  *shops they can order from* per billing cycle (0 = unlimited). Paid plans cycle over their whole duration;
  a plan with no expiry (the free plan) uses rolling 30-day cycles.
- Shops without an active plan are hidden from customers and cannot receive orders.
- **Payments are a test mode** (`PAYMENT_MODE=mock`, the default): buying a plan records a test payment and
  charges nothing. Connect a real payment gateway in `server/billing.js` before charging real money.

## Redis and BullMQ

- **Redis** keeps the one-time (OTP) codes with a 5 minute expiry and the rate-limit counters, so a code still
  works after a server restart. A phone number can ask for 5 codes per 15 minutes (50 in development).
- **BullMQ** (runs on Redis) has two queues:
  - `sms` - sends the SMS messages with up to 5 automatic retries. Put your SMS provider in `deliverSms` in
    `server/infra.js` (it only prints the message for now).
  - `maintenance` - repeating jobs: every hour it marks ended plans as expired, and every day at 9:00 it sends
    shop owners a reminder 3 days before their plan ends (once per plan).
- The server connects to `redis://127.0.0.1:6379` (on this PC the Memurai service). If Redis cannot be reached at
  start-up it keeps working from memory (codes are lost on restart, SMS are sent straight away, the jobs run on
  timers) and logs a message. `GET /health` and the admin dashboard show which mode is active.
- Install Redis on Windows with Memurai (https://www.memurai.com), or use Docker / WSL. In production use a hosted Redis.

## Settings (environment variables)

| Variable | Default | Purpose |
|----------|---------|---------|
| `PORT` | 3000 | Server port |
| `NODE_ENV` | (dev) | In dev the OTP is always `DEV_OTP`; set `production` for random codes (plug an SMS service into `deliverSms` in `server/infra.js`) |
| `DEV_OTP` | 132020 | Fixed OTP for development |
| `ADMIN_USER` / `ADMIN_PASSWORD` | admin / admin123 | Admin panel login |
| `GOOGLE_MAPS_API_KEY` | (none) | Finds the shop on Google Maps when the owner sets the location (Places API (New)) |
| `PAYMENT_MODE` | mock | `mock` = test payments |
| `REDIS_URL` | redis://127.0.0.1:6379 | Redis address. `off` turns Redis off on purpose |
| `QUEUE_PREFIX` | shop | Name prefix for Redis keys and queues (lets two servers share one Redis) |
| `OTP_SEND_LIMIT` | 5 (50 in dev) | Codes one phone may request per 15 minutes |

## DailyList: order life cycle and rules

Package name: `com.dailylist`. Tagline: *Your everyday shopping, simplified.*

Order statuses: New (sent) → Accepted (shop is checking) → Awaiting you (customer must accept a smaller quantity) →
Preparing → Ready → Picked up. An order can also end as Declined (shop), Cancelled, or Expired (nobody answered in time).

- **Items** are marked Available, Partly (with the quantity the shop can give) or Not available. The shop can add an
  optional "ready in about N minutes".
- **Customer** can change the list before the shop finishes checking, cancel until preparing starts, ask the shop to cancel
  after that (the shop agrees or keeps the order), rate a collected order and report a problem.
- **Shop** can be Accepting / Busy / Paused, has opening hours, phone, category, pickup note and area/pincode. New shops are
  **pending** until the admin approves them (Shop owners page). A shop outside its opening hours counts as closed.
- **Pickup code**: every order has a 4-character code to read out at the counter.
- **Notifications**: in-app list with a bell on Home. Critical events (ready, needs your answer, declined, shop did not
  reply, pickup reminder) are also queued as SMS (the SMS provider is a stub in `server/infra.js`; there is no push
  provider yet).
- **Expiry and reminders** run every minute: shop response time, customer response time, pickup window and pickup reminder
  are set in the admin panel (App & download page → settings).
- **Abuse controls**: order limit per customer per hour (`ORDERS_PER_HOUR`, default 15), block users, no-show counter,
  complaints, shop suspension.
- **Admin panel** (`/panel`): dashboard, plans, shop owners (approve / suspend / block), customers (block, no-shows),
  orders (search by number, code, phone; full history), complaints, reports, payments, settings and shop categories.
- **Find shops without GPS**: search by area or pincode (OpenStreetMap search through `/geocode`).
- The audit trail of every order is in `order_events` (`GET /orders/:id/events`).

## Plan payments with Cashfree (in the app only)

Plans are bought inside the mobile app. The website only describes plans, it never sells them.

Code: `server/services/cashfree/` (`config.js` settings, `client.js` API calls, `orders.js` create and check orders,
`webhook.js` signature check, `index.js` what the rest of the server uses). The routes are in `server/billing.js`.

Start the server with:

```
PAYMENT_MODE=cashfree
CASHFREE_APP_ID=...            # from the Cashfree dashboard
CASHFREE_SECRET_KEY=...        # also used to check webhook signatures
CASHFREE_ENV=sandbox           # or production
PUBLIC_URL=https://your-domain # public https address of this server
```

In the Cashfree dashboard, set the webhook URL to `PUBLIC_URL/webhooks/cashfree` and switch on the payment success and failed events.

How a payment goes: the app asks `POST /subscription/purchase` → the server creates a Cashfree order and a `pending` payment →
the app opens the Cashfree checkout (`PaymentScreen`) → afterwards the app calls `POST /subscription/confirm` and the server asks
Cashfree what happened → only a `PAID` order switches the plan on. The webhook does the same, so the plan also starts if the app was
closed. Doing it twice is safe. Without `PAYMENT_MODE=cashfree` the old test mode is used and nobody is charged.

## Setting up from a fresh copy

These private files are not in the repository. Add them yourself:

- `server/.env`, copy `server/.env.example` and fill in the Cashfree keys and admin password.
- `server/secrets/firebase-service-account.json`, the Firebase service account key (push notifications).
- `app/android/app/google-services.json`, the Firebase app config from the Firebase console (package `com.dailylist`).

Then: `cd server && npm install && node index.js`, `cd admin && npm install && npm run build`, `cd app && npm install`, and
`npx react-native start` with `cd android && ./gradlew installDebug` for the phone app.

## SMS (login codes) with Twilio

Code: `server/services/sms/` (`twilio.js` talks to Twilio, `index.js` chooses Twilio or only a log line). Set these in `server/.env`:
`TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, and `TWILIO_FROM` (your Twilio number) or `TWILIO_MESSAGING_SERVICE_SID`.
Numbers saved without a country code get `SMS_COUNTRY_CODE` (default +91). A Twilio trial account can only send to numbers
you have verified in the Twilio console, and sending to India needs the sender and message registered (DLT).
