# RHYTHM — Collaborative Music Creation Platform (blueprint)

Independent music ecosystem (separate from Smart Bite):
sign-up/in → location (Indian state/UT) → domain(s): singer, instrumentalist,
lyricist/writer, composer, beatmaker → post work → upvote/downvote/collab on
every post → state leaderboards → top-3-per-state national finals →
weekly/monthly/yearly/all-time boards → collab requests with work-sample
attachment → accept/reject → private workspace + chat → finished joint work →
auction marketplace (lyrics/beats/compositions, highest bidder wins a
documented license).

## Files
- `main.pjs` — generator metadata (title/description/tags).
- `index.html` — the full professor-ready interactive plan (this is the deliverable;
  print to PDF for submission). Sections 1–30 + viva Q&A.
- `src/README.md` — this file.

## MVP build order (semester-safe)
1. Auth + location + domains + profiles
2. Per-domain publishing + feed/filters
3. Votes + state×domain boards (weekly + all-time)
4. Collab request + workspace + chat
5. Mock auction (bids + winner, simulated payment)
6-7. Polish, tests, deploy. Real payments, national-final automation at scale,
   advanced fraud detection = future work slide.

## Key decisions (don't change casually)
- One user, multiple domains (one primary for ranking).
- Location decides WHERE you compete; never WHO you can collab with.
- Boards split by domain AND state AND timeframe. Post-score ≠ artist reputation.
- Unfinished collab work is private; joint publish needs all approvals.
- Auction = explicit listing with license type (exclusive/non-exclusive/limited),
  reserve price, server-enforced close. NFT = optional future certificate only.
- Ownership: lyrics/composition/recording are separate rights; commercial release
  needs a written split in the workspace.
