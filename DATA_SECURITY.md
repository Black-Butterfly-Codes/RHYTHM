# DATA_SECURITY.md — Data Protection (RHYTHM)

## 1. Purpose

How RHYTHM protects personal data, credentials, creative work and commercial
records — in storage, in transit, and in backups.

## 2. What data we hold (and why)

| Category | Examples | Sensitivity |
|---|---|---|
| Identity | name, email, DOB, state/city, bio | High — PII |
| Credentials | password hashes, sessions | Critical |
| Creative work | lyrics, audio, scores, drafts | High — user's IP |
| Private collaboration | workspace chats, unreleased files | High — confidential by default |
| Commercial | bids, transactions, licenses, fees | High — money + legal proof |
| Safety | reports, suspensions, audit events | Medium — needed for disputes |

Principle: collect the minimum needed (see signup fields in `AUTH.md`), keep
unfinished collaboration content private to members, and never publish
anything without an explicit user action.

## 3. Protection in this demo

- Passwords: salted SHA-256 digests only (upgrade path: Argon2id — `AUTH.md`).
- All rendering passes through `esc()` (`src/app.js`) → stored text (lyrics,
  comments, bios) cannot execute as HTML/JS (XSS defense).
- Data lives in the user's own browser localStorage (`DB_KEY`,
  `SESSION_KEY` in `src/store.js`); `wipeDB()` + `resetDemo()` give full
  local deletion. There is no network copy, so no transit exposure — but also
  no server backup: clearing browser data loses the demo DB by design.

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
- Blocking/reporting (`sendReport`, `contactUser` controls) is available to
  every user; reports queue in the admin dashboard with dismiss/act
  dispositions (`resolveReport`).
- Account deletion (production requirement): erases PII and private content,
  retains only anonymized records the law requires (transactions, audit log)
  with documented retention periods, in line with India's DPDP Act.
