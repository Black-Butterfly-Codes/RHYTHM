# DATA_SECURITY.md — Data Protection (RHYTHM)

## 1. Purpose

How RHYTHM protects personal data, credentials, creative work and commercial
records — in storage, in transit, and in backups.

## 2. What data we hold (and why)

| Category | Examples | Sensitivity |
|---|---|---|
| Identity | name, email, DOB, state/city, bio | High — PII |
| Credentials | password hashes, sessions | Critical |
| Minor records | guardian name/email, consent status, verification flag | High — child data |
| Creative work | lyrics, audio, scores, drafts | High — user's IP |
| Private collaboration | workspace chats, unreleased files | High — confidential by default |
| Commercial | bids, transactions, licenses, fees (simulated) | High — money + legal proof |
| Safety | reports, suspensions, moderation actions, audit events | Medium — needed for disputes |
| Consent | analytics choice + version in `rhythm_consent_v1` | Medium — proof of consent |

Principle: collect the minimum needed (see signup fields in `AUTH.md`), keep
unfinished collaboration content private to members, and never publish
anything without an explicit user action.

## 3. Protection in this demo

- Passwords: **PBKDF2-SHA256** digests (210,000 iterations, random per-user
  salt, constant-time comparison). Legacy fixed-salt SHA-256 digests are
  accepted once and upgraded on login — see `AUTH.md`.
- All rendering passes through `esc()` (`app.js`) → stored text (lyrics,
  comments, bios) cannot execute as HTML/JS (XSS defense).
- Data lives in the user's own browser localStorage (`DB_KEY`,
  `SESSION_KEY` in `store.js`); `wipeDB()` + `resetDemo()` give full
  local deletion. There is no network copy, so no transit exposure — but also
  no server backup: clearing browser data loses the demo DB by design.
- **No payment credentials** are collected, transmitted or stored. Auctions,
  fees and settlements are simulated demo data.
- The web font is self-hosted (`assets/fonts/`), so a default build makes no
  third-party requests. `analytics.js` is a no-op until an owner-configured
  GA4 measurement ID is set **and** the user accepts optional analytics.
- Public pages (`/?page=privacy|terms|refund|disclaimer|copyright|contact`)
  are crawlable; signed-in app screens send `noindex, nofollow`.

## 3a. Consent, export and minor data

- The consent banner offers **Accept analytics** and **Reject optional** with
  no pre-ticked box. The choice and its version are stored in
  `rhythm_consent_v1`; "Cookie settings" reopens it.
- `downloadMyData()` exports the user's account and activity as JSON,
  including the consent record and the minor/guardian fields where they apply.
- Minor accounts store guardian name, guardian email, a declaration timestamp
  and consent status. Admin verification is recorded in the same record.
- `deleteAccount()` removes the user's local records, including reports filed
  and reports targeting them, and their transactions.

## 4. Production storage & encryption

- **Database (PostgreSQL):** credentials in a vault/env, least-privilege DB
  roles (app role cannot `DROP`/alter schema), parameterized queries only
  (no string-built SQL), encryption at rest (managed disk encryption),
  PII columns encrypted at application layer where feasible.
- **Media (object storage, e.g. S3/Cloudinary):** never store audio blobs in
  DB rows — store object references + metadata + ownership, exactly as the
  plan's schema does (`posts`/`post_files`). Private collaboration files in
  non-public buckets, served via short-lived signed URLs checked against
  project membership on every request.
- **In transit:** TLS everywhere (HSTS), Secure/HttpOnly/SameSite cookies,
  WebSocket (`Socket.IO`) connections authenticated the same as HTTP.
- **Upload pipeline:** extension + MIME sniffing (not extension alone), size
  caps per domain, audio re-encode via FFmpeg (strips embedded payloads),
  async malware scan for attachments, quarantine-before-serve for
  quarantined types.

## 5. Backups & recovery

- Production: automated daily DB snapshots (30-day retention) + weekly full
  + off-site copy; quarterly restore drill (a backup never tested is not a
  backup); media versioned in object storage.
- Recovery targets to declare at launch: RPO ≤ 24 h, RTO ≤ 4 h.
- Demo: no backups (local-only by design); users export anything that
  matters before `↺ Reset demo`.

## 6. Privacy & access restrictions

- Profiles show only what the user published; DMs and workspaces are
  members-only (see matrix in `AUTH.md`); admins see report metadata, not
  private content, unless a dispute requires it (logged access).
- Blocking/reporting (`sendReport`, `sendUserReport`, `contactUser` controls)
  is available to every signed-in user; reports queue in the admin dashboard
  with dismiss/act/suspend dispositions (`resolveReport`).
- Minors: paid-auction creation and bidding are blocked until an admin
  verifies guardian consent (`verifyParentalConsent`).
- Account deletion (production requirement): erases PII and private content,
  retains only anonymized records the law requires (transactions, audit log)
  with documented retention periods, in line with India's DPDP Act.
- Production must also log admin access to moderation data and publish a
  retention schedule, processor list and breach-notification procedure.
