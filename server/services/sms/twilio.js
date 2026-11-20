// Sends SMS through Twilio's REST API (no extra package needed). Settings, all in server/.env:
//   TWILIO_ACCOUNT_SID           starts with AC...
//   TWILIO_AUTH_TOKEN
//   TWILIO_FROM                  the Twilio phone number to send from, like +15005550006 ...
//   TWILIO_MESSAGING_SERVICE_SID optional, starts with MG...; used instead of TWILIO_FROM when set
//   SMS_COUNTRY_CODE             added to phone numbers saved without one, default +91
//   TWILIO_API_BASE              only for tests
const env = (k) => (process.env[k] || '').trim();

const isConfigured = () => !!(env('TWILIO_ACCOUNT_SID') && env('TWILIO_AUTH_TOKEN') && (env('TWILIO_FROM') || env('TWILIO_MESSAGING_SERVICE_SID')));

/** 9725525757 -> +919725525757. Numbers that already start with + are kept. */
function toE164(phone) {
  const raw = String(phone).trim();
  if (raw.startsWith('+')) return '+' + raw.replace(/\D/g, '');
  const digits = raw.replace(/\D/g, '').replace(/^0+/, '');
  return (env('SMS_COUNTRY_CODE') || '+91') + digits;
}

async function send(phone, text) {
  if (!isConfigured()) throw new Error('Twilio is not set up on the server');
  const sid = env('TWILIO_ACCOUNT_SID');
  const body = new URLSearchParams({ To: toE164(phone), Body: String(text).slice(0, 600) });
  if (env('TWILIO_MESSAGING_SERVICE_SID')) body.set('MessagingServiceSid', env('TWILIO_MESSAGING_SERVICE_SID'));
  else body.set('From', env('TWILIO_FROM'));

  let res;
  try {
    res = await fetch(`${env('TWILIO_API_BASE') || 'https://api.twilio.com'}/2010-04-01/Accounts/${sid}/Messages.json`, {
      method: 'POST',
      headers: {
        Authorization: 'Basic ' + Buffer.from(`${sid}:${env('TWILIO_AUTH_TOKEN')}`).toString('base64'),
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body,
      signal: AbortSignal.timeout(15000),
    });
  } catch (e) {
    throw new Error('Could not reach Twilio: ' + e.message);
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`Twilio refused the SMS (${data.code || res.status}): ${data.message || 'unknown error'}`);
  return { sid: data.sid, status: data.status };
}

module.exports = { send, isConfigured, toE164 };
