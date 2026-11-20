// Cashfree settings, all read from environment variables.
//   CASHFREE_APP_ID       your Cashfree App ID (client id)
//   CASHFREE_SECRET_KEY   your Cashfree Secret key (also signs webhooks)
//   CASHFREE_ENV          sandbox (default) or production
//   CASHFREE_API_VERSION  default 2023-08-01
//   CASHFREE_API_BASE     only for tests: replaces the Cashfree API address
//   PUBLIC_URL            the public https address of this server, used for the payment return page and webhook
const ENV = (process.env.CASHFREE_ENV || 'sandbox').toLowerCase() === 'production' ? 'production' : 'sandbox';

module.exports = {
  env: ENV,
  appId: process.env.CASHFREE_APP_ID || '',
  secretKey: process.env.CASHFREE_SECRET_KEY || '',
  apiVersion: process.env.CASHFREE_API_VERSION || '2023-08-01',
  apiBase: process.env.CASHFREE_API_BASE || (ENV === 'production' ? 'https://api.cashfree.com/pg' : 'https://sandbox.cashfree.com/pg'),
  publicUrl: (process.env.PUBLIC_URL || '').replace(/\/$/, ''),
  isConfigured: () => !!(process.env.CASHFREE_APP_ID && process.env.CASHFREE_SECRET_KEY),
};
