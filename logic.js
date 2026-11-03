// Pure, DOM-free scoring/settlement helpers. Kept separate so the rules can be
// unit tested without a browser (see test/logic.test.mjs).

export const DAY = 86400000;

/** Net votes on a post within a rolling window. */
export function postScore(post, windowMs, now = Date.now()) {
  const since = now - windowMs;
  const votes = post && Array.isArray(post.votes) ? post.votes : [];
  return votes.reduce((sum, v) => sum + (v && v.ts >= since ? (v.v === 1 ? 1 : v.v === -1 ? -1 : 0) : 0), 0);
}

/** Highest bid, or null when there are none. */
export function topBid(bids) {
  if (!Array.isArray(bids) || bids.length === 0) return null;
  return bids.reduce((max, b) => (b.amount > max.amount ? b : max), bids[0]);
}

/**
 * Decide the outcome of an auction at a point in time.
 * @returns {null | {sold: boolean, top: object|null, fee: number}}
 * null means "not finished yet / not live".
 */
export function settleOutcome(auction, now = Date.now(), commissionPct = 5) {
  if (!auction || auction.status !== "live" || now < auction.endsAt) return null;
  const top = topBid(auction.bids);
  const reserve = Number(auction.reservePrice) || 0;
  const sold = Boolean(top && top.amount >= reserve);
  const fee = sold ? Math.round(top.amount * (Number(commissionPct) || 0) / 100) : 0;
  return { sold, top, fee };
}
