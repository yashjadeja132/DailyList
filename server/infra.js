// Redis + BullMQ.
//
//  Redis   : stores OTP codes (with expiry) and rate-limit counters, so codes survive a server restart
//            and can be shared by several server copies.
//  BullMQ  : background jobs that run on Redis
//              sms          - sends SMS messages (OTP, plan reminders) with automatic retries
//              maintenance  - repeating jobs: mark ended plans as expired, remind owners before a plan ends
//
// If Redis is not reachable when the server starts, everything falls back to memory: codes are kept in
// the server's memory, SMS are sent straight away and the repeating jobs run on timers. Nothing breaks,
// but codes are lost on restart. Set REDIS_URL to point at your Redis (default redis://127.0.0.1:6379),
// or REDIS_URL=off to turn it off on purpose.

const IORedis = require('ioredis');
const { Queue, Worker } = require('bullmq');

const REDIS_URL = process.env.REDIS_URL === undefined ? 'redis://127.0.0.1:6379' : process.env.REDIS_URL;
const REDIS_OFF = !REDIS_URL || REDIS_URL.toLowerCase() === 'off';
// Lets two servers share one Redis without sharing queues or codes (used by the tests).
const PREFIX = process.env.QUEUE_PREFIX || 'dailylist';

// ---- sending SMS. Plug a real provider in here (MSG91, Twilio, ...).
const deliverSms = async (phone, text) => {
  console.log(`[SMS stub] to ${phone}: ${text}`);
};

// ---- repeating job: plans whose end date has passed are marked as expired
function expireSubscriptions(db) {
  return db.prepare(
    "UPDATE subscriptions SET status = 'expired' WHERE status = 'active' AND expires_at IS NOT NULL AND expires_at <= datetime('now')").run().changes;
}

// ---- repeating job: tell shop owners 3 days before their plan ends (once per plan)
async function sendPlanReminders(db, enqueueSms) {
  const due = db.prepare(`
    SELECT s.id, s.expires_at, p.name AS plan_name, sh.name AS shop_name, u.phone
    FROM subscriptions s
    JOIN plans p ON p.id = s.plan_id
    JOIN shops sh ON sh.id = s.shop_id
    JOIN shop_members m ON m.shop_id = sh.id AND m.is_primary = 1
    JOIN users u ON u.id = m.user_id
    WHERE s.shop_id IS NOT NULL AND s.status = 'active' AND s.reminded_at IS NULL
      AND s.expires_at IS NOT NULL AND s.expires_at > datetime('now') AND s.expires_at <= datetime('now', '+3 days')`).all();
  const mark = db.prepare("UPDATE subscriptions SET reminded_at = datetime('now') WHERE id = ?");
  for (const r of due) {
    const date = new Date(r.expires_at.replace(' ', 'T') + 'Z').toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
    await enqueueSms(r.phone, `DailyList: your ${r.plan_name} plan for ${r.shop_name} ends on ${date}. Open the app to renew.`);
    mark.run(r.id);
  }
  return due.length;
}

// ---- OTP + rate-limit storage
function memoryStores() {
  const codes = new Map();
  const counters = new Map();
  return {
    otp: {
      async put(phone, code, ttlMs) { codes.set(phone, { code, tries: 0, exp: Date.now() + ttlMs }); },
      async get(phone) {
        const r = codes.get(phone);
        if (!r || r.exp < Date.now()) { codes.delete(phone); return null; }
        return { code: r.code, tries: r.tries };
      },
      async fail(phone) { const r = codes.get(phone); if (!r) return 0; r.tries += 1; return r.tries; },
      async del(phone) { codes.delete(phone); },
    },
    async rate(key, limit, windowSec) {
      const now = Date.now();
      let c = counters.get(key);
      if (!c || c.exp < now) c = { n: 0, exp: now + windowSec * 1000 };
      c.n += 1;
      counters.set(key, c);
      return { ok: c.n <= limit, count: c.n };
    },
  };
}

function redisStores(redis) {
  const k = (phone) => `${PREFIX}:otp:${phone}`;
  return {
    otp: {
      async put(phone, code, ttlMs) {
        await redis.multi().hset(k(phone), { code, tries: 0 }).pexpire(k(phone), ttlMs).exec();
      },
      async get(phone) {
        const h = await redis.hgetall(k(phone));
        return h && h.code ? { code: h.code, tries: Number(h.tries || 0) } : null;
      },
      async fail(phone) { return redis.hincrby(k(phone), 'tries', 1); },
      async del(phone) { await redis.del(k(phone)); },
    },
    async rate(key, limit, windowSec) {
      const rk = `${PREFIX}:${key}`;
      const n = await redis.incr(rk);
      if (n === 1) await redis.expire(rk, windowSec);
      return { ok: n <= limit, count: n };
    },
  };
}

