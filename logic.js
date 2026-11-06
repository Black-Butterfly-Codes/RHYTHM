// Pure, DOM-free scoring/settlement helpers. Kept separate so the rules can be
// unit tested without a browser (see test/logic.test.mjs).

export const DAY = 86400000;

/** Global floor for RHYTHM accounts, and the age of majority used for consent. */
export const MIN_AGE = 13;
export const MAJORITY_AGE = 18;

/**
 * Whole years between a date of birth and a point in time, using UTC so the
 * result does not depend on the machine's timezone. Accepts YYYY-MM-DD (the
 * value of <input type="date">) and, as a fallback, any Date.parse-able string.
 * Returns null for missing/invalid dates.
 */
export function ageFromDob(dob, now = Date.now()) {
  if (dob == null || dob === "") return null;
  let y, m, d;
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(dob));
  if (match) {
    y = Number(match[1]); m = Number(match[2]); d = Number(match[3]);
  } else {
    const t = Date.parse(String(dob));
    if (!Number.isFinite(t)) return null;
    const dt = new Date(t);
    y = dt.getUTCFullYear(); m = dt.getUTCMonth() + 1; d = dt.getUTCDate();
  }
  const check = new Date(Date.UTC(y, m - 1, d));
  if (!Number.isFinite(check.getTime()) || check.getUTCFullYear() !== y || check.getUTCMonth() + 1 !== m || check.getUTCDate() !== d) return null;
  const at = new Date(now);
  if (!Number.isFinite(at.getTime())) return null;
  let age = at.getUTCFullYear() - y;
  if (at.getUTCMonth() + 1 < m || (at.getUTCMonth() + 1 === m && at.getUTCDate() < d)) age--;
  return age >= 0 && age <= 150 ? age : null;
}

/** "under_minimum" (<13), "minor" (13–17), "adult" (18+), or "invalid". */
export function ageBand(dob, now = Date.now()) {
  const age = ageFromDob(dob, now);
  if (age == null) return "invalid";
  if (age < MIN_AGE) return "under_minimum";
  if (age < MAJORITY_AGE) return "minor";
  return "adult";
}

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
