// Checks that a webhook really comes from Cashfree and reads the event.
// Cashfree signs every webhook: base64( HMAC-SHA256( timestamp + rawBody, secretKey ) ).
const crypto = require('crypto');

function verifySignature(rawBody, signature, timestamp, secret = process.env.CASHFREE_SECRET_KEY) {
  if (!rawBody || !signature || !timestamp || !secret) return false;
  const expected = crypto.createHmac('sha256', secret).update(String(timestamp) + rawBody.toString('utf8')).digest('base64');
  const a = Buffer.from(expected), b = Buffer.from(String(signature));
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

/** Turns a webhook body into { type, orderId, paymentId, status } or null if it is not a payment event. */
function parseEvent(body) {
  const type = body && body.type;
  const data = (body && body.data) || {};
  if (!type || !data.order || !data.order.order_id) return null;
  const status = type === 'PAYMENT_SUCCESS_WEBHOOK' ? 'paid'
    : type === 'PAYMENT_FAILED_WEBHOOK' || type === 'PAYMENT_USER_DROPPED_WEBHOOK' ? 'failed' : null;
  if (!status) return null;
  return { type, status, orderId: data.order.order_id, paymentId: data.payment ? String(data.payment.cf_payment_id || '') : '' };
}

module.exports = { verifySignature, parseEvent };
