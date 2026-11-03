# SECURITY.md — Overall Security Policy (RHYTHM)

## 1. Purpose

This file states how the RHYTHM project approaches security: what we protect,
what we promise, and exactly what to do if you discover a vulnerability.
Companion docs: `AUTH.md`, `DATA_SECURITY.md`, `THREAT_MODEL.md`,
`SECURITY_CHECKLIST.md` (all in the repository root).

## 2. Security objectives

1. **Account safety** — only the rightful owner can access an account.
2. **Content integrity** — posts, votes, bids and leaderboard scores cannot be
   forged or silently altered.
3. **Privacy of collaboration** — workspaces, chats and unreleased files are
   visible only to project members.
4. **Fair competition** — boards and auctions reflect genuine human activity,
   not bots, duplicates or manipulation.
5. **Safe money movement** — auction settlement is server-verified; the client
   is never trusted about payments.
6. **Legal defensibility** — ownership declarations, licenses and audit trails
   exist for every commercial transaction.

## 3. Scope: prototype vs production

- **This prototype** (`index.html` + root `*.js`) is a *functional demo*: the
  "backend" is the browser's localStorage, there is no server, and all data
  lives on the user's own device. Its controls (salted **PBKDF2-SHA256**
  password hashes, session ids, role checks, vote/bid validation) demonstrate
  the *logic* of the security model, not production-grade enforcement.
- **Production** (per the approved plan: Node.js + Express, PostgreSQL,
  Socket.IO, object storage, Indian payment gateway) MUST re-implement every
  check server-side, because anything enforced only in browser JavaScript can
  be bypassed. Nothing in this demo is reachable over a network, so there is
  no remote attack surface yet — the threat model for launch is in
  `THREAT_MODEL.md`.

## 4. Supported versions

| Version | Status | Receives security fixes |
|---|---|---|
| Prototype (current, root demo) | Demonstration only — not for real users or real money | Best-effort fixes to demo logic |
| Future 1.x production release | To be declared at launch | Yes, for 12 months after each minor release |

Only the latest production release will receive patches. The demo seed
credentials (`rahul@demo.in / demo`, `admin@demo.in / demo`) are public by
design and must NEVER exist in production.

## 5. Responsible disclosure (how to report a security issue)

**Do NOT open a public issue, post, or comment about a vulnerability.**

1. Describe the issue privately to the project maintainers: what you found,
   where (URL + steps to reproduce), and what you think the impact is.
2. Include the app version / commit and your test account (never share real
   passwords).
3. Allow reasonable time for a fix before any public disclosure (we target
   acknowledgement within 5 working days for production reports).
4. Do not access other users' data, do not degrade the service, and stop
   testing once you have demonstrated the issue (good-faith research only).

What reporters can expect: confirmation of receipt, an assessment of impact,
credit in release notes if desired, and notification when the fix ships.

## 6. General security practices (binding on all contributors)

- Never commit secrets (passwords, API keys, payment keys). Demo uses no
  secrets; production loads them from environment variables only.
- Every feature PR must answer: *who can call this, and what stops abuse?*
  (see `SECURITY_CHECKLIST.md`).
- All user input is treated as untrusted: validated, escaped on render
  (`esc()` in `app.js`), and constrained by type/size (see `AUTH.md`,
  `DATA_SECURITY.md`).
- Privileges are minimal by default: normal users can only touch their own
  data; admin powers (`suspendUser`, `resolveReport`, commission changes) are
  gated on the `admin` flag, which becomes a server-checked role in
  production.
- **Zero runtime dependencies.** There are no CDN imports and no npm packages
  in the browser bundle, so there is no third-party code to pin at runtime.
  The web font is self-hosted under `assets/fonts/`; a default build makes no
  third-party requests. Analytics (`analytics.js`) is disabled until the owner
  sets a GA4 measurement ID — doing so would introduce one third-party request
  and must be reflected in the privacy docs.
- `netlify.toml` sets a Content-Security-Policy, `X-Frame-Options: DENY`,
  `X-Content-Type-Options: nosniff`, a strict referrer policy, and a
  restrictive `Permissions-Policy`. `'unsafe-inline'` is required for scripts
  because this prototype uses inline `onclick` handlers; removing it is a
  prerequisite for production hardening.
- CI (`.github/workflows/ci.yml`) runs syntax checks, asset/reference checks,
  and unit tests on every push and pull request.
- Backups and rollback are part of every production deploy
  (see `DATA_SECURITY.md`).
