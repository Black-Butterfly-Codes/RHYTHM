# SECURITY_CHECKLIST.md — Verification Checklist (RHYTHM)

Use for every feature PR and as the gate before any production deploy.
Check = done **and** verified (tested, not just written).

## A. Authentication
- [ ] Signup validates all fields; username/email unique (case-insensitive).
- [ ] Passwords hashed with Argon2id/bcrypt (demo: salted SHA-256 + min length 8 — upgrade before launch).
- [ ] Login compares hashes only; generic "invalid credentials" message (no user enumeration).
- [ ] Login rate-limited (5 fails → 60 s cooldown — implemented in demo `login()`; use server-side counters in production); password reset uses single-use expiring tokens.
- [ ] Demo seed accounts (`demo` passwords) removed/disabled in production.

## B. Session management
- [ ] Production: HttpOnly + Secure + SameSite cookies, server-side sessions, idle + absolute expiry.
- [ ] Logout destroys the token; "log out everywhere" invalidates all tokens.
- [ ] No session/token in URLs, logs, or localStorage (production).

## C. Authorization (test as a second user, not just the owner)
- [ ] Cannot vote/comment on own post; cannot bid on own auction.
- [ ] Cannot read another user's DMs or non-member workspaces (IDOR tested: swap ids in requests).
- [ ] Suspended users blocked from posting/voting/bidding (demo: `needAuth()` + login block); account deletion purges user data (demo: `deleteAccount()` with live-auction/shared-project guards).
- [ ] Admin-only actions (`suspendUser`, `resolveReport`, commission) reject non-admins server-side.

## D. Input validation & output encoding
- [ ] All inputs validated by type/length/range; state from fixed list; numbers are numbers.
- [ ] All user content rendered through escaping (`esc()`) — test with `<script>` / `<img onerror>` payloads.
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
- [ ] Dependencies pinned & reviewed; no unexpected network-loaded code.
- [ ] Rate limits + abuse alarms on auth/vote/bid endpoints; error messages leak nothing (no stack traces to users).
- [ ] Security headers (CSP, HSTS, X-Frame-Options) set; logs contain no passwords/tokens.
- [ ] Re-run this checklist after every release; re-read `THREAT_MODEL.md` quarterly.
