// Cashfree payments for DailyList plan purchases.
//   const cashfree = require('./services/cashfree');
//   cashfree.enabled()                  true when the keys are set
//   cashfree.createOrder({...})         start a payment
//   cashfree.getOrder(orderId)          check a payment
//   cashfree.verifyWebhook(raw, sig, t) check a webhook signature
//   cashfree.parseEvent(body)           read a webhook event
const config = require('./config');
const { CashfreeError } = require('./client');
const orders = require('./orders');
const webhook = require('./webhook');

module.exports = {
  enabled: config.isConfigured,
  environment: config.env,
  CashfreeError,
  createOrder: orders.createOrder,
  getOrder: orders.getOrder,
  getPayments: orders.getPayments,
  returnUrlFor: orders.returnUrlFor,
  notifyUrl: () => (config.publicUrl ? `${config.publicUrl}/webhooks/cashfree` : undefined),
  verifyWebhook: webhook.verifySignature,
  parseEvent: webhook.parseEvent,
};
