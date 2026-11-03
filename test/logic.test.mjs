import test from "node:test";
import assert from "node:assert/strict";
import { DAY, postScore, topBid, settleOutcome } from "../logic.js";

const NOW = 1_700_000_000_000;

test("postScore counts only votes inside the rolling window", () => {
  const post = {
    votes: [
      { u: "a", v: 1, ts: NOW - 1000 },
      { u: "b", v: -1, ts: NOW - 2000 },
      { u: "c", v: 1, ts: NOW - 10 * DAY },
      { u: "d", v: 1, ts: NOW - 2 * DAY },
    ],
  };
  assert.equal(postScore(post, 7 * DAY, NOW), 1); // +1, -1, +1 inside; old one ignored
  assert.equal(postScore(post, 30 * DAY, NOW), 2);
  assert.equal(postScore(post, Infinity, NOW), 2);
});

test("postScore tolerates missing or malformed vote arrays", () => {
  assert.equal(postScore({}, DAY, NOW), 0);
  assert.equal(postScore({ votes: null }, DAY, NOW), 0);
  assert.equal(postScore({ votes: [{ v: 1, ts: NOW }, null, { v: 5, ts: NOW }] }, DAY, NOW), 1);
});

test("topBid returns null for empty auctions and the highest bid otherwise", () => {
  assert.equal(topBid([]), null);
  assert.equal(topBid(null), null);
  assert.equal(topBid([{ amount: 100 }, { amount: 250 }, { amount: 175 }]).amount, 250);
});

test("settleOutcome ignores auctions that are not live or not finished", () => {
  assert.equal(settleOutcome(null, NOW), null);
  assert.equal(settleOutcome({ status: "completed", endsAt: NOW - 1, bids: [] }, NOW), null);
  assert.equal(settleOutcome({ status: "live", endsAt: NOW + 1, bids: [] }, NOW), null);
});

test("settleOutcome marks a reserve-meeting auction sold and rounds the fee", () => {
  const outcome = settleOutcome(
    { status: "live", endsAt: NOW - 1, reservePrice: 500, bids: [{ amount: 999 }, { amount: 1200 }] },
    NOW,
    5
  );
  assert.equal(outcome.sold, true);
  assert.equal(outcome.top.amount, 1200);
  assert.equal(outcome.fee, 60);
});

test("settleOutcome does not sell below reserve and never charges a fee", () => {
  const outcome = settleOutcome(
    { status: "live", endsAt: NOW - 1, reservePrice: 2000, bids: [{ amount: 1200 }] },
    NOW,
    5
  );
  assert.equal(outcome.sold, false);
  assert.equal(outcome.fee, 0);
});

test("settleOutcome handles an auction with no bids", () => {
  const outcome = settleOutcome({ status: "live", endsAt: NOW - 1, reservePrice: 0, bids: [] }, NOW, 5);
  assert.equal(outcome.sold, false);
  assert.equal(outcome.top, null);
  assert.equal(outcome.fee, 0);
});

test("a zero/negative commission never produces fees", () => {
  const outcome = settleOutcome(
    { status: "live", endsAt: NOW - 1, reservePrice: 0, bids: [{ amount: 1000 }] },
    NOW,
    0
  );
  assert.equal(outcome.fee, 0);
});
