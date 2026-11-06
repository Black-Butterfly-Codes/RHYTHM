# RHYTHM — premium music collaboration platform (working prototype)

Independent music ecosystem:
sign-up/in → location (Indian state/UT) → domain(s): singer, instrumentalist,
lyricist/writer, composer, beatmaker → dashboard → discover/creators →
post work → upvote/downvote/collab on every post → state boards → top-3
national finals (weekly/monthly/yearly/all-time) → collab requests with
work-sample → workspace + chat → joint publish → auction marketplace
(highest bidder wins a documented license) → persistent bottom music player
with queue, favourites and playlists.

## Files
- `main.pjs` — generator metadata.
- `index.html` — thin shell (mounts app, links stylesheet).
- `src/styles.css` — full premium theme (midnight + neon glass, sidebar,
  bottom nav, player, rails, podium, responsive breakpoints).
- `src/app.js` — all logic + views. Logic (auth, votes, boards calc, collabs,
  auctions, admin, security) untouched by redesign; views rewritten.
- `src/store.js` — localStorage DB layer (`rhythm_db_v1`, session key).
- `src/seed.js` — demo regions/users/posts/votes/auctions/collabs/messages.
- `src/audio.js` — WebAudio synth preview (demo stand-in for uploads) +
  volume + loop-progress for the player.
- `src/docs/` — security set: `SECURITY.md`, `AUTH.md`, `DATA_SECURITY.md`,
  `THREAT_MODEL.md`, `SECURITY_CHECKLIST.md`.

## Demo honesty (do not claim otherwise)
All data lives in this browser's localStorage only — nothing is shared
between users or devices. Audio is synthesized per-post (see `audio.js`),
not real uploads. Bids/payments are simulated. Demo logins:
`rahul@demo.in / demo`, `admin@demo.in / demo` (min password length 8 for
new accounts; 5 bad logins → 60 s lockout).

## Key decisions (don't change casually)
- One user, multiple domains (one primary for ranking).
- Location decides WHERE you compete; never WHO you can collab with.
- Boards split by domain AND state AND timeframe. Post-score ≠ artist reputation.
- Unfinished collab work is private; joint publish needs all approvals.
- Auction = explicit listing with license type, reserve, server-style close.
  NFT = optional future certificate only.
- Ownership: lyrics/composition/recording are separate rights.
- No dead buttons: every control is wired to real demo logic.
