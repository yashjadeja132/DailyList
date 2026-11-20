import React, { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { ContactDetails } from './shared.jsx';

const SECTIONS = [
  ['collect', 'Information we collect'],
  ['use', 'How we use it'],
  ['share', 'Who can see your information'],
  ['location', 'Your location'],
  ['payments', 'Plans and payments'],
  ['keep', 'How long we keep it'],
  ['security', 'Security'],
  ['choices', 'Your choices'],
  ['children', 'Children'],
  ['changes', 'Changes to this policy'],
  ['contact', 'Contact us'],
];

export default function Privacy({ info }) {
  useEffect(() => { document.title = 'Privacy Policy - DailyList'; }, []);

  return (
    <>
      <div className="banner">
        <div className="wrap">
          <h1>Privacy Policy</h1>
          <p>What we collect, why we collect it, and the choices you have.</p>
        </div>
      </div>

      <article className="legal">
        <p className="updated">Last updated: 12 November 2026</p>

        <p>DailyList (&ldquo;we&rdquo;, &ldquo;us&rdquo;) is an app that lets customers send a shopping list to a nearby shop, and lets shop owners check and prepare those orders. This policy explains how we handle your information when you use the DailyList app and this website. By using the app you agree to this policy.</p>

        <div className="toc">
          <b>In this policy</b>
          <ol>{SECTIONS.map(([id, label]) => <li key={id}><a href={`#${id}`}>{label}</a></li>)}</ol>
        </div>

        <h2 id="collect">1. Information we collect</h2>
        <p><b>Everyone</b></p>
        <ul>
          <li><b>Account details:</b> your name, your phone number, and whether you are a customer or a shop owner. We check your phone number with a one-time code sent by SMS. There is no password.</li>
          <li><b>Login session:</b> after you log in, a private sign-in token is stored on your phone so you stay logged in until you log out.</li>
        </ul>
        <p><b>Customers</b></p>
        <ul>
          <li><b>Orders:</b> the shop you chose, the items and quantities you typed, any note you added, the status of the order, and when it was sent.</li>
          <li><b>Plan usage:</b> your current plan and how many orders and shops you have used in the current period, so we can apply the plan limits.</li>
        </ul>
        <p><b>Shop owners</b></p>
        <ul>
          <li><b>Shop details:</b> the shop name, address, and the shop&rsquo;s location (taken from your phone&rsquo;s GPS, or matched with your shop on Google Maps).</li>
          <li><b>Team members:</b> the name and phone number of each person you add to your shop account.</li>
          <li><b>Orders you receive:</b> the orders sent to your shop and the availability you mark on each item.</li>
          <li><b>Plan and payment records:</b> the plan you chose, its start and end dates, and the amount and date of each purchase.</li>
        </ul>
        <p><b>Technical information:</b> our servers may keep basic technical logs that are needed to run and protect the service, such as errors and failed requests.</p>

        <h2 id="use">2. How we use it</h2>
        <ul>
          <li>to create your account, verify your phone number and keep you logged in;</li>
          <li>to deliver your orders to the shop you chose, and show you the result;</li>
          <li>to show nearby shops to customers, and to show shops to customers while their plan is active;</li>
          <li>to apply plan limits, manage plans and send reminders, such as a message before a shop&rsquo;s plan ends;</li>
          <li>to keep the service secure, prevent misuse and fix problems;</li>
          <li>to answer your questions and requests.</li>
        </ul>
        <p>We do not sell your personal information.</p>

        <h2 id="share">3. Who can see your information</h2>
        <ul>
          <li><b>The shop you order from</b> sees your name, your phone number and the list you sent, so they can prepare it and reach you. Everyone who uses that shop account (the owner and the team members) can see its orders.</li>
          <li><b>Customers</b> can see a shop&rsquo;s name, address and location. They do not see anything about other customers.</li>
          <li><b>Service providers</b> that help us run DailyList receive only what they need: an SMS service to deliver one-time codes and reminders (your phone number and the message), Google Maps to find a shop&rsquo;s place when an owner sets the shop location (the shop name and the owner&rsquo;s coordinates), and a payment service when online payment is switched on.</li>
          <li><b>Legal reasons:</b> we may share information if the law requires it, or to protect the rights and safety of our users and of DailyList.</li>
        </ul>

        <h2 id="location">4. Your location</h2>
        <p>The app asks for permission to use your phone&rsquo;s location.</p>
        <ul>
          <li><b>Customers:</b> your location is used to sort shops by distance. It is sent to our server to work out the distances. We do not save it.</li>
          <li><b>Shop owners:</b> when you tap the location button, your location is used to place your shop. The shop&rsquo;s location is saved and shown to customers, who see how far away the shop is.</li>
        </ul>
        <p>You can turn location permission off at any time in your phone&rsquo;s settings. The app still works, but nearby shops are not sorted by distance.</p>

        <h2 id="payments">5. Plans and payments</h2>
        <p>We keep a record of each plan purchase (plan, amount, date). We do not store card or bank details. When online payment is available, the payment is handled by a payment provider that has its own privacy policy. Orders themselves are not paid in the app: you pay the shop directly when you pick up.</p>

        <h2 id="keep">6. How long we keep it</h2>
        <p>We keep your account, orders and plan records while your account is active and as long as needed to run the service, resolve disputes and meet legal requirements. You stay logged in on a phone until you log out. If you ask us to delete your account, we delete or anonymise your personal information, except what we must keep by law.</p>

        <h2 id="security">7. Security</h2>
        <p>We use reasonable measures to protect your information, including phone verification with one-time codes that expire after a few minutes, limits on how often codes can be requested, and private sign-in tokens. No system is perfectly secure, so we cannot guarantee absolute security. Please keep your phone protected and log out on shared devices.</p>

        <h2 id="choices">8. Your choices</h2>
        <ul>
          <li><b>See and correct:</b> you can change your name, and shop owners can change the shop name, address and location, in the app under Profile.</li>
          <li><b>Team members:</b> the main shop owner can remove a team member at any time, which logs that person out.</li>
          <li><b>Cancel an order:</b> customers can cancel an order until the shop starts on it.</li>
          <li><b>Delete your data:</b> contact us (see below) and we will delete your account and personal information, except what we must keep by law.</li>
          <li><b>Location:</b> turn it off in your phone&rsquo;s settings.</li>
        </ul>

        <h2 id="children">9. Children</h2>
        <p>DailyList is not meant for children. If you think a child has given us personal information, contact us and we will remove it.</p>

        <h2 id="changes">10. Changes to this policy</h2>
        <p>We may update this policy from time to time. The date at the top shows when it was last changed. If we make an important change, we will tell you in the app.</p>

        <h2 id="contact">11. Contact us</h2>
        <p>For questions about this policy or to ask for your data to be deleted, contact us at <ContactDetails info={info} />.</p>
        <div className="note">Also see our <Link to="/terms">Terms &amp; Conditions</Link> and our <Link to="/pricing">Plans</Link>.</div>
      </article>
    </>
  );
}
