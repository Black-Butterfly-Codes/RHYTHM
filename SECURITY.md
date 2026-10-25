# SECURITY.md — Overall Security Policy (RHYTHM)

## 1. Purpose

This file states how the RHYTHM project approaches security: what we protect,
what we promise, and exactly what to do if you discover a vulnerability.
Companion docs: `AUTH.md`, `DATA_SECURITY.md`, `THREAT_MODEL.md`,
`SECURITY_CHECKLIST.md` (all in `src/docs/`).

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

- **This prototype** (`index.html` + `src/*.js`) is a *functional demo*: the
  "backend" is the browser's localStorage, there is no server, and all data
  lives on the user's own device. Its controls (salted SHA-256 password
  hashes, session tokens, role checks, vote/bid validation) demonstrate the
  *logic* of the security model, not production-grade enforcement.
- **Production** (per the approved plan: Node.js + Express, PostgreSQL,
  Socket.IO, object storage, Indian payment gateway) MUST re-implement every
  check server-side, because anything enforced only in browser JavaScript can
  be bypassed. Nothing in this demo is reachable over a network, so there is
  no remote attack surface yet — the threat model for launch is in
  `THREAT_MODEL.md`.

## 4. Supported versions

| Version | Status | Receives security fixes |
|---|---|---|
| Prototype (current, `src/` demo) | Demonstration only — not for real users or real money | Best-effort fixes to demo logic |
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
  (`esc()` in `src/app.js`), and constrained by type/size (see `AUTH.md`,
  `DATA_SECURITY.md`).
- Privileges are minimal by default: normal users can only touch their own
  data; admin powers (`suspendUser`, `resolveReport`, commission changes) are
  gated on the `admin` flag, which becomes a server-checked role in
  production.
- Dependencies (CDN imports, npm packages) are pinned and reviewed; no new
  network-loaded code without a reason recorded in the PR.
- Backups and rollback are part of every production deploy
  (see `DATA_SECURITY.md`).
