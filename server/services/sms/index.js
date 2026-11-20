// SMS sending for the whole server: login codes and order messages.
//   SMS_PROVIDER=twilio   send real SMS (needs the TWILIO_* settings)
//   SMS_PROVIDER=stub     only write the message to the log (default when Twilio is not set up)
const twilio = require('./twilio');

const provider = () => (process.env.SMS_PROVIDER || (twilio.isConfigured() ? 'twilio' : 'stub')).toLowerCase();

async function send(phone, text) {
  if (provider() === 'twilio') {
    const r = await twilio.send(phone, text);
    console.log(`[SMS] sent to ${String(phone).slice(0, 2)}******${String(phone).slice(-2)} (${r.status})`);
    return r;
  }
  console.log(`[SMS stub] to ${phone}: ${text}`);
  return { status: 'logged' };
}

module.exports = { send, provider };
