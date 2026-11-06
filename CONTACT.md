# CONTACT.md — Contact form configuration (RHYTHM)

## 1. How it works today (static prototype)

The in-app Contact view (`contactView()` in `app.js`) is fully validated:

- Required Name / Email / Subject / Message (email regex, min lengths).
- Accessible errors (`role="alert"`, `aria-live` region).
- Spam defenses: honeypot field + 2-second minimum fill-time trap.
- Submit behaviour is honest about the environment:
  - If `CONTACT_EMAIL` (or the fallback `LEGAL_EMAIL`) at the top of `app.js`
    is set to a real inbox, the form composes a `mailto:` message — the user's
    own email app sends it. No fake “we received it” claims: the confirmation
    says the email app is opening.
  - If unset, the form says so plainly and offers **copy to clipboard**.
- No API keys, no secrets, no backend calls.

The Contact page also points to the privacy/grievance inbox, the grievance
officer, and the Copyright & DMCA page. The copyright page covers takedowns,
counter-notices and urgent child-safety reports.

**Owner action:** set `CONTACT_EMAIL`, `LEGAL_EMAIL`, `LEGAL_ENTITY`,
`LEGAL_ADDRESS` and `GRIEVANCE_OFFICER` in `app.js`, then mirror them in the
Markdown policy files. (Don't invent them — the placeholders are intentionally
empty.)

The page is reachable directly at `/?page=contact` and is indexable; the
`?page=` routes exist so crawlers get stable URLs without fragments.

## 2. Netlify Forms version (for rhythm-music-platform.netlify.app)

Netlify detects a plain HTML form with `data-netlify="true"` at deploy time
and handles submissions, spam filtering and notifications — no backend code.
To upgrade the repo copy:

1. In the repo's Contact view markup, render a real `<form>` (JS validation
   stays as the first line of defence):
```html
<form name="rhythm-contact" method="POST" data-netlify="true" netlify-honeypot="bot-field" action="/contact-success">
  <input type="hidden" name="form-name" value="rhythm-contact">
  <p hidden><label>Don't fill this out: <input name="bot-field"></label></p>
  <label>Name <input type="text" name="name" required></label>
  <label>Email <input type="email" name="email" required></label>
  <label>Subject <input type="text" name="subject" required></label>
  <label>Message <textarea name="message" required minlength="10"></textarea></label>
  <button type="submit">Send message</button>
</form>
```
2. Add a static `contact-success` confirmation page/route and register it in
   `netlify.toml` if custom routing is used.
3. Netlify Dashboard → Forms → enable notifications (email/Slack) and
   reCAPTCHA/Akismet spam filtering as desired.
4. Keep the JS validation + honeypot: Netlify is the second layer, not a
   replacement for client checks.

## 3. Spam & privacy notes

- Never log message bodies to analytics. Analytics is disabled by default and,
  even when enabled, `analytics.js` tracks screen-views only and requires
  consent.
- The mailto path exposes the sender's email address to the inbox owner —
  that is the point of a contact form; say so on the page (already stated:
  “don't include passwords or card details”).
- Rate-limit public deployments at the edge if abuse appears (Netlify Edge /
  form settings), rather than weakening validation.

## 4. Grievance, privacy and copyright routes

| Request | Where to send it |
|---|---|
| Privacy / data rights | `LEGAL_EMAIL` (fallback `CONTACT_EMAIL`) |
| Grievance / appeal | `GRIEVANCE_OFFICER` + `LEGAL_EMAIL` |
| Copyright takedown / counter-notice | `LEGAL_EMAIL`, subject “Copyright takedown” / “Copyright counter-notice” |
| Urgent child safety | emergency services first, then `LEGAL_EMAIL`, subject “URGENT child safety” |

All of these are `[PLACEHOLDER]` values until the owner fills them in.
In production, publish response targets and keep a log of complaints and
actions.
