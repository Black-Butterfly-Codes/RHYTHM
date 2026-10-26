// RHYTHM app: session, tabs, feed, votes, boards, collabs, auctions, chat.
import { loadDB, saveDB, wipeDB, getSession, setSession, sha256, uid } from "./store.js";
import { seedDB, REGIONS, DOMAINS, DOMAIN_LABEL, GENRES, LANGUAGES } from "./seed.js";
import { togglePreview, isPlaying, stopPreview, setVolume, getVolume, currentTrack } from "./audio.js";
import { initAnalytics, trackPage } from "./analytics.js";

const DAY = 86400000;
const PERIODS = { week: 7 * DAY, month: 30 * DAY, year: 365 * DAY, all: Infinity };
const PERIOD_LABEL = { week: "Weekly", month: "Monthly", year: "Yearly", all: "All-Time" };

let DB = null;
let ME = null;             // current user id
let TAB = "dash";          // default landing: creator dashboard
let AUTH_MODE = "in";      // 'in' | 'up'
let EXPANDED = null;       // expanded post id (comments)
let VIEW_USER = null;      // public profile id (null = me)
let VIEW_PROJECT = null;   // open workspace id
let VIEW_AUCTION = null;   // open auction id
let VIEW_THREAD = null;    // open DM thread id
let F = { q: "", domain: "", state: "", genre: "", lang: "", collab: false, sort: "top" };
let B = { domain: "lyricist", scope: "mystate", state: "", period: "week" };
let MODAL = null;          // {kind:'post'|'collab'|'auction'|'report'|'playlist'|'picklist', ...}
let SIGNUP_DOMAINS = ["lyricist"];
let QUEUE = [];            // player queue (post ids)
let QIDX = -1;             // index into QUEUE, -1 = nothing loaded
let VOL = 0.8;

function migrate() {
  if (DB.commissionPct == null) DB.commissionPct = 5;
  for (const u of DB.users) {
    if (!Array.isArray(u.favs)) u.favs = [];
    if (!Array.isArray(u.following)) u.following = [];
    if (!Array.isArray(u.playlists)) u.playlists = [];
  }
}

export async function boot() {
  DB = loadDB();
  if (!DB) {
    DB = seedDB();
    for (const u of DB.users) u.pass = await sha256(u.pass);
  }
  migrate();
  saveDB(DB);
  ME = getSession();
  if (ME && !DB.users.some((u) => u.id === ME)) { ME = null; setSession(null); }
  B.state = myState();
  setVolume(VOL);
  routeHash(); // honour #/tab or #/post-ID deep links on load
  window.addEventListener("hashchange", () => {
    if (HASH_GUARD) return;
    const scrolled = routeHash();
    render();
    if (scrolled) setTimeout(() => { const el = document.getElementById("post-" + EXPANDED); if (el) el.scrollIntoView({ block: "center" }); }, 60);
  });
  initAnalytics();
  render();
  setInterval(tickCountdowns, 1000);
  setInterval(updatePlayerUI, 500);
}

function save() { saveDB(DB); }
function me() { return DB.users.find((u) => u.id === ME); }
function myState() { const m = me(); return m ? m.state : "Uttarakhand"; }
function userById(id) { return DB.users.find((u) => u.id === id); }
function postById(id) { return DB.posts.find((p) => p.id === id); }

