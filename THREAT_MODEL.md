# THREAT_MODEL.md — Security Threat Analysis (RHYTHM)

## 1. Method

For each threat: **asset → attacker → scenario → impact → mitigations**
(mapped to code where the demo already handles it). Risk = Likelihood ×
Impact (H/M/L). Production assumptions: Node+Express API, PostgreSQL,
Socket.IO, S3-style storage, Indian payment gateway.

## 2. Assets worth attacking

1. User accounts & sessions (takeover target).
2. Password hashes / email addresses (credential theft).
3. Unreleased creative work & private chats (extortion / leaks).
4. Votes & leaderboard ranks (status, national qualification).
5. Auctions, bids & payouts (direct money).
6. Platform reputation & availability (spam, defacement, DoS).

## 3. Attackers

| Attacker | Objective | Capability |
|---|---|---|
| Opportunist / troll | Harass, spam, deface | Low — uses the UI only |
| Status-seeker | Inflate rank, win boards | Medium — scripts, fake accounts |
| Fraudster | Win auctions cheap / steal payouts | Medium — bidding games, social engineering |
| IP thief | Steal lyrics/beats, claim ownership | Medium — scraping, re-uploads |
| Professional criminal | Credential stuffing, payment fraud | High — botnets, breach combos |
| Malicious insider (incl. rogue admin) | Data access, sabotage | High — privileges |

## 4. Threat scenarios & mitigations

### T1 — Account takeover (credential stuffing / weak passwords)
Risk **H**. Mitigations: strong hashing (Argon2id, `AUTH.md`), rate-limited
login + alerts, session rotation/invalidation, 2FA option in production.

### T2 — Session theft (XSS / token leak)
Risk **H**. Demo: `esc()` on all rendered user content; session is a local id
with no network value. Production: HttpOnly+Secure cookies, TLS/HSTS, CSP,
no tokens in URLs or logs.

### T3 — Fake accounts & vote farming (rigged leaderboards)
Risk **H** (core value proposition). Demo: email/username uniqueness, one vote
per user×post, no self-votes, velocity display. Production: email
verification before voting counts, device/IP velocity caps, one-vote
UNIQUE constraint server-side, Bayesian/confidence ranking, audit log,
admin freeze + correction of boards.

### T4 — Downvote brigading / harassment
Risk **M**. Votes score *posts*, never auto-punish *artists* (reputation
kept separate); reporting + blocking; rate limits; admin review.

### T5 — Fake / spam collaboration requests (phishing, IP harvesting)
Risk **M**. Request quotas per day, block lists, sample-attachment required
(raises attacker cost), workspace private until accepted, report flow.

### T6 — Unauthorized access to private messages / workspaces
Risk **H**. Demo: member-only queries. Production: server-side membership
check on every read, signed expiring file URLs, no IDOR (never trust
client-supplied project/thread ids without ownership check).

### T7 — Malicious file uploads (malware, embedded scripts, pirated content)
Risk **H**. Type/MIME validation + size caps, FFmpeg re-encode of audio,
malware scan, private-bucket quarantine, ownership declaration checkbox on
auction listing, takedown + strike system for copyright claims.

### T8 — Auction abuse (shill bidding, bid shielding, winner won't pay)
Risk **H** (money). Demo: no self-bids, min increment, server-timestamped
close (`tickCountdowns`/`settleAuctions`), reserve price, full bid history.
Production: all of that server-side + payment authorization hold at bid
time, payment deadline with forfeit + bidder reputation, admin dispute queue.

### T9 — Payment / settlement tampering
Risk **H**. Never trust client "paid=true": verify via gateway webhooks with
signed secrets, idempotent transaction records (`transactions` table),
payout = winning bid − published commission − tax, reconciliation job.

### T10 — Copyright / ownership disputes (who owns a 3-person song?)
Risk **M**. Written split required before commercial release (lyrics ≠
composition ≠ recording), version history as evidence, report + admin
adjudication path, license templates per rights type.

### T11 — Admin abuse / overreach
Risk **M**. Role separation, admin actions audit-logged, private content
access only via logged dispute flow, least-privilege DB roles.

### T12 — Availability (spam floods, scraping, DoS on voting/bidding)
Risk **M**. Rate limits per IP+account, CAPTCHA on signup/bidding at abuse
signals, CDN + autoscaling, read replicas for boards, backups (`DATA_SECURITY.md`).

## 5. Attack surfaces (production)

Public web UI → REST/Socket.IO API → auth/session layer → Postgres → object
storage → payment gateway webhooks → admin dashboard → email service. Each
edge enforces authN/authZ; the client is never trusted.

## 6. Residual risks (accepted, monitored)

- Determined human plagiarism of lyrics (can't be fully detected — handled
  by reporting + takedown, not prevention).
- Close-call voting disputes (handled by transparent rules + history, §10 of
  the plan).
- NFT/copyright confusion (handled by explicit license text; NFT optional
  certificate only).
