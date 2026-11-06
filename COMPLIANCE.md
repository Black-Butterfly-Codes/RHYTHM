# COMPLIANCE.md — Legal & Compliance Checklist (RHYTHM)

This is the working checklist for taking RHYTHM from a local prototype to a
public launch. It covers the seven review areas: age/children, privacy/data
protection, terms/policies, asset licensing, third-party code / DMCA /
moderation, accessibility/consumer law, and final output.

**Current stance (owner decisions):**

- **Age:** 13+ globally. Under-18 accounts require parent/guardian details and
  a declaration; paid auction features stay locked until an admin verifies
  consent.
- **Payments:** prototype only. Auctions and fees are simulated; no gateway,
  no charges, no card storage.
- **Markets:** India first, available globally. GDPR/UK GDPR and U.S. state
  privacy law coverage is included in the policy text.

Items marked **[PLACEHOLDER]** must be filled in by the owner before a
commercial/public launch. Nothing here is legal advice.

---

## 1. Age & children

- [x] 13+ minimum age enforced at signup (`MIN_AGE` in `logic.js`).
- [x] Age computed from date of birth, not a self-declared checkbox
      (`ageFromDob()`, tested).
- [x] Under-18 signup collects guardian name + email and a consent
      declaration.
- [x] Minor accounts are flagged (`u.minor`) and re-evaluated on every load so
      they are released automatically at 18.
- [x] Paid auction creation and bidding are blocked until
      `parentalConsent.status === "verified"` (admin action).
- [x] Admin dashboard lists minor accounts and lets an admin mark consent
      verified/revoked.
- [x] Privacy Policy and Terms explain the age rule and minor restrictions.
- [x] Child-safety report reason and urgent-report guidance in the report
      dialog and Copyright page.
- [ ] **Owner/lawyer:** decide whether to add a neutral age screen or
      email-verification step before enabling public signups.
- [ ] **Owner:** implement real guardian verification (email confirmation or
      signed form) in production; the prototype only records a declaration and
      an admin flag.

## 2. Privacy & data protection

- [x] Privacy Policy covers data categories, purposes, legal bases, sharing,
      retention, rights, security, international transfers, children, changes
      and contact.
- [x] Consent banner with **Accept analytics / Reject optional**; no pre-ticked
      boxes; choice stored in `rhythm_consent_v1`.
- [x] Analytics is off by default and never loads without both consent and a
      configured GA4 ID (`analytics.js`).
- [x] Cookie settings can be reopened from the footer and profile.
- [x] Data export: **Download my data** produces a JSON file.
- [x] Profile correction for name, city and bio; contact route for other
      corrections.
- [x] Account deletion erases local records (posts, votes, bids, listings,
      chats, projects, notifications, reports, transactions).
- [x] No card/bank/payment credential storage in the prototype.
- [x] Grievance officer and privacy contact fields wired into every policy.
- [ ] **Owner:** set `CONTACT_EMAIL`, `LEGAL_ENTITY`, `LEGAL_ADDRESS`,
      `LEGAL_EMAIL`, `GRIEVANCE_OFFICER` at the top of `app.js`; mirror them in
      the Markdown policy files.
- [ ] **Owner:** publish a production retention schedule and the list of
      processors.
- [ ] **Owner/lawyer:** confirm DPDP Act 2023 notice/consent wording, GDPR
      representative (if EU users are targeted), and U.S. state-law addenda.
- [ ] **Owner:** if GA4 is enabled, update `netlify.toml` CSP (`script-src`,
      `connect-src`), `analytics.js` ID, `SEO.md` and the Privacy Policy.

## 3. Terms & policies

- [x] In-app pages: **Terms**, **Privacy**, **Refunds**, **Disclaimer**,
      **Copyright/DMCA**, **Contact**.
- [x] Public routes: `?page=terms|privacy|refund|disclaimer|copyright|contact`
      and hash equivalents.
- [x] Markdown mirrors: `TERMS.md`, `PRIVACY.md`, `REFUNDS.md`,
      `DISCLAIMER.md`, `COPYRIGHT.md`.
- [x] Terms checkbox (not pre-ticked) at signup; version recorded on the user.
- [x] Auctions show fee/tax/prototype disclosure before bidding.
- [x] Refund page states clearly that no real payments are taken today.
- [x] Governing law is India; mandatory consumer rights preserved.
- [ ] **Owner/lawyer:** review the liability cap, indemnity, governing-law and
      dispute-resolution clauses for the actual entity and market.
- [ ] **Owner:** fill `[PLACEHOLDER: REFUND WINDOW]` and any production
      cancellation/fee details.
