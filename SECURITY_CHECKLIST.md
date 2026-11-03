# SECURITY_CHECKLIST.md — Verification Checklist (RHYTHM)

Use for every feature PR and as the gate before any production deploy.
Check = done **and** verified (tested, not just written).

> **Current demo build:** items marked ✅ below are implemented and exercised
> by the unit tests and/or the static checks. Everything else is a production
> requirement. Because the whole "backend" is client-side, no client check is
> a security boundary.

## A. Authentication
- [x] Signup validates all fields; username/email unique (case-insensitive).
- [x] Passwords hashed with PBKDF2-SHA256, 210k iterations, random salt
      (demo: `store.js`; production: Argon2id/bcrypt server-side).
- [x] Login compares hashes only with a constant-time compare; generic
      "invalid credentials" message (no user enumeration).
- [x] Login rate-limited (5 fails → 60 s cooldown — demo `login()`; must be
      server-side in production); password reset uses single-use expiring
      tokens.
- [ ] Demo seed accounts (`demo` passwords) removed/disabled in production.

## B. Session management
- [ ] Production: HttpOnly + Secure + SameSite cookies, server-side sessions, idle + absolute expiry.
- [ ] Logout destroys the token; "log out everywhere" invalidates all tokens.
- [ ] No session/token in URLs, logs, or localStorage (production).

## C. Authorization (test as a second user, not just the owner)
- [x] Cannot vote/comment on own post; cannot bid on own auction.
- [x] Cannot read another user's DMs or non-member workspaces in the demo UI
      (`projectMember`, thread membership checks). Production must re-test
      IDOR by swapping ids at the API.
- [x] Suspended users blocked from posting/voting/bidding (demo: `needAuth()`
      + login block); account deletion purges user data (demo:
      `deleteAccount()` with live-auction/shared-project guards).
- [x] Admin-only actions (`suspendUser`, `resolveReport`, commission) reject
      non-admins in code; production must enforce this server-side.

## D. Input validation & output encoding
- [x] All inputs validated by type/length/range; state from fixed list;
      numbers are numbers.
- [x] All user content rendered through escaping (`esc()`) — tested with
      `<img onerror>` payloads.
- [ ] SQL via parameterized queries only; no string-built queries.

## E. File uploads
- [ ] Extension + MIME sniff + size caps per domain; audio re-encoded (FFmpeg); malware scan; private-bucket quarantine.
- [ ] Ownership declaration required on auction listings; takedown path tested.

## F. Votes, boards & auctions (money-adjacent logic)
- [ ] One vote per user×post (DB UNIQUE constraint), changeable, timestamped; no self-votes.
- [ ] Board math uses vote timestamps per period; history preserved; top-3 qualification auditable.
- [ ] Bids > current + min increment; server-enforced close; reserve logic; full bid history immutable.
- [ ] Settlement + payouts verified against payment-gateway webhooks (never client claims); commission math tested.

## G. Data protection & privacy
- [ ] PII minimized; private content members-only; admin content access logged.
- [ ] TLS everywhere; secrets in env/vault, never in code; backups run and a restore was actually tested.
- [ ] Account deletion erases PII/private content; legal retentions documented (DPDP Act).

## H. Deployment & ongoing
- [x] Zero runtime dependencies; no CDN-loaded code. Fonts are self-hosted.
- [x] Security headers (CSP, X-Frame-Options, nosniff, referrer policy,
      permissions policy) set in `netlify.toml`.
- [x] CI runs syntax checks, asset checks, and unit tests.
- [ ] Rate limits + abuse alarms on auth/vote/bid endpoints; error messages
      leak nothing (no stack traces to users).
- [ ] Logs contain no passwords/tokens.
- [ ] Re-run this checklist after every release; re-read `THREAT_MODEL.md`
      quarterly.