async function connectRedis() {
  if (REDIS_OFF) return null;
  const client = new IORedis(REDIS_URL, {
    lazyConnect: true,
    maxRetriesPerRequest: null, // required by BullMQ workers
    connectTimeout: 2500,
    retryStrategy: (n) => Math.min(n * 500, 5000),
  });
  client.on('error', () => {}); // connection problems are handled by retrying
  try {
    await Promise.race([
      client.connect().then(() => client.ping()),
      new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), 3500)),
    ]);
    return client;
  } catch (e) {
    client.disconnect();
    console.log(`[infra] Redis not reachable at ${REDIS_URL} (${e.message}). Using memory instead.`);
    return null;
  }
}

const infra = {
  mode: 'starting', // 'redis' | 'memory'
  redis: null,
  otp: null,
  rate: null,
  enqueueSms: async (phone, text) => deliverSms(phone, text),
  queues: {},
  workers: [],
  timers: [],
  jobs: { expireSubscriptions, sendPlanReminders },

  async init({ db, expireOrders = () => 0 }) {
    const redis = await connectRedis();
    const stores = redis ? redisStores(redis) : memoryStores();
    infra.redis = redis;
    infra.otp = stores.otp;
    infra.rate = stores.rate;
    infra.mode = redis ? 'redis' : 'memory';

    if (redis) {
      const connection = redis;
      infra.queues.sms = new Queue('sms', {
        connection, prefix: PREFIX,
        defaultJobOptions: {
          attempts: 5,
          backoff: { type: 'exponential', delay: 2000 },
          removeOnComplete: { age: 3600, count: 1000 },
          removeOnFail: { age: 7 * 24 * 3600 },
        },
      });
      infra.queues.maintenance = new Queue('maintenance', { connection, prefix: PREFIX });
      infra.enqueueSms = async (phone, text) => { await infra.queues.sms.add('send', { phone, text }); };

      const smsWorker = new Worker('sms', async (job) => deliverSms(job.data.phone, job.data.text),
        { connection, prefix: PREFIX, concurrency: 5 });
      const maintWorker = new Worker('maintenance', async (job) => {
        if (job.name === 'expire-subscriptions') return { expired: expireSubscriptions(db) };
        if (job.name === 'expire-orders') return { expired: expireOrders() };
        if (job.name === 'plan-reminders') return { reminded: await sendPlanReminders(db, infra.enqueueSms) };
        return null;
      }, { connection, prefix: PREFIX });
      for (const w of [smsWorker, maintWorker]) {
        w.on('failed', (job, err) => console.log(`[infra] ${w.name} job ${job?.id} failed: ${err.message}`));
        w.on('error', () => {});
      }
      infra.workers.push(smsWorker, maintWorker);

      // repeating jobs (safe to register on every start; BullMQ keeps one schedule per id)
      await infra.queues.maintenance.upsertJobScheduler('expire-subscriptions', { every: 60 * 60 * 1000 }, { name: 'expire-subscriptions' });
      await infra.queues.maintenance.upsertJobScheduler('expire-orders', { every: 60 * 1000 }, { name: 'expire-orders' });
      await infra.queues.maintenance.upsertJobScheduler('plan-reminders', { pattern: '0 9 * * *' }, { name: 'plan-reminders' });
      console.log(`[infra] Redis connected (${REDIS_URL}). Queues: sms, maintenance.`);
    } else {
      // no Redis: run the repeating jobs on timers inside this process
      const tick = () => {
        try { expireSubscriptions(db); sendPlanReminders(db, infra.enqueueSms).catch(() => {}); } catch (e) { /* retry next time */ }
      };
      infra.timers.push(setInterval(tick, 6 * 60 * 60 * 1000));
      infra.timers.push(setInterval(() => { try { expireOrders(); } catch (e) { /* retry */ } }, 60 * 1000));
      infra.timers.forEach((t) => t.unref?.());
      setTimeout(tick, 5000).unref?.();
    }
  },

  // numbers shown on the admin dashboard
  async status() {
    const out = { redis: infra.mode, url: infra.redis ? REDIS_URL : null, queues: {} };
    for (const [name, q] of Object.entries(infra.queues)) {
      out.queues[name] = await q.getJobCounts('waiting', 'active', 'delayed', 'completed', 'failed');
    }
    return out;
  },

  async close() {
    infra.timers.forEach(clearInterval);
    await Promise.all(infra.workers.map((w) => w.close().catch(() => {})));
    await Promise.all(Object.values(infra.queues).map((q) => q.close().catch(() => {})));
    if (infra.redis) await infra.redis.quit().catch(() => {});
  },
};

module.exports = infra;
