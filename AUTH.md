# AUTH.md — Authentication & Authorization (RHYTHM)

## 1. Purpose

How RHYTHM knows *who you are* (authentication) and *what you may do*
(authorization). Implemented in `src/app.js` + `src/store.js`, seeded in
`src/seed.js`.

## 2. Registration

Fields: full name, unique username, unique email, password + confirmation,
date of birth, state/UT (fixed list — drives leaderboard classification),
city, bio, one-or-more domains + one primary domain.
(`signup()` in `src/app.js`.)

Validation rules enforced at signup:
- All required fields present; passwords must match (min length 4 in demo,
  **min 12 with complexity rules in production**).
- Username/email uniqueness checked case-insensitively.
- State must come from the fixed `REGIONS` list (no free text → no spoofed
  leaderboard regions).

## 3. Password management

- **Demo:** passwords are hashed with SHA-256 over `("salt::" + password)`
  via `crypto.subtle` (`sha256()` in `src/store.js`) and only the digest is
  stored. Plain passwords never touch storage.
- **Production (required change):** replace SHA-256 with **Argon2id**
  (first choice) or bcrypt with a per-password salt and a work factor tuned
  so one hash costs ~0.5 s. SHA-256 is too fast and unsalted-per-user here —
  it demonstrates hashing, not production password storage.
- Login compares hashes only (`login()`); no password is ever logged,
  displayed, or sent anywhere.
- Production additions: "forgot password" via single-use emailed token
  (expiry ≤ 1 h), password-change requires current password, forced
  re-login on all devices after reset.

## 4. Sessions

- **Demo:** `setSession()` stores the user id under `rhythm_session_key`;
  `getSession()` restores it, so users stay logged in until logout or
  session wipe. `logout()` clears it.
- **Production (required change):** opaque random session tokens in
  HttpOnly + Secure + SameSite cookies (never localStorage — XSS-readable),
  server-side session table with idle + absolute expiry, rotation on login,
  and "log out everywhere" that invalidates all tokens. Login rate-limiting
  (e.g. 5 failures → cooldown + alert) to block brute force.

## 5. Roles & permissions (authorization matrix)

| Capability | Owner of the object | Other signed-in user | Suspended user | Admin |
|---|---|---|---|---|
| Post / edit / delete own posts | ✅ | — | ❌ | ✅ (own) |
| Vote / comment | ✅ others' posts only, never own | ✅ | ❌ | ✅ |
| Collab request / chat | ✅ own requests & projects | ✅ (start requests) | ❌ | — |
| Bid in auctions | ✅ (never own listing) | ✅ | ❌ | ✅ (never own) |
| Create auctions | ✅ own eligible posts | — | ❌ | — |
| View workspaces / DMs | ✅ members only | ❌ | — | ❌ content, ✅ metadata for disputes |
| Suspend users, resolve reports, set commission | — | — | — | ✅ only |

Enforcement points in code: `needAuth()` (suspended block), self-vote/self-bid
rejections in `vote()`/`bid()`, member-only project/thread queries in
`collabsView()`/`msgsView()`, `m.admin` gate in `adminView()`,
`suspendUser`/`resolveReport`/`setComm` admin-only actions.

**Production hardening:** every one of these checks must be re-done on the
server (client checks are UX, not security). Admin flag becomes a
server-issued role claim; suspend/ban is enforced by middleware on all
write APIs; private files use signed, expiring URLs scoped to project
members; all admin actions are written to an append-only audit log.
