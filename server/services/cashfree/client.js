// The only place that talks to the Cashfree HTTP API.
const config = require('./config');

class CashfreeError extends Error {
  constructor(message, status, code) { super(message); this.status = status; this.code = code; }
}

async function request(method, path, body) {
  if (!config.isConfigured()) throw new CashfreeError('Cashfree is not set up on the server', 500, 'not_configured');
  let res;
  try {
    res = await fetch(config.apiBase + path, {
      method,
      headers: {
        'Content-Type': 'application/json',
        'x-client-id': process.env.CASHFREE_APP_ID,
        'x-client-secret': process.env.CASHFREE_SECRET_KEY,
        'x-api-version': config.apiVersion,
      },
      body: body ? JSON.stringify(body) : undefined,
      signal: AbortSignal.timeout(15000),
    });
  } catch (e) {
    throw new CashfreeError('Could not reach Cashfree. Please try again.', 502, 'unreachable');
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new CashfreeError(data.message || 'Cashfree rejected the request', res.status, data.code || 'cashfree_error');
  return data;
}

module.exports = { request, CashfreeError };
