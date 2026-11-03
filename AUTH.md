# AUTH.md — Authentication & Authorization (RHYTHM)

## 1. Purpose

How RHYTHM knows *who you are* (authentication) and *what you may do*
(authorization). Implemented in `app.js` + `store.js`, seeded in `seed.js`.

> **Demo scope:** the "backend" is browser `localStorage`. Every check below
> runs in client JavaScript and can be bypassed by anyone with devtools
> access to their own browser. It demonstrates the intended security model;
> it is **not** production enforcement.

## 2. Registration

Fields: full name, unique username, unique email, password + confirmation,
date of birth, state/UT (fixed list — drives leaderboard classification),
city, bio, one-or-more domains + one primary domain.
(`signup()` in `app.js`; hashing in `store.js`.)

Validation rules enforced at signup:

- All required fields present; passwords must match and be **8–200
  characters**.
- Name ≤ 60 chars; bio ≤ 300 chars; city ≤ 60 chars; email ≤ 120 chars and
  must match a basic email pattern.
- Username: 3–24 characters, letters/numbers/dots/dashes/underscores,
  unique case-insensitively.
- Email unique case-insensitively.
- Date of birth is required; the account must be between 13 and 120 years old.
- Domains and state come from fixed lists (no free text → no spoofed
  leaderboard regions).
- Primary domain must be one of the known domains.

Production should additionally verify email ownership before the account can
vote, bid, or transact.

## 3. Password management

- **Demo:** passwords are hashed with **PBKDF2-SHA256**, 210,000 iterations,
  a random 16-byte salt per user, using the Web Crypto API
  (`hashPassword()` / `verifyPassword()` in `store.js`). Only the formatted
  digest (`pbkdf2$<iterations>$<salt>$<hash>`) is stored; plain passwords never
  touch storage.
- Verification uses a constant-time comparison, and malformed stored hashes
  or absurdly low iteration counts fail closed.
- **Legacy migration:** older builds stored a fixed-salt SHA-256 digest.
  `verifyPassword()` still accepts that format once and returns
  `needsUpgrade: true`; `login()` then re-hashes the password with PBKDF2 and
  saves it. This keeps existing demo accounts working.
- Login rate limit: five failed attempts → 60-second lockout stored in
  `rhythm_login_lock_v1`. The message is generic and reveals no account
  existence.
- **Production (required change):** replace client-side hashing with
  **Argon2id** (first choice) or bcrypt on the server, tune the work factor so
  one hash costs ~0.5 s, and never expose the hash to the client.
- Production additions: "forgot password" via single-use emailed token
  (expiry ≤ 1 h), password-change requires current password, forced
  re-login on all devices after reset.

## 4. Sessions

- **Demo:** `setSession()` stores the user id under `rhythm_session_v1`;
  `getSession()` restores it, so users stay logged in until logout, account
  deletion, or storage wipe. `logout()` clears it and resets UI state.
- A cross-tab `storage` listener keeps signed-in state in sync when the
  session changes in another tab.
- **Production (required change):** opaque random session tokens in
  HttpOnly + Secure + SameSite cookies (never localStorage — XSS-readable),
  server-side session table with idle + absolute expiry, rotation on login,
  and "log out everywhere" that invalidates all tokens.

## 5. Roles & permissions (authorization matrix)

| Capability | Owner of the object | Other signed-in user | Suspended user | Admin |
|---|---|---|---|---|
| Post / edit / delete own posts | ✅ | — | ❌ | ✅ (own, and any via moderation) |
| Vote / comment | ✅ others' posts only, never own | ✅ | ❌ | ✅ |
| Collab request / chat | ✅ own requests & projects | ✅ (start requests) | ❌ | — |
| Bid in auctions | ✅ (never own listing) | ✅ | ❌ | ✅ (never own) |
| Create auctions | ✅ own eligible posts | — | ❌ | — |
| View workspaces / DMs | ✅ members only | ❌ | — | ❌ content, ✅ metadata for disputes |
| Suspend users, resolve reports, set commission | — | — | — | ✅ only |

Enforcement points in code:

- `needAuth()` blocks unauthenticated and suspended users on write actions.
- Self-vote/self-bid/self-collab checks in `vote()`, `bid()`, `openCollab()`,
  `sendRequest()`.
- `projectMember()` and thread membership checks gate workspace chat/files and
  DMs.
- Ownership checks on `deletePost()`, `createAuction()`, `openAuctionCreate()`,
  `deleteAccount()` preconditions, and report submission.
- Admin gates (`isAdmin()`) inside `suspendUser()`, `resolveReport()`, and
  `setComm()` — not just in the admin view.
- `adminView()` additionally hides itself from non-admins.

**Production hardening:** every one of these checks must be re-done on the
server (client checks are UX, not security). The admin flag becomes a
server-issued role claim; suspend/ban is enforced by middleware on all write
APIs; private files use signed, expiring URLs scoped to project members; all
admin actions are written to an append-only audit log.

## 6. Account deletion

`deleteAccount()` requires confirmation, refuses while the user has live
auctions with bids or active shared projects, then removes the user's posts,
votes, comments, bids, listings, collaboration requests, projects, threads,
notifications, reports, and profile before clearing the session.

This is a local delete only. Production must also revoke sessions/tokens,
remove media objects, and document legally required retention.
