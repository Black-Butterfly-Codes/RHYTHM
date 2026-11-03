import test from "node:test";
import assert from "node:assert/strict";
import { hashPassword, verifyPassword, sha256, PBKDF2_ITERATIONS } from "../store.js";

test("hashPassword produces a salted PBKDF2-SHA256 digest", async () => {
  const a = await hashPassword("correct horse battery staple");
  const b = await hashPassword("correct horse battery staple");
  assert.match(a, new RegExp(`^pbkdf2\\$${PBKDF2_ITERATIONS}\\$[a-f0-9]{32}\\$[a-f0-9]{64}$`));
  assert.notEqual(a, b, "each hash must use a fresh random salt");
});

test("verifyPassword accepts the right password and rejects the wrong one", async () => {
  const stored = await hashPassword("s3cret-passphrase");
  assert.deepEqual(await verifyPassword("s3cret-passphrase", stored), { ok: true, needsUpgrade: false });
  assert.deepEqual(await verifyPassword("s3cret-passphras", stored), { ok: false, needsUpgrade: false });
  assert.deepEqual(await verifyPassword("", stored), { ok: false, needsUpgrade: false });
});

test("legacy SHA-256 digests still verify but are flagged for upgrade", async () => {
  const legacy = await sha256("demo");
  assert.deepEqual(await verifyPassword("demo", legacy), { ok: true, needsUpgrade: true });
  assert.deepEqual(await verifyPassword("nope", legacy), { ok: false, needsUpgrade: false });
});

test("malformed stored hashes fail closed", async () => {
  for (const bad of ["", "plaintext", "pbkdf2$1$salt", "pbkdf2$notanumber$aa$bb", null, undefined]) {
    assert.equal((await verifyPassword("anything", bad)).ok, false);
  }
});

test("an absurdly low iteration count is rejected", async () => {
  const weak = "pbkdf2$10$abcd$" + "0".repeat(64);
  assert.equal((await verifyPassword("anything", weak)).ok, false);
});
