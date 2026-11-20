import React, { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { ContactDetails } from './shared.jsx';

const SECTIONS = [
  ['service', 'What DailyList is'],
  ['account', 'Your account'],
  ['customers', 'For customers'],
  ['owners', 'For shop owners'],
  ['plans', 'Plans and payments'],
  ['use', 'Using the app properly'],
  ['content', 'What you add to the app'],
  ['suspend', 'Suspending or closing accounts'],
  ['disclaimer', 'Our responsibility'],
  ['changes', 'Changes to these terms'],
  ['contact', 'Contact us'],
];

export default function Terms({ info }) {
  useEffect(() => { document.title = 'Terms & Conditions - DailyList'; }, []);

  return (
    <>
      <div className="banner">
        <div className="wrap">
          <h1>Terms &amp; Conditions</h1>
          <p>The rules for using DailyList, as a customer or as a shop owner.</p>
        </div>
      </div>

      <article className="legal">
        <p className="updated">Last updated: 12 November 2026</p>

        <p>These terms apply when you use the DailyList app and website. Please read them. By creating an account or using the app, you agree to them. If you do not agree, please do not use DailyList.</p>

        <div className="toc">
          <b>In these terms</b>
          <ol>{SECTIONS.map(([id, label]) => <li key={id}><a href={`#${id}`}>{label}</a></li>)}</ol>
        </div>

        <h2 id="service">1. What DailyList is</h2>
        <p>DailyList lets a customer send a list of items to a shop, and lets the shop check the list, mark what it does not have, and tell the customer when the order is ready. We provide the app. We are not the seller of any goods.</p>
        <ul>
          <li>An order in the app is a <b>request</b> to the shop. The shop decides what it has and what it can prepare.</li>
          <li>The sale is between the customer and the shop. Prices, goods and quality are the shop&rsquo;s responsibility.</li>
          <li>Orders are <b>paid at the shop</b> when the customer picks them up. The app does not take payment for orders.</li>
        </ul>

        <h2 id="account">2. Your account</h2>
        <ul>
          <li>You sign up and log in with your phone number and a one-time code. You must use a number that belongs to you.</li>
          <li>Give correct information and keep it up to date.</li>
          <li>Keep your phone secure. You are responsible for what happens on your account. Tell us quickly if you think someone else is using it.</li>
          <li>Each phone number can have one account. An account is either a customer account or a shop owner account.</li>
        </ul>

        <h2 id="customers">3. For customers</h2>
        <ul>
          <li>You start on a free plan. Your plan sets how many orders you can send to each shop and how many different shops you can order from in each billing period.</li>
          <li>Write your list clearly and give correct quantities. Add a note if the shop needs to know something.</li>
          <li>You can cancel an order until the shop has started on it.</li>
          <li>After the shop marks an order ready, please collect it in a reasonable time and pay the shop for what you take.</li>
          <li>Items the shop marks &ldquo;not available&rdquo; are not part of your order.</li>
        </ul>

        <h2 id="owners">4. For shop owners</h2>
        <ul>
          <li>You must have an active plan to receive orders. Without one, your shop is hidden from customers and you cannot open orders.</li>
          <li>You must have the right to run the shop you register, and the shop details and location must be correct.</li>
          <li>Check each order honestly. Mark items you do not have as &ldquo;not available&rdquo;, and mark the order ready only when it is ready.</li>
          <li>Your plan sets how many phone numbers can use your shop account. The main owner can add and remove team members within that limit and is responsible for what they do in the app.</li>
          <li>Charge customers fairly and follow the laws that apply to your business. Handle customers&rsquo; names and phone numbers only to serve their orders.</li>
        </ul>

        <h2 id="plans">5. Plans and payments</h2>
        <ul>
          <li>The current plans, prices and limits are shown on our <Link to="/pricing">Plans page</Link> and in the app. The price and what you get are shown before you choose a plan.</li>
          <li>A plan lasts for its stated period and then ends, unless you renew it. A plan with no end date stays until you change it.</li>
          <li>When a shop&rsquo;s plan ends, the shop stops receiving orders and is hidden from customers until it has an active plan again.</li>
          <li>When you move to a plan with fewer users, you must first remove the extra team members.</li>
          <li>We may change plans, limits and prices. Changes apply to purchases made after the change.</li>
          <li>If payment is by a payment provider, its own terms also apply. Fees you have paid are not refunded unless the law requires it or we tell you otherwise when you buy.</li>
        </ul>

        <h2 id="use">6. Using the app properly</h2>
        <p>Please do not:</p>
        <ul>
          <li>use the app for anything illegal, or to sell things you are not allowed to sell;</li>
          <li>send false, abusive or harmful content, or place orders you do not intend to collect;</li>
          <li>pretend to be someone else, or use another person&rsquo;s phone number;</li>
          <li>try to get into accounts, data or systems that are not yours, or disturb the service;</li>
          <li>copy or reuse the app or its data in ways we have not allowed.</li>
        </ul>

        <h2 id="content">7. What you add to the app</h2>
        <p>You are responsible for the lists, notes and shop details you add. You allow us to store them and show them to the people who need to see them to use the service, as described in our <Link to="/privacy">Privacy Policy</Link>.</p>

        <h2 id="suspend">8. Suspending or closing accounts</h2>
        <p>You can stop using DailyList at any time. We may limit, suspend or close an account if these terms are broken, if the account is used to harm others or the service, or if the law requires it. You can ask us to delete your account using the contact details below.</p>

        <h2 id="disclaimer">9. Our responsibility</h2>
        <ul>
          <li>We work to keep the app available and correct, but it is provided &ldquo;as is&rdquo;. We cannot promise it will always work without breaks or errors.</li>
          <li>We are not responsible for the goods, prices, availability, quality or pick-up arrangements between customers and shops, or for anything a shop or customer does.</li>
          <li>To the extent the law allows, we are not liable for indirect or lost-profit losses from using the app. Nothing in these terms limits any right you have by law that cannot be limited.</li>
        </ul>

        <h2 id="changes">10. Changes to these terms</h2>
        <p>We may update these terms from time to time. The date at the top shows the latest version. If you keep using the app after a change, you accept the new terms. We will tell you in the app about important changes.</p>

        <h2 id="contact">11. Contact us</h2>
        <p>For questions about these terms, contact us at <ContactDetails info={info} />.</p>
        <div className="note">Also see our <Link to="/privacy">Privacy Policy</Link> and our <Link to="/pricing">Plans</Link>.</div>
      </article>
    </>
  );
}