- [ ] **Owner:** add a formal grievance/appeal process and response SLA.

## 4. Asset licensing

- [x] Fonts are self-hosted Inter (OFL-1.1); no CDN requests.
- [x] OG image, touch icon and favicon are project-generated.
- [x] No stock images, icon fonts or recorded samples are bundled.
- [x] Audio previews are synthesised at runtime.
- [x] Licence inventory written in `LICENSES.md`.
- [x] Full OFL-1.1 text included at `assets/fonts/OFL.txt`.
- [ ] **Owner:** confirm the root `LICENSE` matches the intended project
      licence.
- [ ] **Owner:** log the source/licence of any new asset before merging.

## 5. Third-party code, DMCA & moderation

- [x] Zero runtime npm dependencies; no bundled third-party JS libraries.
- [x] Copyright/DMCA page with takedown, counter-notice, misrepresentation and
      repeat-infringer sections.
- [x] In-app report flow for **posts** and **users**, with reasons including
      copyright/plagiarism and child safety.
- [x] Admin moderation queue: dismiss, remove post, or suspend reported user.
- [x] Report abuse/de-duplication guard (one open report per reporter/target).
- [x] User suspension blocks posting, voting and bidding.
- [ ] **Owner:** designate a copyright agent and publish the address/email.
- [ ] **Owner:** keep a takedown/action log and a repeat-infringer policy in
      production.
- [ ] **Owner/lawyer:** confirm DMCA safe-harbour registration (U.S.) and the
      Indian intermediary due-diligence/grievance requirements.

## 6. Accessibility & consumer law

- [x] Skip-to-main link, landmarks (`<main>`), labelled controls, focus
      handling for modals, `aria-live` status/error regions.
- [x] Consent banner is a labelled region; buttons are real `<button>`s.
- [x] Print / save-PDF action on every policy page.
- [x] Plain-language prototype notices and placeholder warnings.
- [x] Price/fee disclosure before bidding; no dark patterns in consent.
- [x] Reduced-motion CSS and visible `:focus-visible` rings.
- [ ] **Owner:** run a final WCAG 2.2 AA audit (keyboard, screen reader,
      contrast, zoom/reflow) and Lighthouse on the deployed site.
- [ ] **Owner/lawyer:** confirm consumer-law disclosures for the production
      checkout (total price, taxes, cancellation, refunds, grievance route).
- [ ] **Owner:** ensure the consent banner does not cover or trap focus on
      small screens.

## 7. Final output

- [x] Every owner-specific value is marked `[PLACEHOLDER: …]` in the UI.
- [x] Legal pages render a prototype notice while placeholders remain.
- [x] Docs updated: `README.md`, `AUTH.md`, `SEO.md`, `CONTACT.md`,
      `DATA_SECURITY.md`, `LICENSES.md`, `COMPLIANCE.md`.
- [x] Site map and `index.html` noscript links cover all public pages.
- [x] `npm run ci` (static checks + unit tests) covers the new age helpers.
- [ ] **Owner:** fill all placeholders, then have a lawyer review.
- [ ] **Owner:** re-run `npm run ci`, smoke-test signup (adult + minor),
      consent accept/reject, every legal route, export, report/moderation and
      auctions.
- [ ] **Owner:** update `lastmod` in `sitemap.xml` and any deployment metadata.

---

## Placeholders to replace

| Constant in `app.js` | Meaning | Used in |
|---|---|---|
| `CONTACT_EMAIL` | public support inbox | contact form, policies |
| `LEGAL_EMAIL` | privacy/grievance inbox | fallback for support |
| `LEGAL_ENTITY` | registered business/owner name | all policies |
| `LEGAL_ADDRESS` | registered address | all policies |
| `GRIEVANCE_OFFICER` | name, designation, contact | all policies |
| `[PLACEHOLDER: REFUND WINDOW]` | production refund window | Refund policy |
| `GA4_ID` (in `analytics.js`) | optional GA4 measurement ID | analytics |

## Files to review before launch

- `app.js` — legal config, signup/minor flow, policies, consent, data rights,
  reports/moderation, auctions.
- `logic.js` — `MIN_AGE`, `MAJORITY_AGE`, `ageFromDob()`, `ageBand()`.
- `analytics.js` — consent gate and GA4 setup.
- `style.css` — consent banner, policy, minor notices, skip link, print.
- `index.html` — metadata, noscript legal links.
- `sitemap.xml`, `robots.txt`, `netlify.toml` — public routes, CSP, headers.
- `TERMS.md`, `PRIVACY.md`, `REFUNDS.md`, `DISCLAIMER.md`, `COPYRIGHT.md`,
  `LICENSES.md`.
