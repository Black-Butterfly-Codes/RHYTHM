// RHYTHM local database layer (localStorage acts as the backend in this demo).
//
// Security notes (demo only):
//   · Passwords use PBKDF2-SHA256 with a random per-user salt. Legacy SHA-256
//     digests from older builds are still accepted and upgraded on next login.
//   · The session is a raw user id in localStorage. Anyone with DevTools can
//     forge it. That is acceptable only because this build has no server and
//     no other users' data. Production MUST use HttpOnly server sessions.
export const DB_KEY = "rhythm_db_v1";
export const SESSION_KEY = "rhythm_session_v1";
export const DB_VERSION = 2;

export const PBKDF2_ITERATIONS = 210000;

const encoder = new TextEncoder();

function hex(buf) {
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

function randomHex(bytes = 16) {
  const a = new Uint8Array(bytes);
  if (globalThis.crypto && globalThis.crypto.getRandomValues) {
    globalThis.crypto.getRandomValues(a);
  } else {
    for (let i = 0; i < a.length; i++) a[i] = Math.floor(Math.random() * 256);
  }
  return [...a].map((b) => b.toString(16).padStart(2, "0")).join("");
}

export function uid(prefix = "id") {
  return prefix + "_" + randomHex(8) + Date.now().toString(36).slice(-4);
}

export function loadDB() {
  try {
    const raw = localStorage.getItem(DB_KEY);
    if (raw) return JSON.parse(raw);
  } catch (e) { /* corrupted -> reseed */ }
  return null;
}

/**
 * Persist the database. Never throws; callers decide whether to notify.
 * @returns {{ok: boolean, error?: "quota"|"unavailable"}}
 */
export function saveDB(db) {
  try {
    localStorage.setItem(DB_KEY, JSON.stringify(db));
    return { ok: true };
  } catch (e) {
    const quota = e && (e.name === "QuotaExceededError" || e.code === 22 || e.code === 1014);
    return { ok: false, error: quota ? "quota" : "unavailable" };
  }
}

export function wipeDB() {
  try { localStorage.removeItem(DB_KEY); } catch (e) { /* ignore */ }
}

export function getSession() {
  try { return localStorage.getItem(SESSION_KEY); } catch (e) { return null; }
}

export function setSession(userId) {
  try {
    if (userId) localStorage.setItem(SESSION_KEY, userId);
    else localStorage.removeItem(SESSION_KEY);
  } catch (e) { /* ignore */ }
}

/**
 * Derive a PBKDF2-SHA256 digest with a random per-user salt.
 * Format: pbkdf2$<iterations>$<salt>$<hex-digest>
 */
export async function hashPassword(password, salt, iterations = PBKDF2_ITERATIONS) {
  const s = salt || randomHex(16);
  const key = await crypto.subtle.importKey("raw", encoder.encode(String(password)), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", salt: encoder.encode(s), iterations, hash: "SHA-256" },
    key,
    256
  );
  return `pbkdf2$${iterations}$${s}$${hex(bits)}`;
}

/** Legacy demo hash kept so old local databases still log in. */
export async function sha256(text) {
  const buf = await crypto.subtle.digest("SHA-256", encoder.encode("salt::" + text));
  return hex(buf);
}

function safeEqual(a, b) {
  if (typeof a !== "string" || typeof b !== "string" || a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

/**
 * Verify a password against a stored PBKDF2 digest or a legacy SHA-256 digest.
 * @returns {Promise<{ok: boolean, needsUpgrade: boolean}>}
 */
export async function verifyPassword(password, stored) {
  if (typeof stored !== "string" || !stored) return { ok: false, needsUpgrade: false };

  if (stored.startsWith("pbkdf2$")) {
    const parts = stored.split("$");
    if (parts.length !== 4) return { ok: false, needsUpgrade: false };
    const iterations = Number(parts[1]);
    const salt = parts[2];
    const expected = parts[3];
    if (!Number.isFinite(iterations) || iterations < 1000 || !salt || !expected) {
      return { ok: false, needsUpgrade: false };
    }
    const actual = await hashPassword(password, salt, iterations);
    return { ok: safeEqual(actual, stored), needsUpgrade: false };
  }

  // Legacy build: sha256("salt::" + password)
  const legacy = await sha256(password);
  const ok = safeEqual(legacy, stored);
  return { ok, needsUpgrade: ok };
}