function esc(s) {
  return String(s == null ? "" : s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}
function timeAgo(ts) {
  const d = Date.now() - ts;
  if (d < 60000) return "just now";
  if (d < 3600000) return Math.floor(d / 60000) + "m ago";
  if (d < DAY) return Math.floor(d / 3600000) + "h ago";
  if (d < 30 * DAY) return Math.floor(d / DAY) + "d ago";
  return new Date(ts).toLocaleDateString();
}
function avaColor(name) {
  let h = 0; for (const c of name) h = (h * 31 + c.charCodeAt(0)) % 360;
  return `linear-gradient(135deg,hsl(${h},70%,60%),hsl(${(h + 60) % 360},70%,50%))`;
}
function ava(name, sz) {
  const label = "Avatar of " + (name || "deleted user");
  return `<div class="avatar" role="img" aria-label="${esc(label)}" style="background:${avaColor(name || "?")};${sz ? `width:${sz}px;height:${sz}px;` : ""}">${esc((name || "?").trim()[0].toUpperCase())}</div>`;
}
// ---- premium helpers (views only; logic untouched) ----
const DOMAIN_EMOJI = { singer: "🎤", instrumentalist: "🎸", lyricist: "✍️", composer: "🎼", beatmaker: "🥁" };
function artStyle(seedStr) {
  let h = 0; const s = String(seedStr || "?");
  for (const c of s) h = (h * 31 + c.charCodeAt(0)) % 360;
  return `background:linear-gradient(135deg,hsl(${h},80%,48%),hsl(${(h + 70) % 360},85%,33%),hsl(${(h + 140) % 360},90%,26%))`;
}
function artHtml(p) {
  const label = "Artwork for " + (p.title || DOMAIN_LABEL[p.domain] || "track");
  return `<div class="art" role="img" aria-label="${esc(label)}" style="${artStyle(p.audioSeed || p.id)}"><span class="em" aria-hidden="true">${DOMAIN_EMOJI[p.domain] || "🎵"}</span></div>`;
}
function followersOf(id) { return DB.users.filter((u) => (u.following || []).includes(id)).length; }
function fmtT(s) { s = Math.max(0, Math.floor(s || 0)); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`; }
function completion(u) {
  const posts = DB.posts.filter((p) => p.userId === u.id);
  const ups = posts.reduce((s, p) => s + p.votes.filter((v) => v.v === 1).length, 0);
  const steps = [
    ["Profile info", !!(u.bio && u.city && u.city !== "—")],
    ["2+ domains", u.domains.length > 1],
    ["First publish", posts.length > 0],
    ["First upvote", ups > 0],
    ["First collab", DB.projects.some((p) => p.members.some((m) => m.userId === u.id))],
  ];
  const done = steps.filter((s) => s[1]).length;
  return { pct: Math.round(done / steps.length * 100), steps };
}
function trending(windowMs, n) {
  return DB.posts.slice().sort((a, b) => postScore(b, windowMs) - postScore(a, windowMs)).slice(0, n || 6);
}
function updatePlayerUI() {
  const t = currentTrack();
  const fill = document.getElementById("ppFill"), tm = document.getElementById("ppTime");
  if (!t || !fill) return;
  const pct = t.dur ? (t.elapsed / t.dur * 100) : 0;
  fill.style.width = pct + "%";
  if (tm) tm.textContent = fmtT(t.elapsed) + " / " + fmtT(t.dur);
}

// ---- SEO: per-screen titles/descriptions, canonical, robots, hash routes ----
const CONTACT_EMAIL = ""; // TODO(owner): set support inbox, e.g. "hello@example.com". See src/CONTACT.md.

const SEO_META = {
  auth: ["Sign in | RHYTHM", "Sign in to RHYTHM and join singers, instrumentalists, lyricists, composers and beatmakers creating together."],
  dash: ["Creator Dashboard | RHYTHM", "Your RHYTHM home: stats, engagement, collaborations, trending tracks, playlists and alerts."],
  home: ["Discover Music | RHYTHM", "Discover trending tracks, featured creators and fresh uploads from independent artists on RHYTHM."],
  creators: ["Explore Creators | RHYTHM", "Find singers, instrumentalists, lyricists, composers and beatmakers to follow and collaborate with."],
  explore: ["Explore Tracks | RHYTHM", "Search RHYTHM tracks by domain, genre, language, state and collaboration availability."],
  boards: ["Leaderboards | RHYTHM", "State and national rankings for every creative domain, updated weekly, monthly, yearly and all-time."],
  collabs: ["Collaborations | RHYTHM", "Manage collaboration requests and creative workspaces with fellow musicians."],
  auctions: ["Marketplace | RHYTHM", "Bid on original lyrics, beats and compositions, or auction your own work with documented licenses."],
  msgs: ["Messages | RHYTHM", "Private chats with collaborators and artists on RHYTHM."],
  notifs: ["Notifications | RHYTHM", "Votes, comments, collaboration updates, leaderboard moves and auction alerts."],
  profile: ["Profile | RHYTHM", "Creator profile: portfolio, stats, achievements, followers and collaboration options."],
  admin: ["Admin | RHYTHM", "Platform moderation dashboard."],
  privacy: ["Privacy Policy | RHYTHM", "How RHYTHM handles your account data, content and local storage in this prototype build."],
  contact: ["Contact Us | RHYTHM", "Get in touch with the RHYTHM team: questions, feedback and support."],
};

function applySeo() {
  const pub = !ME && (TAB === "privacy" || TAB === "contact");
  const key = !ME ? (pub ? TAB : "auth") : (SEO_META[TAB] ? TAB : "dash");
  const [t, d] = SEO_META[key];
  document.title = t;
  let m = document.querySelector('meta[name="description"]');
  if (!m) { m = document.createElement("meta"); m.setAttribute("name", "description"); document.head.appendChild(m); }
  m.setAttribute("content", d);
  const canon = location.origin + location.pathname + (TAB === "privacy" || TAB === "contact" ? "#/" + TAB : "");
  let c = document.querySelector('link[rel="canonical"]');
  if (!c) { c = document.createElement("link"); c.setAttribute("rel", "canonical"); document.head.appendChild(c); }
  c.setAttribute("href", canon);
  // App screens are private per-user state: keep them out of indexes. Public
  // pages (privacy/contact, logged out) stay indexable.
  let r = document.querySelector('meta[name="robots"]');
  if (!pub) {
    if (!r) { r = document.createElement("meta"); r.setAttribute("name", "robots"); document.head.appendChild(r); }
    r.setAttribute("content", "noindex, nofollow");
  } else if (r) r.remove();
  trackPage(key);
}

let HASH_GUARD = false;
function setHash(h) {
  if (location.hash === h) return;
  HASH_GUARD = true;
  location.hash = h;
  setTimeout(() => { HASH_GUARD = false; }, 80);
}
/** Parse location.hash into TAB/EXPANDED state. Never renders by itself. */
function routeHash() {
  const h = location.hash || "";
  const mPost = h.match(/^#\/post-(.+)$/);
  if (mPost) {
    const p = postById(mPost[1]);
    if (p && ME) { TAB = "home"; EXPANDED = p.id; VIEW_USER = null; }
    else if (!ME) { TAB = "home"; EXPANDED = null; }
    return Boolean(p && ME);
  }
  const mTab = h.match(/^#\/([a-z]+)$/);
  if (mTab) {
    const t = mTab[1];
    if (t === "privacy" || t === "contact") { TAB = t; return false; }
    if (ME && SEO_META[t]) TAB = t;
  }
  return false;
}
function toast(msg) {
  const t = document.createElement("div");
  t.className = "toast"; t.textContent = msg;
  document.body.appendChild(t);
  setTimeout(() => t.remove(), 2600);
}
function notify(userId, text, kind) {
  DB.users.some((u) => u.id === userId) &&
    DB.notifications.push({ id: uid("n"), userId, text, kind: kind || "info", ts: Date.now(), read: false });
}

// ---------- scoring / boards ----------
function postScore(p, windowMs) {
  const since = Date.now() - windowMs;
  return p.votes.reduce((s, v) => s + (v.ts >= since ? v.v : 0), 0);
}
function userScore(userId, domain, windowMs) {
  return DB.posts.filter((p) => p.userId === userId && p.domain === domain)
    .reduce((s, p) => s + postScore(p, windowMs), 0);
}
function stateBoard(domain, state, windowMs) {
  return DB.users
    .filter((u) => !u.suspended && !u.admin && u.state === state && u.domains.includes(domain))
    .map((u) => ({ u, score: userScore(u.id, domain, windowMs) }))
    .filter((r) => r.score !== 0 || DB.posts.some((p) => p.userId === r.u.id && p.domain === domain))
    .sort((a, b) => b.score - a.score);
}
function nationalBoard(domain, windowMs) {
  const qualifiers = [];
  const seen = new Set();
  REGIONS.forEach((st) => {
    stateBoard(domain, st, windowMs).slice(0, 3).forEach((r) => {
      if (!seen.has(r.u.id)) { seen.add(r.u.id); qualifiers.push({ ...r, fromState: st }); }
    });
  });
  return qualifiers.sort((a, b) => b.score - a.score);
}

// ---------- auctions ----------
function topBid(a) {
  return a.bids.length ? a.bids.reduce((m, b) => (b.amount > m.amount ? b : m), a.bids[0]) : null;
}
function settleAuctions() {
  let changed = false;
  const now = Date.now();
  for (const a of DB.auctions) {
    if (a.status !== "live" || now < a.endsAt) continue;
    a.status = "completed";
    const top = topBid(a);
    const ok = top && top.amount >= (a.reservePrice || 0);
    if (ok) {
      const fee = Math.round(top.amount * (DB.commissionPct || 5) / 100);
      DB.transactions.push({ id: uid("t"), auctionId: a.id, sellerId: a.sellerId, buyerId: top.userId, amount: top.amount, fee, ts: now });
      notify(top.userId, `You WON “${a.title}” for ₹${top.amount}. Proceed to payment in Auctions.`, "auction");
      notify(a.sellerId, `Your auction “${a.title}” sold for ₹${top.amount} (fee ₹${fee}).`, "auction");
    } else {
      notify(a.sellerId, `Your auction “${a.title}” ended with no qualifying bid.`, "auction");
    }
    changed = true;
  }
  if (changed) save();
}
function tickCountdowns() {
  settleAuctions();
  document.querySelectorAll("[data-ends]").forEach((el) => {
    const ms = +el.dataset.ends - Date.now();
    if (ms <= 0) { el.textContent = "ended"; return; }
    const h = Math.floor(ms / 3600000), m = Math.floor(ms % 3600000 / 60000), s = Math.floor(ms % 60000 / 1000);
    el.textContent = h > 48 ? `${Math.floor(h / 24)}d ${h % 24}h left` : `${h}h ${m}m ${s}s left`;
  });
}

// ============================ VIEWS ============================
function render(keepScroll) {
  const y = keepScroll ? window.scrollY : 0;
  const c = document.getElementById("bootCtn");
  const pub = !ME && (TAB === "privacy" || TAB === "contact");
  c.innerHTML = ME ? appView() : (pub ? publicView() : authView());
  if (ME) tickCountdowns();
  applySeo();
  window.scrollTo(0, keepScroll ? y : 0);
}

// ----- auth -----
function authView() {
  const inMode = AUTH_MODE === "in";
  return `<div class="authWrap">
    <div class="authLogo"><div class="mark">♪</div>
      <h1>RHYTHM</h1>
      <p class="muted small">Discover Talent. Create Together. Rise Together.</p>
      <p class="small dim">Demo build — local data only, nothing leaves your browser.<br>Try <b>rahul@demo.in / demo</b> · admin: <b>admin@demo.in / demo</b></p></div>
    <div class="glass">
      <div class="row">
        <button class="btn ${inMode ? "" : "ghost"}" onclick="R.setAuth('in')">Sign In</button>
        <button class="btn ${inMode ? "ghost" : ""}" onclick="R.setAuth('up')">Sign Up</button>
      </div>
      ${inMode ? `
      <label>Email or username</label><input id="liIdInput" placeholder="rahul@demo.in" autocomplete="username">
      <label>Password</label><input id="liPassInput" type="password" placeholder="••••••••" autocomplete="current-password">
      <div class="row" style="margin-top:14px"><button class="btn grow" onclick="R.login()">Sign In →</button></div>
      <p class="small dim"><a onclick="R.fakeRecovery()">Forgot password?</a> (demo build — use a seeded account)</p>
      ` : `
      <label>Full name</label><input id="suNameInput" placeholder="Your name">
      <label>Username</label><input id="suUserInput" placeholder="e.g. deelbeats">
      <label>Email</label><input id="suEmailInput" placeholder="you@email.in">
      <div class="grid2"><div><label>Password (min 8)</label><input id="suPassInput" type="password" autocomplete="new-password"></div>
      <div><label>Confirm password</label><input id="suPass2Input" type="password" autocomplete="new-password"></div></div>
      <div class="grid2"><div><label>Date of birth</label><input id="suDobInput" type="date"></div>
      <div><label>City</label><input id="suCityInput" placeholder="Dehradun"></div></div>
      <label>State / Union Territory (decides your leaderboard)</label>
      <select id="suStateInput">${REGIONS.map((r) => `<option>${r}</option>`).join("")}</select>
      <label>Creative domains (pick all that apply)</label>
      <div class="domPick">${DOMAINS.map((d) => `<label data-dom="${d}" class="${SIGNUP_DOMAINS.includes(d) ? "sel" : ""}"><input type="checkbox" ${SIGNUP_DOMAINS.includes(d) ? "checked" : ""} onchange="R.toggleDom('${d}')">${DOMAIN_LABEL[d]}</label>`).join("")}</div>
      <label>Primary domain (your main ranking)</label><select id="suPrimaryInput">${SIGNUP_DOMAINS.map((d) => `<option value="${d}">${DOMAIN_LABEL[d]}</option>`).join("")}</select>
      <label>Bio</label><input id="suBioInput" placeholder="Short intro…">
      <div class="row" style="margin-top:14px"><button class="btn grow" onclick="R.signup()">Create account →</button></div>`}
    </div>${footLinks()}</div>${MODAL ? modalHtml() : ""}`;
}

// ----- public shell, footer, privacy & contact (crawlable, no login needed) -----
function footLinks() {
  const pub = !ME;
  const goTab = (t, label) => pub && !["privacy", "contact"].includes(t)
    ? `<a onclick="R.go('__signin')">${label}</a>`
    : `<a onclick="R.nav('${t}')">${label}</a>`;
  return `<div class="foot"><span>© RHYTHM · Discover Talent. Create Together. Rise Together.</span><span class="grow"></span>
    <a onclick="R.nav('privacy')">Privacy Policy</a><a onclick="R.nav('contact')">Contact</a>
    ${goTab("home", "Discover")}${goTab("creators", "Creators")}${goTab("boards", "Leaderboards")}
    <a href="https://github.com/Black-Butterfly-Codes/RHYTHM" target="_blank" rel="noopener">GitHub</a></div>`;
}
// '__signin' pseudo-target: logged-out users land on the sign-in screen.
function publicView() {
  const body = TAB === "contact" ? contactView() : privacyView();
  return `<div class="authWrap" style="max-width:720px">
    <div class="authLogo"><div class="mark">♪</div><h1 style="letter-spacing:.18em;margin:14px 0 2px;font-size:22px">RHYTHM</h1>
    <p class="muted small">Discover Talent. Create Together. Rise Together.</p></div>
    <div class="row" style="justify-content:center;margin-bottom:6px">
      <button class="btn small ghost" onclick="R.nav('privacy')">Privacy</button>
      <button class="btn small ghost" onclick="R.nav('contact')">Contact</button>
      <button class="btn small" onclick="R.go('__signin')">Sign in / Join →</button>
    </div>${body}${footLinks()}</div>${MODAL ? modalHtml() : ""}`;
}
function crumbs(items) {
  return `<nav class="crumbs" aria-label="Breadcrumb">${items.map((it, i) =>
    i < items.length - 1 ? `<a onclick="R.nav('${it[1]}')">${esc(it[0])}</a><span aria-hidden="true">›</span>`
    : `<span aria-current="page">${esc(it[0])}</span>`).join("")}</nav>`;
}
function privacyView() {
  return `${ME ? crumbs([["Dashboard", "dash"], ["Privacy Policy", ""]]) : crumbs([["RHYTHM", "privacy"], ["Privacy Policy", ""]])}
  <div class="glass"><h2 style="margin-top:0">Privacy Policy</h2>
  <p class="small dim">Last updated: October 2026 · Prototype build. This policy describes what this demo actually does — not a future production system.</p>
  <h3>1. What this app is</h3>
  <p class="small">RHYTHM is currently a <b>client-side prototype</b>: all data lives in your own browser's local storage on your device. There is no RHYTHM server, no cloud database, and nothing is transmitted anywhere over the network by the app itself.</p>
  <h3>2. Information you provide</h3>
  <p class="small">When you sign up you enter a name, username, email, password, date of birth, state/city and bio. When you use the app you create posts (lyrics, track metadata), votes, comments, collaboration messages, bids and auction listings. All of it is stored locally in your browser.</p>
  <h3>3. Passwords & sessions</h3>
  <p class="small">Passwords are stored only as salted SHA-256 hashes (demo-grade; production will use Argon2id). Sessions persist in local storage until you log out. Five failed logins trigger a 60-second lockout. See <b>src/docs/AUTH.md</b> in the project repo.</p>
  <h3>4. Cookies & local storage</h3>
  <p class="small">The app uses local storage keys for the database, your session and login-attempt limits. It sets no third-party cookies. Analytics is included in the code but <b>disabled until the owner configures a measurement ID</b> — with the default build, no analytics requests are made.</p>
  <h3>5. Sharing & third parties</h3>
  <p class="small">None. Your data never leaves your device through this app. Share links you copy contain only a track reference. If you contact support by email, your message goes to that inbox under that provider's policy.</p>
  <h3>6. Retention & deletion</h3>
  <p class="small">Data persists until you clear browser storage, use “Reset demo data”, or delete your account (Profile → Delete my account), which purges your posts, votes, chats, listings and profile from this device.</p>
  <h3>7. Security limitations (read carefully)</h3>
  <p class="small">Browser local storage is <b>not encrypted</b> and is readable by any script running on the same origin, so this prototype must not hold sensitive personal data. Production hosting will add TLS, server-side auth, encrypted storage and backups (see <b>src/docs/DATA_SECURITY.md</b>).</p>
  <h3>8. Children</h3><p class="small">RHYTHM is intended for users aged 13 and above.</p>
  <h3>9. Contact</h3><p class="small">Privacy questions: use the <a onclick="R.nav('contact')">contact page</a>${CONTACT_EMAIL ? ` or email ${esc(CONTACT_EMAIL)}` : " (support inbox address to be published by the owner)"}.</p>
  </div>`;
}
function contactView() {
  window.__ctT = Date.now();
  return `${ME ? crumbs([["Dashboard", "dash"], ["Contact", ""]]) : crumbs([["RHYTHM", "contact"], ["Contact", ""]])}
  <div class="glass"><h2 style="margin-top:0">Contact us</h2>
  <p class="small muted">Questions, feedback or support requests. Fields marked * are required. Please don't include passwords.</p>
  <div id="ctMsg" aria-live="polite"></div>
  <label>Name *</label><input id="ctName" autocomplete="name" placeholder="Your name">
  <label>Email *</label><input id="ctEmail" type="email" autocomplete="email" placeholder="you@example.com">
  <label>Subject *</label><input id="ctSubject" placeholder="What is this about?">
  <label>Message *</label><textarea id="ctBody" rows="5" placeholder="How can we help? (min 10 characters)"></textarea>
  <input id="ctCompany" class="hp" type="text" tabindex="-1" autocomplete="off" aria-hidden="true">
  <div class="row" style="margin-top:12px"><button class="btn" onclick="R.submitContact()">Send message</button></div>
  <p class="small dim">Also available: <a href="https://github.com/Black-Butterfly-Codes/RHYTHM" target="_blank" rel="noopener">GitHub repository</a>.</p>
  </div>`;
}
export function submitContact() {
  const g = (id) => document.getElementById(id).value.trim();
  const box = document.getElementById("ctMsg");
  const fail = (t) => { box.innerHTML = `<div class="formErr" role="alert">${esc(t)}</div>`; };
  if (g("ctCompany")) return fail("Spam check failed. Please try again.");
  if (window.__ctT && Date.now() - window.__ctT < 2000) return fail("That was too fast — please take a moment and resend.");
  if (g("ctName").length < 2) return fail("Please enter your name.");
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(g("ctEmail"))) return fail("Please enter a valid email address.");
  if (g("ctSubject").length < 3) return fail("Please add a subject.");
  if (g("ctBody").length < 10) return fail("Message needs at least 10 characters.");
  const subject = encodeURIComponent("[RHYTHM contact] " + g("ctSubject"));
  const body = encodeURIComponent(`From: ${g("ctName")} <${g("ctEmail")}>\n\n${g("ctBody")}`);
  if (!CONTACT_EMAIL) {
    box.innerHTML = `<div class="formOk" role="status">Your message is ready, but the owner hasn't published a support inbox yet. <button class="chip" onclick="R.copyContactText()">Copy message to clipboard</button></div>`;
    return;
  }
  box.innerHTML = `<div class="formOk" role="status">Opening your email app to send the message…</div>`;
  location.href = `mailto:${CONTACT_EMAIL}?subject=${subject}&body=${body}`;
}
export function copyContactText() {
  const g = (id) => document.getElementById(id).value.trim();
  const txt = `To: RHYTHM support\nFrom: ${g("ctName")} <${g("ctEmail")}>\nSubject: ${g("ctSubject")}\n\n${g("ctBody")}`;
  if (navigator.clipboard) navigator.clipboard.writeText(txt).then(() => toast("Message copied — send it to the support inbox."), () => toast("Copy failed — select the text manually."));
}

