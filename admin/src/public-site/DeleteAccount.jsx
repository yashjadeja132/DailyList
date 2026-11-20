import React, { useEffect } from 'react';
import { telHref } from './shared.jsx';

/** How to delete a DailyList account (also linked from the Google Play listing). */
export default function DeleteAccount({ info }) {
  useEffect(() => { document.title = 'Delete your account - DailyList'; }, []);
  const email = info && info.support_email;
  const phone = info && info.support_phone;
  return (
    <>
      <div className="banner">
        <div className="wrap">
          <h1>Delete your account</h1>
          <p>You can delete your account and personal data at any time.</p>
        </div>
      </div>

      <article className="legal">

        <h2>In the app (fastest)</h2>
        <ol>
          <li>Open DailyList and log in.</li>
          <li>Go to <b>Profile</b> (the person icon at the bottom).</li>
          <li>Tap <b>Delete my account</b> and confirm.</li>
        </ol>

        <h2>If you cannot use the app</h2>
        <p>
          Contact us from the phone number on your account and ask us to delete it
          {email ? <> at <a href={`mailto:${email}`}>{email}</a></> : null}
          {phone ? <> or on <a href={telHref(phone)}>{phone}</a></> : null}. We will confirm and delete it within 7 days.
        </p>

        <h2>What is deleted</h2>
        <ul>
          <li>Your name, phone number and login. The phone number is removed so it can be used for a new account.</li>
          <li>Your notifications and the push notification address of your phone.</li>
          <li>Orders you had open are cancelled. Past orders stay for the shop&apos;s records but show &ldquo;Deleted user&rdquo; and no phone number.</li>
          <li>If you are the main owner of a shop, the shop is closed and its open orders are cancelled.</li>
        </ul>

        <h2>What we may keep</h2>
        <p>Payment records for plans you bought (amount, date and plan) may be kept for accounting and tax rules. They are no longer linked to your name or phone number.</p>
      </article>
    </>
  );
}
