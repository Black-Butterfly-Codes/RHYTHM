# PRIVACY.md — RHYTHM Privacy Policy

*Last updated: 6 November 2026 · Policy version `2026-11-06`.*

This file mirrors the in-app **Privacy Policy** (`privacyView()` in `app.js`).
If either changes, update both together. Items in `[BRACKETS]` are owner
placeholders — see `COMPLIANCE.md`.

## 1. Who we are

RHYTHM is operated by **[PLACEHOLDER: LEGAL ENTITY / OWNER NAME]**,
**[PLACEHOLDER: REGISTERED ADDRESS]**. Privacy contact:
**[PLACEHOLDER: PRIVACY / GRIEVANCE EMAIL]**. Grievance officer:
**[PLACEHOLDER: GRIEVANCE OFFICER NAME & CONTACT]**.

## 2. What we collect

- **Account data:** name, username, email, password (stored only as a salted
  hash), date of birth, state/UT, city, bio, creative domains, and — for users
  under 18 — parent/guardian name, email and consent status.
- **Your content:** posts, lyrics, track metadata, comments, votes, follows,
  playlists, collaboration requests, workspace files/chat, direct messages,
  auction listings and bids.
- **Transactions (prototype):** simulated auction results, fees and amounts.
  No card, bank or payment credentials are collected or stored.
- **Local device data:** session id, login-attempt lockout, app database and
  consent choice in browser localStorage.
- **Support:** the name, email and message you send through the contact form
  or email.
- **Analytics (optional):** if you accept, Google Analytics 4 may receive
  screen-view events, page title/path and a coarsened/truncated IP address.
  It is off by default and never loads without your consent.

## 3. Why we use it and our legal bases

- **Provide the service** (account, feed, collaboration, marketplace):
  performance of a contract.
- **Keep the platform safe** (moderation, fraud/spam prevention, security):
  legitimate interests and legal obligations.
- **Optional analytics:** your consent, which you can withdraw at any time via
  “Cookie settings”.
- **Legal compliance** (tax, consumer, copyright, child-safety and lawful
  requests): legal obligation.

We do not sell personal data and do not use it for behavioural advertising.

## 4. Children and age

RHYTHM is for users aged **13 and over**. Users under **18** need a parent or
guardian's consent. In the prototype, a minor can create an account after
providing guardian details and a declaration; **paid auction features stay
locked until the guardian's consent is verified** by the operator. We do not
knowingly allow under-13s. If you believe a child under 13 has created an
account, contact us and we will delete it.

We do not show gambling, alcohol, tobacco, adult content or other
age-restricted material. If that changes, minors will not be shown it.

## 5. Cookies, local storage and consent

Essential storage is required to sign you in and save your work; it is not
optional. Optional analytics is controlled by the consent banner. Rejecting
optional analytics does not limit the app. You can reopen the choice with
“Cookie settings” in the footer or profile. No pre-ticked boxes are used. The
default build makes no third-party analytics request because no measurement ID
is configured.

Storage keys:

| Key | Purpose |
|---|---|
| `rhythm_db_v1` | app data (accounts, posts, auctions, reports, …) |
| `rhythm_session_v1` | signed-in session id |
| `rhythm_login_lock_v1` | failed-login rate limit |
| `rhythm_consent_v1` | your analytics consent choice and version |

## 6. Who we share with

Other users see the profile and content you choose to publish, and messages
you send to them. In the current prototype, data stays in your browser and is
not sent to RHYTHM or other users. In production, hosting, storage, email,
payment and analytics providers will process data under contracts; payments
will be handled by a certified gateway and RHYTHM will not store card details.
We may disclose data when required by law or to protect safety and rights.

## 7. Retention

**Prototype:** data stays in your browser until you delete your account, reset
demo data, or clear site storage.

**Production:** account and content data are kept while your account is active
and for a short period after deletion for backups, fraud prevention and legal
claims; payment/tax records are kept for the period required by law; analytics
retention follows the GA4 setting. We will publish a retention schedule before
launch.

## 8. Your rights

Subject to applicable law (including India's Digital Personal Data Protection
Act 2023, the GDPR/UK GDPR where it applies, and U.S. state privacy laws), you
may access, correct, download, delete, restrict or object to processing,
withdraw consent, and complain to a regulator.

In the app:

- **Download my data** (Profile → Privacy & data) exports your account and
  activity as JSON.
- **Delete my account** erases your local records.
- You can correct your **name, city and bio** in Profile → settings.
- For email, username, date of birth or other corrections, contact the privacy
  inbox.

We aim to respond within 30 days (or the shorter period required by law).

## 9. Security

Passwords are salted and hashed with **PBKDF2-SHA256** (210,000 iterations).
Production will use Argon2id server-side, HTTPS, HttpOnly sessions, access
controls and encrypted backups. Browser localStorage is **not encrypted** and
is readable by scripts on the same origin; do not store sensitive data in this
prototype. We never ask for card details in the app.

## 10. International transfers

The prototype runs in your browser. Production hosting and service providers
may process data outside your country; we will use appropriate safeguards and
publish the list of providers before launch.

## 11. Changes

We will update this page and the date above when the policy changes. Material
changes will be notified in the app or by email where required.

## 12. Contact & grievance

Privacy and grievance contact: **[PLACEHOLDER: PRIVACY / GRIEVANCE EMAIL]**.
Grievance officer: **[PLACEHOLDER: GRIEVANCE OFFICER NAME & CONTACT]**. You can
also use the in-app Contact page. If you are not satisfied, you may complain to
your local data-protection authority.