// ----- app shell: sidebar (desktop) + bottom nav (mobile) + player -----
function navItems() {
  const m = me();
  const unread = DB.notifications.filter((n) => n.userId === ME && !n.read).length;
  const reqs = DB.collabRequests.filter((r) => r.toId === ME && r.status === "pending").length;
  const items = [
    ["dash", "🏠", "Dashboard"],
    ["home", "✨", "Discover"],
    ["creators", "🎙", "Explore Creators"],
    ["__create", "＋", "Upload / Create"],
    ["collabs", "🤝", "Collaborations" + (reqs ? `|${reqs}` : "")],
    ["msgs", "💬", "Messages"],
    ["boards", "🏆", "Leaderboards"],
    ["auctions", "🔨", "Marketplace"],
    ["notifs", "🔔", "Notifications" + (unread ? `|${unread}` : "")],
    ["profile", "👤", "Profile & Settings"],
  ];
  if (m.admin) items.push(["admin", "🛡", "Admin"]);
  return items.map(([k, ic, l]) => {
    const parts = l.split("|");
    return { k, ic, label: parts[0], bdg: parts[1] || "" };
  });
}
function appView() {
  const m = me();
  const items = navItems();
  const side = items.map((t) => `<button class="navBtn ${TAB === t.k ? "on" : ""}" onclick="R.nav('${t.k}')"><span class="ic">${t.ic}</span>${t.label}${t.bdg ? `<span class="bdg">${t.bdg}</span>` : ""}</button>`).join("");
  const mobiles = [["dash", "🏠", "Home"], ["home", "✨", "Discover"], ["__create", "＋", "Create"], ["collabs", "🤝", "Collabs"], ["profile", "👤", "Profile"]];
  const bnav = mobiles.map(([k, ic, l]) => `<button class="${TAB === k ? "on" : ""}" onclick="R.nav('${k}')"><span>${ic}</span>${l}</button>`).join("");
  let body = "";
  if (TAB === "dash") body = dashView();
  else if (TAB === "home") body = homeView();
  else if (TAB === "creators") body = creatorsView();
  else if (TAB === "explore") body = exploreView();
  else if (TAB === "boards") body = boardsView();
  else if (TAB === "collabs") body = collabsView();
  else if (TAB === "auctions") body = auctionsView();
  else if (TAB === "msgs") body = msgsView();
  else if (TAB === "notifs") body = notifsView();
  else if (TAB === "profile") body = profileView();
  else if (TAB === "privacy") body = privacyView();
  else if (TAB === "contact") body = contactView();
  else if (TAB === "admin") body = adminView();
  return `<div class="app">
    <aside class="side">
      <div class="brand" onclick="R.nav('dash')"><span class="mark">♪</span><span><b>RHYTHM</b><small>CREATE TOGETHER</small></span></div>
      ${side}
      <div class="sideFoot"><a onclick="R.nav('privacy')">Privacy</a> · <a onclick="R.nav('contact')">Contact</a><br>Demo build · data stays<br>in this browser only.<br><a onclick="R.resetDemo()">↺ Reset demo data</a> · <a onclick="R.logout()">Logout</a></div>
    </aside>
    <div class="main">
      <div class="toprow">
        <div class="searchbar">🔍<input id="topSearch" placeholder="Search tracks, lyrics, creators…" value="${esc(F.q)}" oninput="R.topSearch(this.value)"></div>
        ${ava(m.username)}
      </div>
      ${m.suspended ? `<div class="glass"><b style="color:#fb7185">Account suspended</b><p class="small muted">Posting, voting and bidding are disabled.</p></div>` : ""}
      ${body}${footLinks()}
    </div>
  </div>
  <nav class="bnav">${bnav}</nav>
  ${playerBar()}
  ${MODAL ? modalHtml() : ""}`;
}

function playerBar() {
  const p = QIDX >= 0 ? postById(QUEUE[QIDX]) : null;
  if (!p) return `<div class="player"><span class="emptyPlayer">🎵 Pick a track — every play is a synthesized demo preview.</span></div>`;
  const a = userById(p.userId);
  const fav = (me().favs || []).includes(p.id);
  const playing = isPlaying(p.id);
  return `<div class="player">
    <div class="art" style="${artStyle(p.audioSeed || p.id)};width:52px;height:52px"><span class="em">${DOMAIN_EMOJI[p.domain] || "🎵"}</span></div>
    <div class="tmeta"><b>${esc(p.title)}</b><span>${esc(a ? a.username : "?")} · ${esc(p.genre)}</span></div>
    <div class="pctr">
      <button class="pbtn ghost" onclick="R.prevTrack()">⏮</button>
      <button class="pbtn" onclick="R.togglePlay()">${playing ? "⏸" : "▶"}</button>
      <button class="pbtn ghost" onclick="R.nextTrack()">⏭</button>
    </div>
    <div class="pprog" onclick="R.seekRestart(event)"><div class="bar"><i id="ppFill" style="width:0%"></i></div></div>
    <span class="ptime" id="ppTime">0:00</span>
    <button class="pbtn ghost ${fav ? "on" : ""}" onclick="R.toggleFav('${p.id}',true)">♥</button>
    <button class="pbtn ghost" onclick="R.openPickList('${p.id}')">＋</button>
    <div class="vol">🔊<input type="range" min="0" max="100" value="${Math.round(getVolume() * 100)}" oninput="R.setVol(this.value)"></div>
  </div>`;
}

