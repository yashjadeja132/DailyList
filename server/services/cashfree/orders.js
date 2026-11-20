// Cashfree orders: create one for a plan purchase, check its state afterwards.
const { request } = require('./client');
const config = require('./config');

/**
 * Creates a payment order. Returns Cashfree's order, including `payment_session_id`
 * which the app uses to open the checkout.
 *   orderId   our unique id (letters, numbers, _ and -, up to 50)
 *   amount    in rupees
 *   customer  { id, phone, name, email? }
 *   returnUrl where the checkout sends the customer afterwards (use {order_id} as a placeholder)
 *   notifyUrl https address Cashfree calls when the payment finishes (webhook), optional
 */
async function createOrder({ orderId, amount, customer, returnUrl, notifyUrl, note }) {
  return request('POST', '/orders', {
    order_id: orderId,
    order_amount: Number(amount),
    order_currency: 'INR',
    order_note: note ? String(note).slice(0, 200) : undefined,
    customer_details: {
      customer_id: String(customer.id),
      customer_phone: String(customer.phone),
      customer_name: customer.name || undefined,
      customer_email: customer.email || undefined,
    },
    order_meta: {
      return_url: returnUrl || undefined,
      notify_url: notifyUrl && notifyUrl.startsWith('https://') ? notifyUrl : undefined,
    },
  });
}

/** Current state of an order: order_status is ACTIVE | PAID | EXPIRED | TERMINATED ... */
const getOrder = (orderId) => request('GET', `/orders/${encodeURIComponent(orderId)}`);

/** The payment attempts of an order. */
const getPayments = (orderId) => request('GET', `/orders/${encodeURIComponent(orderId)}/payments`);

/** Our own return page, shown when the checkout finishes. */
const returnUrlFor = () => (config.publicUrl ? `${config.publicUrl}/pay/return?order_id={order_id}` : undefined);

module.exports = { createOrder, getOrder, getPayments, returnUrlFor };