// ----- track row (feed / portfolio) -----
function trackRow(p, queueIds, opts) {
  opts = opts || {};
  const a = userById(p.userId);
  const myVote = p.votes.find((v) => v.u === ME);
  const live = DB.auctions.find((x) => x.postId === p.id && x.status === "live");
  const playing = isPlaying(p.id);
  const qArr = Array.isArray(queueIds) ? queueIds : String(queueIds || p.id).split(",").filter(Boolean);
  const q = (qArr.length ? qArr : [p.id]).join(",");
  return `<div class="track" id="post-${p.id}">
    <div style="position:relative;cursor:pointer" onclick="R.playTrack('${p.id}','${q}')">${artHtml(p)}
      ${playing ? `<span style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center;font-size:20px">⏸</span>` : ""}</div>
    <div class="meta">
      <b style="cursor:pointer" onclick="R.openPost('${p.id}')">${esc(p.title)}</b>
      <span class="sub"><a onclick="R.viewUser('${p.userId}')">${esc(a ? a.username : "deleted")}</a> · ${DOMAIN_LABEL[p.domain]} · ${esc(p.genre)} · ${timeAgo(p.createdAt)}</span>
      <span>${p.collabOpen ? `<span class="badge cy">open to collab</span>` : ""}${live ? `<span class="badge hot">🔨 on auction</span>` : ""}${p.bpm ? `<span class="badge">${p.bpm} BPM</span>` : ""}</span>
      ${p.domain === "lyricist" && p.body && opts.expanded ? `<div class="lyricsBox">${esc(p.body)}</div>` : ""}
      ${opts.expanded ? commentsHtml(p) : ""}
      ${!opts.expanded && p.domain === "lyricist" && p.body ? `<div class="small dim" style="cursor:pointer" onclick="R.toggleExpand('${p.id}')">📜 lyrics preview — tap to expand</div>` : ""}
    </div>
    <div class="voteCol">
      <button class="${myVote && myVote.v === 1 ? "up" : ""}" onclick="R.vote('${p.id}',1)">▲ ${p.votes.filter((v) => v.v === 1).length}</button>
      <button class="${myVote && myVote.v === -1 ? "dn" : ""}" onclick="R.vote('${p.id}',-1)">▼ ${p.votes.filter((v) => v.v === -1).length}</button>
    </div>
    <div class="voteCol">
      <button class="pbtn ${playing ? "" : "ghost"}" style="width:38px;height:38px" onclick="R.playTrack('${p.id}','${q}')">${playing ? "⏸" : "▶"}</button>
      <button onclick="R.toggleExpand('${p.id}')" title="comments">💬 ${p.comments.length}</button>
    </div>
    <div class="voteCol">
      ${p.userId !== ME ? `<button onclick="R.openCollab('${p.id}')" title="collaborate">🤝</button>` : ""}
      <button onclick="R.share('${p.id}')" title="share">↗</button>
      ${p.userId === ME ? `${p.auctionEligible && !live ? `<button onclick="R.openAuctionCreate('${p.id}')" title="auction">🔨</button>` : ""}<button onclick="R.deletePost('${p.id}')" title="delete">🗑</button>` : `<button onclick="R.openReport('${p.id}')" title="report">⚑</button>`}
    </div>
  </div>`;
}
// legacy name kept for compatibility
function postCard(p, opts) { return trackRow(p, [p.id], opts); }
function commentsHtml(p) {
  return `<div class="comments">${p.comments.map((c) => {
    const u = userById(c.u);
    return `<div class="msg"><b>${esc(u ? u.username : "?")}</b> <span class="dim small">${timeAgo(c.ts)}</span><br>${esc(c.text)}</div>`;
  }).join("") || `<p class="small dim">No comments yet.</p>`}
  <div class="row"><input id="cmt-${p.id}" class="grow" placeholder="Write a comment…" onkeydown="if(event.key==='Enter')R.comment('${p.id}')"><button class="btn small" onclick="R.comment('${p.id}')">Send</button></div></div>`;
}
// square artwork card for rails
function tCard(p, queueIds) {
  const a = userById(p.userId);
  const qArr = Array.isArray(queueIds) ? queueIds : String(queueIds || p.id).split(",").filter(Boolean);
  const q = (qArr.length ? qArr : [p.id]).join(",");
  return `<div class="tcard" onclick="R.playTrack('${p.id}','${q}')">${artHtml(p)}
    <b>${esc(p.title)}</b><span class="who">${esc(a ? a.username : "?")} · ${esc(p.genre)}</span>
    <span class="small" style="color:var(--cy)">▲ ${p.votes.filter((v) => v.v === 1).length}</span></div>`;
}
function creatorCard(u) {
  const posts = DB.posts.filter((p) => p.userId === u.id);
  const ups = posts.reduce((s, p) => s + p.votes.filter((v) => v.v === 1).length, 0);
  const following = (me().following || []).includes(u.id);
  return `<div class="tcard ccard">${ava(u.username)}
    <b style="cursor:pointer" onclick="event.stopPropagation();R.viewUser('${u.id}')">@${esc(u.username)}</b>
    <span class="who">${esc(u.domains.map((d) => DOMAIN_LABEL[d]).join(" · "))}</span>
    <span class="who">${esc(u.city)}, ${esc(u.state)}</span>
    <span class="small dim">${posts.length} tracks · ${ups} ▲ · ${followersOf(u.id)} followers</span>
    <div class="row" style="justify-content:center;margin-top:8px" onclick="event.stopPropagation()">
      <button class="chip" onclick="R.${following ? "unfollowUser" : "followUser"}('${u.id}')">${following ? "✓ Following" : "＋ Follow"}</button>
      <button class="chip" onclick="R.viewUser('${u.id}')">View</button>
    </div></div>`;
}

// ----- creator dashboard (default landing) -----
function dashView() {
  const u = me();
  const st = achievements(u);
  const rank = stateBoard(u.primary, u.state, Infinity).findIndex((r) => r.u.id === u.id) + 1;
  const comp = completion(u);
  const myPosts = DB.posts.filter((p) => p.userId === ME);
  const recent = myPosts.slice().sort((a, b) => b.createdAt - a.createdAt).slice(0, 8);
  const maxS = Math.max(1, ...recent.map((p) => Math.abs(postScore(p, Infinity))));
  const trend = trending(7 * DAY, 8);
  const trendIds = trend.map((p) => p.id).join(",");
  const liked = (u.favs || []).map(postById).filter(Boolean);
  const notifs = DB.notifications.filter((n) => n.userId === ME).sort((a, b) => b.ts - a.ts).slice(0, 3);
  const myProjects = DB.projects.filter((p) => p.members.some((m) => m.userId === ME));
  const pendingIn = DB.collabRequests.filter((r) => r.toId === ME && r.status === "pending").length;
  return `
  <div class="glass"><div class="welcome">
    ${ava(u.username)}
    <div class="grow"><h2 style="margin:0">Welcome back, ${esc(u.name.split(" ")[0])} ✨</h2>
    <p class="muted small" style="margin:2px 0">@${esc(u.username)} · ${esc(u.city)}, ${esc(u.state)} · ${esc(u.domains.map((d) => DOMAIN_LABEL[d]).join(" · "))}</p></div>
    <div class="ring" style="--p:${comp.pct}" title="${comp.steps.map((s) => (s[1] ? "✓ " : "○ ") + s[0]).join("\n")}"><span>${comp.pct}%</span></div>
  </div>
  <div class="row" style="margin-top:12px">
    <button class="btn small" onclick="R.openPostModal()">＋ Upload / Create</button>
    <button class="btn small ghost" onclick="R.nav('creators')">Find collaborators</button>
    <button class="btn small ghost" onclick="R.nav('boards')">My leaderboard rank</button>
  </div></div>

  <div class="statGrid">
    <div class="stat"><div class="n">${st.posts}</div><div class="l">Published work</div></div>
    <div class="stat"><div class="n">${st.ups}</div><div class="l">Upvotes received</div></div>
    <div class="stat"><div class="n">${st.collabs}</div><div class="l">Collabs completed</div></div>
    <div class="stat"><div class="n">${rank ? "#" + rank : "—"}</div><div class="l">${esc(u.state)} ${DOMAIN_LABEL[u.primary]}</div></div>
  </div>

  <div class="grid2">
    <div class="glass"><h3>📊 Engagement</h3>
      ${recent.length ? `<div class="bars">${recent.map((p) => `<i style="height:${Math.max(8, Math.abs(postScore(p, Infinity)) / maxS * 100)}%" title="${esc(p.title)}: ${postScore(p, Infinity)}"></i>`).join("")}</div>
      <p class="small dim">Net score of your latest ${recent.length} posts.</p>` : `<p class="muted small">Publish your first track to see engagement here.</p>`}
      ${st.badges.length ? `<div>${st.badges.map((b) => `<span class="badge hot">🏅 ${esc(b)}</span>`).join("")}</div>` : ""}
    </div>
    <div class="glass"><h3>🤝 Collaboration activity</h3>
      ${myProjects.length ? myProjects.slice(0, 3).map((p) => `<div class="small">🎵 <a onclick="R.openProject('${p.id}')">${esc(p.title)}</a> <span class="badge">${esc(p.status)}</span></div>`).join("") : `<p class="muted small">No projects yet.</p>`}
      ${pendingIn ? `<button class="chip" onclick="R.nav('collabs')">📥 ${pendingIn} incoming request${pendingIn > 1 ? "s" : ""} →</button>` : `<button class="chip" onclick="R.nav('creators')">Find someone to create with →</button>`}
    </div>
  </div>

  <div class="railTitle"><h3>🔥 Trending this week</h3><span class="grow"></span><a class="small" onclick="R.nav('home')">Open Discover →</a></div>
  <div class="rail">${trend.map((p) => tCard(p, trendIds)).join("") || `<p class="muted small">Nothing trending yet.</p>`}</div>

  <div class="grid2">
    <div><div class="railTitle"><h3>♥ Liked tracks</h3></div>
      ${liked.length ? liked.map((p) => trackRow(p, liked.map((x) => x.id), { expanded: EXPANDED === p.id })).join("") : `<div class="glass"><p class="muted small">Tap ♥ on any track or in the player to build your liked list.</p></div>`}</div>
    <div><div class="railTitle"><h3>🎧 Playlists</h3><span class="grow"></span><button class="chip" onclick="R.openPlaylistModal('')">＋ New</button></div>
      ${(u.playlists || []).map((pl) => `<div class="glass" style="margin:8px 0;padding:14px"><b>${esc(pl.name)}</b> <span class="small dim">${pl.postIds.length} tracks</span>
        <div class="row" style="margin-top:6px">${pl.postIds.length ? `<button class="chip" onclick="R.playPlaylist('${pl.id}')">▶ Play</button>` : ""}<button class="chip" onclick="R.openPickList('__pl_${pl.id}')">＋ Add current</button></div></div>`).join("") || `<div class="glass"><p class="muted small">No playlists yet — create one, then ＋ tracks into it.</p></div>`}
    </div>
  </div>

  <div class="glass"><h3>🔔 Recent alerts</h3>
    ${notifs.map((n) => `<div class="small"><span class="badge">${esc(n.kind)}</span> ${esc(n.text)} <span class="dim">· ${timeAgo(n.ts)}</span></div>`).join("") || `<p class="muted small">All quiet.</p>`}
  </div>`;
}

// ----- discover (home) -----
function homeView() {
  const feat = nationalBoard("singer", Infinity).concat(nationalBoard("beatmaker", Infinity), nationalBoard("lyricist", Infinity)).sort((a, b) => b.score - a.score).slice(0, 8);
  const seen = new Set(); const creators = feat.filter((r) => (seen.has(r.u.id) ? false : (seen.add(r.u.id), true))).slice(0, 6);
  const trend = trending(7 * DAY, 8); const trendIds = trend.map((p) => p.id).join(",");
  const fresh = DB.posts.slice().sort((a, b) => b.createdAt - a.createdAt).slice(0, 8);
  const freshIds = fresh.map((p) => p.id).join(",");
  let list = DB.posts.slice();
  if (F.domain) list = list.filter((p) => p.domain === F.domain);
  if (F.genre) list = list.filter((p) => p.genre === F.genre);
  list.sort((a, b) => F.sort === "top" ? postScore(b, Infinity) - postScore(a, Infinity) : b.createdAt - a.createdAt);
  const listIds = list.map((p) => p.id).join(",");
  return `
  <div class="railTitle"><h3>⭐ Featured creators</h3><span class="grow"></span><a class="small" onclick="R.nav('creators')">All creators →</a></div>
  <div class="rail">${creators.map((r) => creatorCard(r.u)).join("") || `<p class="muted small">No creators yet.</p>`}</div>

  <div class="railTitle"><h3>🔥 Trending tracks</h3></div>
  <div class="rail">${trend.map((p) => tCard(p, trendIds)).join("")}</div>

  <div class="railTitle"><h3>🆕 Latest uploads</h3></div>
  <div class="rail">${fresh.map((p) => tCard(p, freshIds)).join("")}</div>

  <div class="glass"><div class="row" style="justify-content:space-between">
    <h3 style="margin:0">🎵 All tracks</h3><button class="btn small" onclick="R.openPostModal()">＋ Upload / Create</button></div>
    <div class="row" style="margin-top:10px">
      <button class="pill ${!F.domain ? "on" : ""}" onclick="R.setF('domain','')">All</button>
      ${DOMAINS.map((d) => `<button class="pill ${F.domain === d ? "on" : ""}" onclick="R.setF('domain','${d}')">${DOMAIN_LABEL[d]}</button>`).join("")}
      <select style="max-width:150px" onchange="R.setF('genre',this.value)"><option value="">All genres</option>${GENRES.map((g) => `<option ${F.genre === g ? "selected" : ""}>${g}</option>`).join("")}</select>
      <select style="max-width:130px" onchange="R.setF('sort',this.value)"><option value="top" ${F.sort === "top" ? "selected" : ""}>Top rated</option><option value="new" ${F.sort === "new" ? "selected" : ""}>Newest</option></select>
    </div></div>
    ${list.map((p) => trackRow(p, listIds, { expanded: EXPANDED === p.id })).join("") || `<div class="glass"><p class="muted">No tracks yet — be the first!</p></div>`}`;
}

// ----- explore (advanced filters; top search lands here) -----
function exploreView() {
  const q = F.q.toLowerCase();
  let list = DB.posts.slice();
  if (q) list = list.filter((p) => (p.title + " " + (p.desc || "") + " " + (p.body || "") + " " + ((userById(p.userId) || {}).username || "")).toLowerCase().includes(q));
  if (F.domain) list = list.filter((p) => p.domain === F.domain);
  if (F.genre) list = list.filter((p) => p.genre === F.genre);
  if (F.lang) list = list.filter((p) => p.language === F.lang);
  if (F.state) list = list.filter((p) => (userById(p.userId) || {}).state === F.state);
  if (F.collab) list = list.filter((p) => p.collabOpen);
  list.sort((a, b) => postScore(b, Infinity) - postScore(a, Infinity));
  const listIds = list.map((p) => p.id).join(",");
  return `<div class="glass"><h3 style="margin-top:0">🔍 Explore${F.q ? ` — “${esc(F.q)}” (${list.length})` : ""}</h3>
    <div class="grid2">
      <div><label>Domain</label><select onchange="R.setF('domain',this.value)"><option value="">Any</option>${DOMAINS.map((d) => `<option value="${d}" ${F.domain === d ? "selected" : ""}>${DOMAIN_LABEL[d]}</option>`).join("")}</select></div>
      <div><label>State</label><select onchange="R.setF('state',this.value)"><option value="">Anywhere</option>${REGIONS.map((r) => `<option ${F.state === r ? "selected" : ""}>${r}</option>`).join("")}</select></div>
      <div><label>Genre</label><select onchange="R.setF('genre',this.value)"><option value="">Any</option>${GENRES.map((g) => `<option ${F.genre === g ? "selected" : ""}>${g}</option>`).join("")}</select></div>
      <div><label>Language</label><select onchange="R.setF('lang',this.value)"><option value="">Any</option>${LANGUAGES.map((l) => `<option ${F.lang === l ? "selected" : ""}>${l}</option>`).join("")}</select></div>
    </div>
    <label><input type="checkbox" style="width:auto" ${F.collab ? "checked" : ""} onchange="R.setF('collab',this.checked)"> Only open to collaboration</label>
    <p class="small dim">Try: Hindi romantic lyricists open to collab → domain Lyricist + language Hindi + ☑ collab.</p></div>
    ${list.map((p) => trackRow(p, listIds, { expanded: EXPANDED === p.id })).join("") || `<div class="glass"><p class="muted">Nothing matches those filters.</p></div>`}`;
}

// ----- explore creators -----
let CF = { q: "", domain: "" };
function creatorsView() {
  const q = CF.q.toLowerCase();
  let users = DB.users.filter((u) => !u.admin && !u.suspended && u.id !== ME);
  if (CF.domain) users = users.filter((u) => u.domains.includes(CF.domain));
  if (q) users = users.filter((u) => (u.username + " " + u.name + " " + (u.bio || "") + " " + u.city + " " + u.state).toLowerCase().includes(q));
  const score = (u) => u.domains.reduce((s, d) => s + userScore(u.id, d, Infinity), 0);
  users.sort((a, b) => score(b) - score(a));
  const feat = users.slice(0, 6);
  return `<div class="railTitle"><h3>⭐ Featured creators</h3></div>
  <div class="rail">${feat.map(creatorCard).join("") || `<p class="muted small">No creators yet.</p>`}</div>
  <div class="glass"><h3 style="margin-top:0">🎙 Explore creators</h3>
    <div class="row"><input id="cfQ" class="grow" placeholder="Name, city, vibe…" value="${esc(CF.q)}" oninput="R.setCF(this.value)">
    <select style="max-width:190px" onchange="R.setCFd(this.value)"><option value="">All domains</option>${DOMAINS.map((d) => `<option value="${d}" ${CF.domain === d ? "selected" : ""}>${DOMAIN_LABEL[d]}</option>`).join("")}</select></div>
    <p class="small dim">${users.length} creators · ranked by all-time track score.</p></div>
  <div class="rail" style="flex-wrap:wrap">${users.map(creatorCard).join("") || `<p class="muted small">No matches.</p>`}</div>`;
}

// ----- boards -----
function boardsView() {
  const w = PERIODS[B.period];
  const rows = B.scope === "national" ? nationalBoard(B.domain, w) : stateBoard(B.domain, B.scope === "mystate" ? myState() : B.state, w);
  const title = B.scope === "national" ? `National ${DOMAIN_LABEL[B.domain]} Championship` : `${B.scope === "mystate" ? myState() : B.state} · Top ${DOMAIN_LABEL[B.domain]}s`;
  return `<div class="glass"><h3 style="margin-top:0">🏆 Leaderboards</h3>
    <div class="grid2">
      <div><label>Domain (never mixed)</label><select onchange="R.setB('domain',this.value)">${DOMAINS.map((d) => `<option value="${d}" ${B.domain === d ? "selected" : ""}>${DOMAIN_LABEL[d]}</option>`).join("")}</select></div>
      <div><label>Period</label><select onchange="R.setB('period',this.value)">${Object.keys(PERIODS).map((k) => `<option value="${k}" ${B.period === k ? "selected" : ""}>${PERIOD_LABEL[k]}</option>`).join("")}</select></div>
      <div><label>Scope</label><select onchange="R.setB('scope',this.value)">
        <option value="mystate" ${B.scope === "mystate" ? "selected" : ""}>My state (${esc(myState())})</option>
        <option value="state" ${B.scope === "state" ? "selected" : ""}>Pick a state…</option>
        <option value="national" ${B.scope === "national" ? "selected" : ""}>National finals (top 3 per state)</option>
      </select></div>
      ${B.scope === "state" ? `<div><label>State</label><select onchange="R.setB('state',this.value)">${REGIONS.map((r) => `<option ${B.state === r ? "selected" : ""}>${r}</option>`).join("")}</select></div>` : ""}
    </div>
    <p class="small dim">Score = upvotes − downvotes on that artist's ${DOMAIN_LABEL[B.domain].toLowerCase()} posts, counting only votes cast in the selected period. One vote per user per post, no self-votes.</p></div>
    <div class="glass"><h3 style="margin-top:0">${esc(title)} · ${PERIOD_LABEL[B.period]}</h3>
    ${rows.length ? `
    <div class="podium">${rows.slice(0, 3).map((r, i) => `<div class="pod ${i === 0 ? "first" : ""}">
      <div class="medal">${i === 0 ? "🥇" : i === 1 ? "🥈" : "🥉"}</div>
      ${ava(r.u.username)}<b><a onclick="R.viewUser('${r.u.id}')">${esc(r.u.username)}</a>${r.u.id === ME ? " (you)" : ""}</b>
      <span class="small dim">${esc(B.scope === "national" ? r.fromState : r.u.city)}</span>
      <div class="sc">${r.score}</div>
      ${B.scope !== "national" ? `<span class="badge hot">national qualifier</span>` : ""}
    </div>`).join("")}</div>
    <table><tr><th>#</th><th>Artist</th><th>${B.scope === "national" ? "Qualified from" : "City"}</th><th>Score</th></tr>
      ${rows.slice(0, 20).map((r, i) => `<tr><td>${i + 1}</td>
      <td><a onclick="R.viewUser('${r.u.id}')">${esc(r.u.username)}</a>${r.u.id === ME ? " (you)" : ""}</td>
      <td>${esc(B.scope === "national" ? r.fromState : r.u.city)}</td><td><b>${r.score}</b></td></tr>`).join("")}</table>` : `<p class="muted">Not enough activity yet — be the first to post and get voted!</p>`}
    </div>`;
}

// ----- collabs -----
function collabsView() {
  if (VIEW_PROJECT) return projectView(VIEW_PROJECT);
  const incoming = DB.collabRequests.filter((r) => r.toId === ME && r.status === "pending");
  const outgoing = DB.collabRequests.filter((r) => r.fromId === ME);
  const mine = DB.projects.filter((p) => p.members.some((m) => m.userId === ME));
  const reqRow = (r) => {
    const f = userById(r.fromId), t = userById(r.toId), p = postById(r.postId), att = r.attachPostId ? postById(r.attachPostId) : null;
    return `<div class="post"><div class="small"><b>${esc(f ? f.username : "?")}</b> → <b>${esc(t ? t.username : "?")}</b> · re: <b>${esc(p ? p.title : "—")}</b> · <span class="badge">${esc(r.role)}</span> <span class="badge">${esc(r.status)}</span></div>
      <p class="small" style="margin:6px 0">“${esc(r.message)}”<br><span class="dim">Why: ${esc(r.reason || "—")}</span></p>
      ${att ? `<p class="small">📎 attached sample: <b>${esc(att.title)}</b> (${DOMAIN_LABEL[att.domain]})</p>` : ""}
      ${r.toId === ME && r.status === "pending" ? `<div class="row"><button class="btn small" onclick="R.acceptReq('${r.id}')">Accept</button><button class="btn small danger" onclick="R.rejectReq('${r.id}')">Reject</button></div>` : ""}
    </div>`;
  };
  return `${incoming.length ? `<div class="card"><h3 style="margin-top:0">📥 Incoming requests (${incoming.length})</h3>${incoming.map(reqRow).join("")}</div>` : ""}
    ${mine.length ? `<div class="card"><h3 style="margin-top:0">🎵 My projects</h3>${mine.map((p) => `<div class="post"><b>${esc(p.title)}</b> <span class="badge">${esc(p.status)}</span><div class="small dim">${p.members.map((m) => esc((userById(m.userId) || {}).username || "?") + " (" + esc(m.role) + ")").join(" · ")}</div><div class="row" style="margin-top:6px"><button class="chip" onclick="R.openProject('${p.id}')">Open workspace →</button></div></div>`).join("")}</div>` : ""}
    ${outgoing.length ? `<div class="card"><h3 style="margin-top:0">📤 Sent requests</h3>${outgoing.map(reqRow).join("")}</div>` : ""}
    ${!incoming.length && !mine.length && !outgoing.length ? `<div class="card"><p class="muted">No collaborations yet. Find a post you love on Home or Explore and hit <b>🤝 Collaborate</b> — attach one of your own works as a sample.</p></div>` : ""}`;
}

function projectView(id) {
  const p = DB.projects.find((x) => x.id === id);
  if (!p) { VIEW_PROJECT = null; return collabsView(); }
  const done = p.status === "completed";
  return `<button class="btn small ghost" onclick="R.openProject(null)">← All collaborations</button>
    <div class="card"><h2 style="margin:0">${esc(p.title)}</h2>
    <p class="muted small">${esc(p.desc || "")}</p>
    <div>${p.members.map((m) => { const u = userById(m.userId); return `<span class="badge">${esc(u ? u.username : "?")} · ${esc(m.role)}</span>`; }).join("")} <span class="badge ${done ? "green" : "pink"}">${esc(p.status)}</span></div>
    ${p.updates.length ? `<p class="small dim">📌 ${p.updates.map(esc).join(" → ")}</p>` : ""}</div>
    <div class="grid2">
      <div class="card"><h3 style="margin-top:0">💬 Project chat</h3><div class="chatBox">
        ${p.chat.map((c) => { const u = userById(c.userId); return `<div class="msg ${c.userId === ME ? "me" : ""}"><b>${esc(u ? u.username : "?")}</b> <span class="dim small">${timeAgo(c.ts)}</span><br>${esc(c.text)}</div>`; }).join("") || `<p class="small dim">Say hello…</p>`}</div>
        ${done ? "" : `<div class="row"><input id="wsChatInput" class="grow" placeholder="Message the team…"><button class="btn small" onclick="R.sendChat('${p.id}')">Send</button></div>`}</div>
      <div class="card"><h3 style="margin-top:0">📁 Shared files</h3>
        ${p.files.map((f) => { const u = userById(f.userId); return `<div class="small">📄 <b>${esc(f.name)}</b> <span class="dim">· ${esc(u ? u.username : "?")} · ${timeAgo(f.ts)}</span></div>`; }).join("") || `<p class="small dim">No files yet.</p>`}
        ${done ? "" : `<div class="row" style="margin-top:8px"><input id="wsFileInput" class="grow" placeholder="File name, e.g. chorus-take2.mp3"><button class="btn small ghost" onclick="R.addFile('${p.id}')">+ Add</button></div>
        <label>Attach one of your posts</label><div class="row"><select id="wsAttachSel" class="grow">${DB.posts.filter((x) => x.userId === ME).map((x) => `<option value="${x.id}">${esc(x.title)} (${DOMAIN_LABEL[x.domain]})</option>`).join("") || "<option value=''>No posts yet</option>"}</select><button class="btn small ghost" onclick="R.attachPost('${p.id}')">Attach</button></div>`}
      </div>
    </div>
    ${done ? `<div class="card"><p class="muted">✅ Completed${p.jointPostId ? ` — published as a <a onclick="R.go('home')">joint post</a>.` : "."} Great work!</p></div>` : `
    <div class="card"><div class="row"><label style="margin:0">Status</label>
      <select id="wsStatusSel" style="max-width:200px" onchange="R.setStatus('${p.id}',this.value)">${["in-progress", "awaiting-review", "completed", "cancelled"].map((s) => `<option ${p.status === s ? "selected" : ""}>${s}</option>`).join("")}</select>
      <button class="btn small" onclick="R.completeProject('${p.id}')">Mark completed & publish joint post</button></div>
      <p class="small dim">Completing publishes one joint post crediting every member (needs no further clicks) and adds to everyone's collab history. Commercial release = agree your ownership split first (lyrics ≠ composition ≠ recording).</p></div>`}`;
}

// ----- auctions -----
function auctionsView() {
  if (VIEW_AUCTION) return auctionDetail(VIEW_AUCTION);
  const live = DB.auctions.filter((a) => a.status === "live").sort((a, b) => (topBid(b)?.amount || b.startPrice) - (topBid(a)?.amount || a.startPrice));
  const past = DB.auctions.filter((a) => a.status !== "live");
  const card = (a) => {
    const s = userById(a.sellerId), p = postById(a.postId), top = topBid(a);
    return `<div class="post"><b>${esc(a.title)}</b> <span class="badge">${esc(a.rights)}</span>
      <div class="pmeta">by ${esc(s ? s.username : "?")} · ${a.bids.length} bids · <span class="timer" data-ends="${a.endsAt}">…</span></div>
      <p class="small muted" style="margin:4px 0">${esc(a.desc)}</p>
      <div class="row"><span class="badge ${top ? "gold" : ""}">${top ? `₹${top.amount} highest` : `starts ₹${a.startPrice}`}</span>
      <button class="chip" onclick="R.openAuction('${a.id}')">View & bid →</button></div></div>`;
  };
  return `<div class="card"><h3 style="margin-top:0">🔨 Auction billboard</h3>
    <p class="small dim">List lyrics, beats & compositions. Highest valid bid at close wins a documented license. Platform fee: ${DB.commissionPct}% (configurable). To list: open one of your eligible posts → 🔨 Auction.</p>
    <h4>🔥 Highest bidding</h4>${live.map(card).join("") || `<p class="muted">No live auctions.</p>`}
    ${past.length ? `<h4>Finished</h4>${past.map(card).join("")}` : ""}</div>`;
}
function auctionDetail(id) {
  const a = DB.auctions.find((x) => x.id === id);
  if (!a) { VIEW_AUCTION = null; return auctionsView(); }
  const s = userById(a.sellerId), p = postById(a.postId), top = topBid(a);
  const tx = DB.transactions.find((t) => t.auctionId === a.id);
  return `<button class="btn small ghost" onclick="R.openAuction(null)">← All auctions</button>
  <div class="card"><h2 style="margin:0">${esc(a.title)}</h2>
    <p class="small dim">by ${esc(s ? s.username : "?")} · ${esc(a.rights)} · status: <b>${esc(a.status)}</b></p>
    <p>${esc(a.desc)}</p>
    ${p ? `<p class="small">Linked work: <b>${esc(p.title)}</b> (${DOMAIN_LABEL[p.domain]})</p>` : ""}
    <p class="small">📜 Ownership: ${esc(a.ownership)}</p>
    <div class="row"><span class="badge">Start ₹${a.startPrice}</span>${a.reservePrice ? `<span class="badge">Reserve ₹${a.reservePrice}</span>` : ""}<span class="badge">Min step ₹${a.minInc}</span><span class="badge gold timer" data-ends="${a.endsAt}">…</span></div>
    <h3>Current: ${top ? `₹${top.amount} by ${esc((userById(top.userId) || {}).username)}` : `₹${a.startPrice} (no bids)`}</h3>
    ${a.status === "live" && a.sellerId !== ME ? `<div class="row"><input id="bidInput" type="number" class="grow" style="max-width:200px" placeholder="Min ₹${(top ? top.amount : a.startPrice) + a.minInc}"><button class="btn" onclick="R.bid('${a.id}')">Place bid</button></div>` : ""}
    ${tx ? `<p class="small">💰 Settled: buyer <b>${esc((userById(tx.buyerId) || {}).username)}</b> paid ₹${tx.amount} (platform fee ₹${tx.fee}). Files + license transferred per “${esc(a.rights)}”.</p>` : ""}
    <h4>Bid history (${a.bids.length})</h4>
    ${a.bids.slice().sort((x, y) => y.amount - x.amount).map((b) => `<div class="small">₹${b.amount} — <b>${esc((userById(b.userId) || {}).username)}</b> <span class="dim">${timeAgo(b.ts)}</span></div>`).join("") || `<p class="small dim">No bids yet.</p>`}
  </div>`;
}

// ----- messages -----
function msgsView() {
  const threads = DB.threads.filter((t) => t.members.includes(ME));
  if (VIEW_THREAD) {
    const t = DB.threads.find((x) => x.id === VIEW_THREAD);
    if (!t) VIEW_THREAD = null;
    else {
      const other = userById(t.members.find((m) => m !== ME));
      return `<button class="btn small ghost" onclick="R.openThread(null)">← All chats</button>
      <div class="card"><h3 style="margin-top:0">💬 ${esc(other ? other.username : "?")}</h3><div class="chatBox" style="max-height:340px">
      ${t.messages.map((m) => { const u = userById(m.userId); return `<div class="msg ${m.userId === ME ? "me" : ""}"><b>${esc(u ? u.username : "?")}</b> <span class="dim small">${timeAgo(m.ts)}</span><br>${esc(m.text)}</div>`; }).join("")}</div>
      <div class="row"><input id="dmInput" class="grow" placeholder="Message…"><button class="btn small" onclick="R.sendDM('${t.id}')">Send</button></div></div>`;
    }
  }
  return `<div class="card"><h3 style="margin-top:0">💬 Messages</h3>
    ${threads.map((t) => { const o = userById(t.members.find((m) => m !== ME)); const last = t.messages[t.messages.length - 1];
      return `<div class="post"><div class="row">${ava(o ? o.username : "?")}<b>${esc(o ? o.username : "?")}</b><span class="grow"></span><button class="chip" onclick="R.openThread('${t.id}')">Open →</button></div>
      <p class="small dim" style="margin:4px 0">${last ? esc(last.text).slice(0, 90) + " · " + timeAgo(last.ts) : "No messages"}</p></div>`; }).join("") || `<p class="muted">No chats. Accept a collaboration or message someone from their profile.</p>`}
  </div>`;
}

// ----- notifications -----
function notifsView() {
  const list = DB.notifications.filter((n) => n.userId === ME).sort((a, b) => b.ts - a.ts);
  return `<div class="card"><div class="row"><h3 style="margin:0">🔔 Alerts</h3><span class="grow"></span><button class="btn small ghost" onclick="R.markRead()">Mark all read</button></div>
  ${list.map((n) => `<div class="post" style="${n.read ? "opacity:.65" : ""}"><span class="badge">${esc(n.kind)}</span> ${esc(n.text)}<div class="small dim">${timeAgo(n.ts)}</div></div>`).join("") || `<p class="muted">All quiet. Post something worth applauding.</p>`}</div>`;
}

// ----- profile -----
function achievements(u) {
  const posts = DB.posts.filter((p) => p.userId === u.id);
  const ups = posts.reduce((s, p) => s + p.votes.filter((v) => v.v === 1).length, 0);
  const collabs = DB.projects.filter((p) => p.members.some((m) => m.userId === u.id) && p.status === "completed").length;
  const b = [];
  if (posts.length >= 5) b.push("Prolific creator");
  if (ups >= 20) b.push("Crowd favourite");
  if (collabs >= 1) b.push("Collaborator");
  if (collabs >= 3) b.push("Team player");
  return { posts: posts.length, ups, collabs, badges: b };
}
function profileView() {
  const u = VIEW_USER ? userById(VIEW_USER) : me();
  if (!u) { VIEW_USER = null; return profileView(); }
  const mine = u.id === ME;
  const st = achievements(u);
  const rank = stateBoard(u.primary, u.state, Infinity).findIndex((r) => r.u.id === u.id) + 1;
  const sales = DB.transactions.filter((t) => t.sellerId === u.id);
  const listings = DB.auctions.filter((a) => a.sellerId === u.id);
  const ups = DB.posts.filter((p) => p.userId === u.id);
  const upsIds = ups.map((p) => p.id).join(",");
  const following = (me().following || []).includes(u.id);
  const latestOpen = ups.filter((p) => p.collabOpen).sort((a, b) => b.createdAt - a.createdAt)[0];
  return `${mine ? "" : `<button class="btn small ghost" onclick="R.viewUser(null)">← My profile</button>`}
  <div class="glass">
    <div class="cover" style="${artStyle(u.username + "cover")}"></div>
    <div class="pfHead">${ava(u.username)}
      <div class="grow"><h2 style="margin:0">@${esc(u.username)}</h2>
      <div class="small dim">${esc(u.name)} · ${esc(u.city)}, ${esc(u.state)}</div></div>
      ${mine ? "" : `<button class="btn small ${following ? "ghost" : ""}" onclick="R.${following ? "unfollowUser" : "followUser"}('${u.id}',true)">${following ? "✓ Following" : "＋ Follow"}</button>
      <button class="btn small ghost" onclick="R.contactUser('${u.id}')">💬 Message</button>
      ${latestOpen ? `<button class="btn small" onclick="R.openCollab('${latestOpen.id}')">🤝 Collaborate</button>` : ""}`}
    </div>
    <p class="muted">${esc(u.bio || "")}</p>
    <div>${u.domains.map((d) => `<span class="badge ${d === u.primary ? "hot" : ""}">${DOMAIN_LABEL[d]}${d === u.primary ? " ★ primary" : ""}</span>`).join("")}</div>
    <div class="statGrid" style="grid-template-columns:repeat(4,1fr)">
      <div class="stat"><div class="n">${st.posts}</div><div class="l">tracks</div></div>
      <div class="stat"><div class="n">${st.ups}</div><div class="l">upvotes</div></div>
      <div class="stat"><div class="n">${followersOf(u.id)}</div><div class="l">followers</div></div>
      <div class="stat"><div class="n">${rank ? "#" + rank : "—"}</div><div class="l">${DOMAIN_LABEL[u.primary]} rank</div></div>
    </div>
    ${st.badges.length ? `<div>${st.badges.map((b) => `<span class="badge hot">🏅 ${esc(b)}</span>`).join("")}</div>` : ""}
    ${mine ? `<div class="glass" style="margin:12px 0 0"><h3 style="margin-top:0">⚙ Profile & settings</h3>
      <label>Bio</label><div class="row"><input id="bioInput" class="grow" value="${esc(u.bio || "")}"><button class="btn small" onclick="R.saveBio()">Save</button></div>
      <p class="small dim">Sales: ${sales.length} · Revenue: ₹${sales.reduce((s, t) => s + t.amount - t.fee, 0)} · Active listings: ${listings.filter((a) => a.status === "live").length}</p>
      <div class="row"><button class="btn small ghost" onclick="R.resetDemo()">↺ Reset demo data</button><button class="btn small danger" onclick="R.deleteAccount()">Delete my account</button></div>
      <p class="small dim">Demo honesty note: all data lives in this browser's localStorage only — nothing is shared with other users or devices.</p></div>` : ""}
  </div>
  <div class="railTitle"><h3>🎵 Portfolio (${ups.length})</h3></div>
  ${ups.sort((a, b) => b.createdAt - a.createdAt).map((p) => trackRow(p, upsIds, { expanded: EXPANDED === p.id })).join("") || `<div class="glass"><p class="muted">Nothing published yet.</p></div>`}`;
}

// ----- admin -----
function adminView() {
  const m = me();
  if (!m.admin) return `<div class="card"><p>Not authorized.</p></div>`;
  const fraud = DB.users.map((u) => {
    const vs = [];
    DB.posts.forEach((p) => p.votes.forEach((v) => { if (v.u === u.id) vs.push(v.ts); }));
    vs.sort((a, b) => a - b);
    let burst = 0;
    for (let i = 0; i < vs.length; i++) { let c = 0; for (let j = i; j < vs.length && vs[j] - vs[i] < 3600000; j++) c++; burst = Math.max(burst, c); }
    return { u, total: vs.length, burst };
  }).filter((x) => x.burst >= 8);
  return `<div class="card"><h3 style="margin-top:0">🛡 Admin dashboard</h3>
    <div class="row"><span class="badge">Users: ${DB.users.length}</span><span class="badge">Posts: ${DB.posts.length}</span><span class="badge">Live auctions: ${DB.auctions.filter((a) => a.status === "live").length}</span><span class="badge">Volume: ₹${DB.transactions.reduce((s, t) => s + t.amount, 0)}</span>
    <span class="grow"></span><label style="margin:0">Commission %</label><input id="commInput" type="number" value="${DB.commissionPct}" style="max-width:80px"><button class="btn small" onclick="R.setComm()">Set</button></div></div>
  <div class="card"><h4>Users</h4><table><tr><th>User</th><th>State</th><th>Posts</th><th>Status</th><th></th></tr>
    ${DB.users.map((u) => `<tr><td>${esc(u.username)}${u.admin ? " (admin)" : ""}</td><td>${esc(u.state)}</td><td>${DB.posts.filter((p) => p.userId === u.id).length}</td><td>${u.suspended ? "suspended" : "active"}</td><td>${!u.admin ? `<button class="chip" onclick="R.suspendUser('${u.id}')">${u.suspended ? "Unsuspend" : "Suspend"}</button>` : ""}</td></tr>`).join("")}</table></div>
  <div class="card"><h4>⚑ Reports (${DB.reports.filter((r) => r.status === "open").length} open)</h4>
    ${DB.reports.slice().reverse().map((r) => { const p = postById(r.postId); return `<div class="small">⚑ <b>${esc(p ? p.title : "deleted post")}</b> reported by ${esc((userById(r.by) || {}).username)} · “${esc(r.reason)}” [${r.status}] ${r.status === "open" ? `<button class="chip" onclick="R.resolveReport('${r.id}','dismiss')">Dismiss</button> <button class="chip" onclick="R.resolveReport('${r.id}','remove')">Remove post</button>` : ""}</div>`; }).join("") || `<p class="small dim">No reports.</p>`}</div>
  <div class="card"><h4>Vote-fraud flags (≥8 votes in an hour)</h4>${fraud.map((f) => `<div class="small">🚩 ${esc(f.u.username)} — ${f.total} total votes, burst ${f.burst}/hr</div>`).join("") || `<p class="small dim">None.</p>`}</div>`;
}

// ----- modal -----
function modalHtml() {
  if (!MODAL) return "";
  let inner = "";
  if (MODAL.kind === "post") {
    inner = `<h3 style="margin-top:0">＋ Create post</h3>
      <label>Your domain for this post</label><select id="npDom">${me().domains.map((d) => `<option value="${d}">${DOMAIN_LABEL[d]}</option>`).join("")}</select>
      <label>Title</label><input id="npTitle" placeholder="e.g. Midnight Drive">
      <label>Description</label><input id="npDesc" placeholder="What is this? Who do you want to work with?">
      <div class="grid2"><div><label>Genre</label><select id="npGenre">${GENRES.map((g) => `<option>${g}</option>`).join("")}</select></div>
      <div><label>Language</label><select id="npLang">${LANGUAGES.map((l) => `<option>${l}</option>`).join("")}</select></div></div>
      <div id="npLyricWrap"><label>Lyrics / text</label><textarea id="npBody" placeholder="Paste your lyrics, verse, hook…"></textarea></div>
      <div class="grid2"><div><label>BPM (beats)</label><input id="npBpm" type="number" placeholder="e.g. 140"></div>
      <div><label>Key (beats)</label><input id="npKey" placeholder="e.g. D minor"></div></div>
      <div><label>Instrument (instrumentalists)</label><input id="npInst" placeholder="e.g. Guitar"></div>
      <label>Tags (comma separated)</label><input id="npTags" placeholder="sad, hook, demo">
      <label><input type="checkbox" id="npCollab" style="width:auto" checked> Available for collaboration</label>
      <label><input type="checkbox" id="npAuc" style="width:auto" checked> Eligible for auction / licensing later</label>
      <div class="row" style="margin-top:12px"><button class="btn" onclick="R.createPost()">Publish</button><button class="btn ghost" onclick="R.closeModal()">Cancel</button></div>`;
  } else if (MODAL.kind === "collab") {
    const p = postById(MODAL.postId);
    const mine = DB.posts.filter((x) => x.userId === ME);
    inner = `<h3 style="margin-top:0">🤝 Request collaboration</h3>
      <p class="small muted">To: <b>${esc((userById(p.userId) || {}).username)}</b> · Re: <b>${esc(p.title)}</b></p>
      <label>Message</label><input id="crMsg" placeholder="I really like your work…">
      <label>Why do you want to collaborate?</label><input id="crReason" placeholder="e.g. my piano fits these lyrics">
      <label>Your proposed role</label><select id="crRole">${me().domains.map((d) => `<option value="${DOMAIN_LABEL[d]}">${DOMAIN_LABEL[d]}</option>`).join("")}</select>
      <label>Attach a sample of your work (required — show, don't just tell)</label>
      <select id="crAttach">${mine.map((x) => `<option value="${x.id}">${esc(x.title)} (${DOMAIN_LABEL[x.domain]})</option>`).join("") || "<option value=''>You have no posts yet — publish one first</option>"}</select>
      <div class="row" style="margin-top:12px"><button class="btn" onclick="R.sendRequest('${p.id}')">Send request</button><button class="btn ghost" onclick="R.closeModal()">Cancel</button></div>`;
  } else if (MODAL.kind === "auction") {
    inner = `<h3 style="margin-top:0">🔨 Create auction</h3>
      <label>Auction title</label><input id="acTitle" value="${esc(MODAL.title || "")}">
      <label>Description</label><input id="acDesc" placeholder="Stems included? Credit terms?">
      <div class="grid2"><div><label>Starting price (₹)</label><input id="acStart" type="number" value="500"></div>
      <div><label>Reserve price (₹, 0 = none)</label><input id="acReserve" type="number" value="0"></div></div>
      <div class="grid2"><div><label>Duration (hours)</label><input id="acDur" type="number" value="72"></div>
      <div><label>Rights offered</label><select id="acRights"><option>Exclusive ownership</option><option>Non-exclusive license</option><option>Limited lease (1 yr)</option></select></div></div>
      <label>Ownership declaration</label><input id="acOwn" placeholder="e.g. 100% original, I own all rights">
      <div class="row" style="margin-top:12px"><button class="btn" onclick="R.createAuction('${MODAL.postId}')">Start auction</button><button class="btn ghost" onclick="R.closeModal()">Cancel</button></div>`;
  } else if (MODAL.kind === "playlist") {
    inner = `<h3 style="margin-top:0">🎧 New playlist</h3>
      <label>Playlist name</label><input id="plName" placeholder="e.g. Late night writing">
      ${MODAL.seed && !MODAL.seed.startsWith("__") ? `<p class="small dim">Will start with: <b>${esc((postById(MODAL.seed) || {}).title || "")}</b></p>` : ""}
      <div class="row" style="margin-top:12px"><button class="btn" onclick="R.createPlaylist()">Create</button><button class="btn ghost" onclick="R.closeModal()">Cancel</button></div>`;
  } else if (MODAL.kind === "picklist") {
    const target = MODAL.target === "__current" ? QUEUE[QIDX] : MODAL.target;
    inner = `<h3 style="margin-top:0">＋ Add to playlist</h3>
      <p class="small dim">Adding: <b>${esc((postById(target) || {}).title || "current track")}</b></p>
      ${(me().playlists || []).map((pl) => `<div class="row" style="margin:6px 0"><b class="grow">${esc(pl.name)}</b><span class="small dim">${pl.postIds.length} tracks</span><button class="chip" onclick="R.addToPlaylist('${pl.id}')">＋ Add</button></div>`).join("")}
      <div class="row" style="margin-top:12px"><button class="btn ghost" onclick="R.openPlaylistModal('${esc(MODAL.target || "")}')">＋ New playlist</button><button class="btn ghost" onclick="R.closeModal()">Cancel</button></div>`;
  } else if (MODAL.kind === "report") {
    inner = `<h3 style="margin-top:0">⚑ Report post</h3>
      <label>Reason</label><select id="repReason"><option>Copyright / plagiarism</option><option>Offensive content</option><option>Spam / scam</option><option>Other</option></select>
      <div class="row" style="margin-top:12px"><button class="btn" onclick="R.sendReport('${MODAL.postId}')">Submit report</button><button class="btn ghost" onclick="R.closeModal()">Cancel</button></div>`;
  }
  return `<div class="modal" onclick="if(event.target===this)R.closeModal()"><div class="modalBox">${inner}</div></div>`;
}

// ============================ ACTIONS ============================
function needAuth() { if (me() && me().suspended) { toast("Account suspended."); return true; } return false; }

export function setAuth(m) { AUTH_MODE = m; SIGNUP_DOMAINS = ["lyricist"]; render(); }
export function fakeRecovery() { toast("Demo: passwords can't be emailed. Use rahul@demo.in / demo."); }
export function toggleDom(d) {
  const i = SIGNUP_DOMAINS.indexOf(d);
  if (i >= 0) { if (SIGNUP_DOMAINS.length > 1) SIGNUP_DOMAINS.splice(i, 1); }
  else SIGNUP_DOMAINS.push(d);
  document.querySelectorAll(".domPick label").forEach((l) => l.classList.toggle("sel", SIGNUP_DOMAINS.includes(l.dataset.dom)));
  const ps = document.getElementById("suPrimaryInput");
  if (ps) ps.innerHTML = SIGNUP_DOMAINS.map((x) => `<option value="${x}">${DOMAIN_LABEL[x]}</option>`).join("");
}

export async function signup() {
  const v = (id) => document.getElementById(id).value.trim();
  const name = v("suNameInput"), username = v("suUserInput"), email = v("suEmailInput");
  const p1 = document.getElementById("suPassInput").value, p2 = document.getElementById("suPass2Input").value;
  if (!name || !username || !email || !p1) return toast("Fill all required fields.");
  if (p1 !== p2) return toast("Passwords don't match.");
  if (p1.length < 8) return toast("Password must be at least 8 characters.");
  if (DB.users.some((u) => u.username.toLowerCase() === username.toLowerCase())) return toast("Username taken.");
  if (DB.users.some((u) => u.email.toLowerCase() === email.toLowerCase())) return toast("Email already registered.");
  const primary = document.getElementById("suPrimaryInput").value;
  const u = { id: uid("u"), name, username, email, pass: await sha256(p1), pic: "", dob: v("suDobInput"), state: v("suStateInput"), city: v("suCityInput") || "—", bio: v("suBioInput"), domains: SIGNUP_DOMAINS.slice(), primary, suspended: false, admin: false, createdAt: Date.now() };
  DB.users.push(u); save();
  ME = u.id; setSession(ME); TAB = "dash";
  notify(ME, "Welcome to RHYTHM! Publish your first post to enter your state leaderboard.", "info"); save();
  render(); toast(`Welcome, ${username}!`);
}

const LOCK_KEY = "rhythm_login_lock_v1";
function lockInfo() { try { return JSON.parse(localStorage.getItem(LOCK_KEY)) || { fails: 0, until: 0 }; } catch (e) { return { fails: 0, until: 0 }; } }
function setLock(o) { localStorage.setItem(LOCK_KEY, JSON.stringify(o)); }

export async function login() {
  const lock = lockInfo();
  if (Date.now() < lock.until) return toast(`Too many attempts. Try again in ${Math.ceil((lock.until - Date.now()) / 1000)}s.`);
  const id = document.getElementById("liIdInput").value.trim().toLowerCase();
  const pw = await sha256(document.getElementById("liPassInput").value);
  const u = DB.users.find((x) => (x.email.toLowerCase() === id || x.username.toLowerCase() === id) && x.pass === pw);
  if (!u) {
    const f = lockInfo();
    f.fails++;
    if (f.fails >= 5) { f.until = Date.now() + 60000; f.fails = 0; toast("Too many failed attempts. Locked for 60s."); }
    else toast(`Invalid credentials. (${5 - f.fails} attempts left)`);
    setLock(f);
    return;
  }
  if (u.suspended) return toast("This account is suspended. Contact an admin.");
  setLock({ fails: 0, until: 0 });
  ME = u.id; setSession(ME); TAB = "dash"; VIEW_USER = null; VIEW_PROJECT = null; VIEW_AUCTION = null;
  render(); toast(`Welcome back, ${u.username}!`);
}
export function logout() { stopPreview(); QUEUE = []; QIDX = -1; ME = null; setSession(null); TAB = "dash"; render(); }
export function resetDemo() { stopPreview(); QUEUE = []; QIDX = -1; wipeDB(); ME = null; setSession(null); boot(); }

export function go(t, skipHash) { if (t === "__signin") { TAB = "home"; EXPANDED = null; render(); setHash(""); return; } TAB = t; if (t !== "collabs") VIEW_PROJECT = null; if (t !== "auctions") VIEW_AUCTION = null; if (t !== "msgs") VIEW_THREAD = null; if (t !== "profile") VIEW_USER = null; EXPANDED = null; render(); if (!skipHash) setHash("#/" + t); }
export function nav(k) { if (k === "__create") { openPostModal(); return; } go(k); }
export function topSearch(v) {
  F.q = v; TAB = "explore"; EXPANDED = null; render();
  const el = document.getElementById("topSearch");
  if (el) { el.focus(); el.setSelectionRange(el.value.length, el.value.length); }
}
export function setCF(v) {
  CF.q = v; render();
  const el = document.getElementById("cfQ");
  if (el) { el.focus(); el.setSelectionRange(v.length, v.length); }
}
export function setCFd(v) { CF.domain = v; render(); }
export function setF(k, val) { F[k] = val; EXPANDED = null; render(); }
export function setB(k, val) { B[k] = val; if (k === "scope" && val === "state" && !B.state) B.state = myState(); render(); }
export function viewUser(id) { VIEW_USER = id === ME ? null : id; TAB = "profile"; EXPANDED = null; render(); }
export function toggleExpand(id) { EXPANDED = EXPANDED === id ? null : id; render(); }
export function closeModal() { MODAL = null; render(); }
export function openPostModal() { if (needAuth()) return; MODAL = { kind: "post" }; render(); }
export function openCollab(postId) { if (needAuth()) return; MODAL = { kind: "collab", postId }; render(); }
export function openAuctionCreate(postId) { const p = postById(postId); MODAL = { kind: "auction", postId, title: p.title + " — rights for sale" }; render(); }
export function openReport(postId) { MODAL = { kind: "report", postId }; render(); }
export function openProject(id) { VIEW_PROJECT = id; render(); }
export function openAuction(id) { VIEW_AUCTION = id; render(); }
export function openThread(id) { VIEW_THREAD = id; render(); }

export function playTrack(postId, queueStr) {
  const ids = String(queueStr || postId).split(",").filter(Boolean);
  QUEUE = ids.length ? ids : [postId];
  QIDX = Math.max(0, QUEUE.indexOf(postId));
  const p = postById(postId);
  if (!p) return;
  const r = togglePreview(p);
  render(true);
  toast(r === "playing" ? "🔊 Playing synthesized demo preview…" : "⏹ Stopped.");
}
export function togglePlay() {
  if (currentTrack()) { stopPreview(); render(true); return; }
  if (QIDX >= 0 && postById(QUEUE[QIDX])) { togglePreview(postById(QUEUE[QIDX])); render(true); }
}
export function nextTrack() {
  if (!QUEUE.length) return;
  QIDX = (QIDX + 1) % QUEUE.length;
  const p = postById(QUEUE[QIDX]);
  if (p) { stopPreview(); togglePreview(p); }
  render(true);
}
export function prevTrack() {
  if (!QUEUE.length) return;
  QIDX = (QIDX - 1 + QUEUE.length) % QUEUE.length;
  const p = postById(QUEUE[QIDX]);
  if (p) { stopPreview(); togglePreview(p); }
  render(true);
}
export function seekRestart(e) {
  if (e) e.stopPropagation();
  if (QIDX >= 0 && postById(QUEUE[QIDX])) { stopPreview(); togglePreview(postById(QUEUE[QIDX])); render(true); }
}
export function setVol(v) { VOL = v / 100; setVolume(VOL); }
export function openPost(postId) {
  TAB = "home"; EXPANDED = postId; VIEW_USER = null; render(); setHash("#/post-" + postId);
  setTimeout(() => { const el = document.getElementById("post-" + postId); if (el) el.scrollIntoView({ block: "center" }); }, 50);
}

export function vote(postId, val) {
  if (needAuth()) return;
  const p = postById(postId);
  if (!p) return;
  if (p.userId === ME) return toast("You can't vote on your own post.");
  const ex = p.votes.find((v) => v.u === ME);
  if (ex && ex.v === val) p.votes = p.votes.filter((v) => v.u !== ME);
  else if (ex) ex.v = val;
  else p.votes.push({ u: ME, v: val, ts: Date.now() });
  save(); render();
  if (!ex || ex.v !== val) notify(p.userId, `${me().username} ${val === 1 ? "upvoted" : "downvoted"} your post “${p.title}”.`, "vote"), save(), render();
}

export function comment(postId) {
  if (needAuth()) return;
  const el = document.getElementById("cmt-" + postId);
  const t = el.value.trim();
  if (!t) return;
  const p = postById(postId);
  p.comments.push({ u: ME, text: t, ts: Date.now() });
  notify(p.userId, `${me().username} commented on “${p.title}”.`, "comment");
  save(); render();
}

export function share(postId) {
  const p = postById(postId);
  const link = `https://perchance.org/${window.generatorName || "rhythm"}#post-${postId}`;
  if (navigator.clipboard) navigator.clipboard.writeText(link).catch(() => {});
  toast("Share link copied: " + link);
}

export function createPost() {
  if (needAuth()) return;
  const g = (id) => document.getElementById(id).value.trim();
  const domain = document.getElementById("npDom").value;
  const title = g("npTitle");
  if (!title) return toast("Give your work a title.");
  if (domain === "lyricist" && !g("npBody")) return toast("Lyrics text is required for lyricist posts.");
  const p = {
    id: uid("p"), userId: ME, domain, title,
    desc: g("npDesc"), genre: g("npGenre"), language: g("npLang"),
    body: domain === "lyricist" ? g("npBody") : "",
    audioSeed: title.toLowerCase().replace(/[^a-z0-9]+/g, "-"),
    bpm: g("npBpm") ? +g("npBpm") : undefined,
    key: g("npKey") || undefined,
    instrument: g("npInst") || undefined,
    duration: "demo",
    tags: g("npTags").split(",").map((t) => t.trim()).filter(Boolean),
    collabOpen: document.getElementById("npCollab").checked,
    auctionEligible: document.getElementById("npAuc").checked,
    comments: [], votes: [], createdAt: Date.now(),
  };
  DB.posts.unshift(p); MODAL = null; save(); TAB = "home"; EXPANDED = p.id; render();
  toast("Published! It now counts toward your state board.");
}

export function deletePost(postId) {
  if (!confirm("Delete this post? Its votes leave the leaderboard.")) return;
  DB.posts = DB.posts.filter((p) => p.id !== postId);
  save(); render(); toast("Post deleted.");
}

export function sendRequest(postId) {
  if (needAuth()) return;
  const p = postById(postId);
  const attach = document.getElementById("crAttach").value;
  if (!attach) return toast("Attach one of your works as a sample first.");
  DB.collabRequests.push({
    id: uid("cr"), fromId: ME, toId: p.userId, postId,
    attachPostId: attach,
    message: document.getElementById("crMsg").value.trim() || "I'd love to collaborate!",
    reason: document.getElementById("crReason").value.trim(),
    role: document.getElementById("crRole").value,
    status: "pending", createdAt: Date.now(),
  });
  notify(p.userId, `${me().username} sent you a collaboration request on “${p.title}” (with a work sample).`, "collab");
  MODAL = null; save(); TAB = "collabs"; render();
  toast("Request sent with your sample attached.");
}

export function acceptReq(id) {
  const r = DB.collabRequests.find((x) => x.id === id);
  r.status = "accepted";
  const p = postById(r.postId);
  const from = userById(r.fromId);
  const proj = {
    id: uid("pr"), title: (p ? p.title : "Untitled") + " — collab",
    desc: `Started from “${p ? p.title : ""}”. ${r.reason}`,
    members: [{ userId: r.toId, role: DOMAIN_LABEL[(postById(r.postId) || {}).domain] || "Artist" }, { userId: r.fromId, role: r.role }],
    postIds: p ? [p.id] : [], status: "in-progress",
    files: r.attachPostId ? [{ id: uid("f"), userId: r.fromId, name: "sample: " + ((postById(r.attachPostId) || {}).title || ""), kind: "link", ts: Date.now() }] : [],
    chat: [{ userId: r.toId, text: "Accepted! Let's make something great. 🎶", ts: Date.now() }],
    updates: ["Project created"], createdAt: Date.now(),
  };
  DB.projects.push(proj);
  notify(r.fromId, `${me().username} ACCEPTED your collaboration request — workspace is open!`, "collab");
  save(); VIEW_PROJECT = proj.id; render();
}

export function rejectReq(id) {
  const r = DB.collabRequests.find((x) => x.id === id);
  r.status = "rejected";
  notify(r.fromId, `${me().username} declined your collaboration request.`, "collab");
  save(); render();
}

export function sendChat(pid) {
  const el = document.getElementById("wsChatInput");
  const t = el.value.trim();
  if (!t) return;
  const p = DB.projects.find((x) => x.id === pid);
  p.chat.push({ userId: ME, text: t, ts: Date.now() });
  p.members.filter((m) => m.userId !== ME).forEach((m) => notify(m.userId, `New message in “${p.title}”.`, "message"));
  save(); render();
}

export function addFile(pid) {
  const el = document.getElementById("wsFileInput");
  const t = el.value.trim();
  if (!t) return;
  DB.projects.find((x) => x.id === pid).files.push({ id: uid("f"), userId: ME, name: t, kind: "note", ts: Date.now() });
  save(); render(); toast("File noted in workspace.");
}

export function attachPost(pid) {
  const sel = document.getElementById("wsAttachSel");
  if (!sel || !sel.value) return;
  const src = postById(sel.value);
  DB.projects.find((x) => x.id === pid).files.push({ id: uid("f"), userId: ME, name: "attached post: " + src.title, kind: "link", ts: Date.now() });
  save(); render(); toast("Post attached to workspace.");
}

export function setStatus(pid, s) {
  const p = DB.projects.find((x) => x.id === pid);
  p.status = s; p.updates.push("Status → " + s);
  save(); render();
}

export function completeProject(pid) {
  const p = DB.projects.find((x) => x.id === pid);
  if (!confirm("Mark completed and publish one joint post crediting all members?")) return;
  p.status = "completed"; p.updates.push("Completed & published");
  const jp = {
    id: uid("p"), userId: p.members[0].userId, domain: (postById(p.postIds[0]) || { domain: "composer" }).domain,
    title: p.title.replace(/ — collab$/, "") + " (collab finish)",
    desc: `Finished together by ${p.members.map((m) => (userById(m.userId) || {}).username).join(", ")}. ${p.desc}`,
    genre: "Indie", language: "Hindi", body: "", audioSeed: "joint-" + p.id,
    tags: ["collab"], collabOpen: false, auctionEligible: true,
    collabMeta: p.members.map((m) => (userById(m.userId) || {}).username).join(", "),
    comments: [], votes: [], createdAt: Date.now(),
  };
  DB.posts.unshift(jp);
  p.jointPostId = jp.id;
  p.members.filter((m) => m.userId !== ME).forEach((m) => notify(m.userId, `“${p.title}” completed — joint post published!`, "collab"));
  save(); render(); toast("🎉 Joint post published to everyone's history!");
}

export function createAuction(postId) {
  const g = (id) => document.getElementById(id).value.trim();
  const title = g("acTitle");
  if (!title) return toast("Auction needs a title.");
  if (!g("acOwn")) return toast("Ownership declaration is required.");
  DB.auctions.unshift({
    id: uid("a"), postId, sellerId: ME, title, desc: g("acDesc"),
    startPrice: +g("acStart") || 100, reservePrice: +g("acReserve") || 0, minInc: 50,
    startsAt: Date.now(), endsAt: Date.now() + (+document.getElementById("acDur").value || 72) * 3600000,
    rights: document.getElementById("acRights").value, ownership: g("acOwn"),
    status: "live", bids: [],
  });
  MODAL = null; save(); TAB = "auctions"; VIEW_AUCTION = null; render();
  toast("🔨 Auction is live on the billboard!");
}

export function bid(auctionId) {
  if (needAuth()) return;
  const a = DB.auctions.find((x) => x.id === auctionId);
  const amt = +document.getElementById("bidInput").value;
  const top = topBid(a);
  const min = (top ? top.amount : a.startPrice) + a.minInc;
  if (!amt || amt < min) return toast(`Bid at least ₹${min}.`);
  if (a.sellerId === ME) return toast("You can't bid on your own work.");
  if (!confirm(`Confirm binding bid of ₹${amt} on “${a.title}”?`)) return;
  a.bids.push({ userId: ME, amount: amt, ts: Date.now() });
  notify(a.sellerId, `New bid ₹${amt} on “${a.title}”.`, "auction");
  if (top && top.userId !== ME) notify(top.userId, `You've been outbid on “${a.title}” (now ₹${amt}).`, "auction");
  save(); render(); toast(`Bid placed: ₹${amt}. ${amt >= (a.reservePrice || 0) ? "Reserve met!" : "Below reserve."}`);
}

export function sendDM(threadId) {
  const el = document.getElementById("dmInput");
  const t = el.value.trim();
  if (!t) return;
  DB.threads.find((x) => x.id === threadId).messages.push({ userId: ME, text: t, ts: Date.now() });
  const th = DB.threads.find((x) => x.id === threadId);
  th.members.filter((m) => m !== ME).forEach((m) => notify(m, `${me().username} messaged you.`, "message"));
  save(); render();
}

export function followUser(id, fromProfile) {
  const u = me();
  u.following = u.following || [];
  if (!u.following.includes(id)) u.following.push(id);
  const t = userById(id);
  notify(id, `${u.username} started following you.`, "follow");
  save(); render(true);
}
export function unfollowUser(id, fromProfile) {
  me().following = (me().following || []).filter((x) => x !== id);
  save(); render(true);
}
export function toggleFav(postId, fromPlayer) {
  const u = me();
  u.favs = u.favs || [];
  const i = u.favs.indexOf(postId);
  if (i >= 0) { u.favs.splice(i, 1); toast("Removed from liked tracks."); }
  else { u.favs.push(postId); toast("♥ Added to liked tracks."); }
  save(); render(true);
}
export function openPlaylistModal(seedPostId) {
  if (needAuth()) return;
  MODAL = { kind: "playlist", seed: seedPostId || "" }; render();
}
export function createPlaylist() {
  const name = document.getElementById("plName").value.trim();
  if (!name) return toast("Name your playlist.");
  const pl = { id: uid("pl"), name, postIds: MODAL.seed && !MODAL.seed.startsWith("__") ? [MODAL.seed] : [] };
  me().playlists.push(pl);
  MODAL = null; save(); TAB = "dash"; render();
  toast(`Playlist “${name}” created.`);
}
export function openPickList(targetPostId) {
  if (!(me().playlists || []).length) { openPlaylistModal(targetPostId); return; }
  MODAL = { kind: "picklist", target: targetPostId }; render();
}
export function addToPlaylist(plId) {
  const postId = MODAL.target === "__current" ? QUEUE[QIDX] : MODAL.target;
  const pl = (me().playlists || []).find((p) => p.id === plId);
  if (pl && postId && !pl.postIds.includes(postId)) pl.postIds.push(postId);
  MODAL = null; save(); render(true);
  toast(`Added to “${pl ? pl.name : "playlist"}”.`);
}
export function playPlaylist(plId) {
  const pl = (me().playlists || []).find((p) => p.id === plId);
  if (!pl || !pl.postIds.length) return toast("Playlist is empty — add tracks first.");
  playTrack(pl.postIds[0], pl.postIds.join(","));
}
export function removeFromPlaylist(plId, postId) {
  const pl = (me().playlists || []).find((p) => p.id === plId);
  if (pl) pl.postIds = pl.postIds.filter((x) => x !== postId);
  save(); render(true);
}
export function collabWithUser(userId) {
  const p = DB.posts.filter((x) => x.userId === userId && x.collabOpen).sort((a, b) => b.createdAt - a.createdAt)[0];
  if (!p) return toast("This creator has no posts open to collaboration right now.");
  openCollab(p.id);
}
export function contactUser(userId) {
  let t = DB.threads.find((x) => x.members.includes(ME) && x.members.includes(userId));
  if (!t) { t = { id: uid("th"), members: [ME, userId], messages: [] }; DB.threads.push(t); save(); }
  VIEW_THREAD = t.id; TAB = "msgs"; render();
}

export function markRead() {
  DB.notifications.forEach((n) => { if (n.userId === ME) n.read = true; });
  save(); render();
}

export function saveBio() {
  me().bio = document.getElementById("bioInput").value.trim();
  save(); render(); toast("Profile saved.");
}

export function deleteAccount() {
  const live = DB.auctions.filter((a) => a.sellerId === ME && a.status === "live" && a.bids.length);
  const busy = DB.projects.filter((p) => p.status !== "completed" && p.status !== "cancelled" && p.members.some((m) => m.userId === ME) && p.members.length > 1);
  if (live.length) return toast("Close your auctions with bids before deleting.");
  if (busy.length) return toast("Leave or finish shared projects before deleting.");
  if (!confirm(`Permanently delete @${me().username} and all your posts, votes, chats and listings?`)) return;
  DB.posts = DB.posts.filter((p) => p.userId !== ME);
  DB.posts.forEach((p) => { p.votes = p.votes.filter((v) => v.u !== ME); p.comments = p.comments.filter((c) => c.u !== ME); });
  DB.auctions = DB.auctions.filter((a) => a.sellerId !== ME);
  DB.auctions.forEach((a) => { a.bids = a.bids.filter((b) => b.userId !== ME); });
  DB.collabRequests = DB.collabRequests.filter((r) => r.fromId !== ME && r.toId !== ME);
  DB.projects = DB.projects.filter((p) => !p.members.some((m) => m.userId === ME));
  DB.threads = DB.threads.filter((t) => !t.members.includes(ME));
  DB.notifications = DB.notifications.filter((n) => n.userId !== ME);
  DB.users = DB.users.filter((u) => u.id !== ME);
  save(); stopPreview(); QUEUE = []; QIDX = -1; ME = null; setSession(null); TAB = "dash"; render();
  toast("Account deleted.");
}

export function sendReport(postId) {
  DB.reports.push({ id: uid("r"), postId, by: ME, reason: document.getElementById("repReason").value, status: "open", ts: Date.now() });
  MODAL = null; save(); render(); toast("Reported. Admins will review.");
}

export function suspendUser(id) {
  const u = userById(id);
  u.suspended = !u.suspended;
  save(); render(); toast(u.suspended ? "User suspended." : "User reinstated.");
}

export function resolveReport(id, how) {
  const r = DB.reports.find((x) => x.id === id);
  r.status = how === "remove" ? "acted" : "dismissed";
  if (how === "remove") DB.posts = DB.posts.filter((p) => p.id !== r.postId);
  save(); render();
}

export function setComm() {
  DB.commissionPct = Math.max(0, +document.getElementById("commInput").value || 5);
  save(); render(); toast(`Commission set to ${DB.commissionPct}%.`);
}
