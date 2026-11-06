// RHYTHM app: session, tabs, feed, votes, boards, collabs, auctions, chat.
import { loadDB, saveDB, wipeDB, getSession, setSession, sha256, uid } from "./store.js";
import { seedDB, REGIONS, DOMAINS, DOMAIN_LABEL, GENRES, LANGUAGES } from "./seed.js";
import { togglePreview, isPlaying, stopPreview } from "./audio.js";

const DAY = 86400000;
const PERIODS = { week: 7 * DAY, month: 30 * DAY, year: 365 * DAY, all: Infinity };
const PERIOD_LABEL = { week: "Weekly", month: "Monthly", year: "Yearly", all: "All-Time" };

let DB = null;
let ME = null;             // current user id
let TAB = "home";
let AUTH_MODE = "in";      // 'in' | 'up'
let EXPANDED = null;       // expanded post id (comments)
let VIEW_USER = null;      // public profile id (null = me)
let VIEW_PROJECT = null;   // open workspace id
let VIEW_AUCTION = null;   // open auction id
let VIEW_THREAD = null;    // open DM thread id
let F = { q: "", domain: "", state: "", genre: "", lang: "", collab: false, sort: "top" };
let B = { domain: "lyricist", scope: "mystate", state: "", period: "week" };
let MODAL = null;          // {kind:'post'|'collab'|'auction'|'report', ...}
let SIGNUP_DOMAINS = ["lyricist"];

export async function boot() {
  DB = loadDB();
  if (!DB) {
    DB = seedDB();
    for (const u of DB.users) u.pass = await sha256(u.pass);
    saveDB(DB);
  }
  ME = getSession();
  if (ME && !DB.users.some((u) => u.id === ME)) { ME = null; setSession(null); }
  B.state = myState();
  render();
  setInterval(tickCountdowns, 1000);
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
  return `<div class="ava" style="background:${avaColor(name || "?")};${sz ? `width:${sz}px;height:${sz}px;` : ""}">${esc((name || "?").trim()[0].toUpperCase())}</div>`;
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
function render() {
  const c = document.getElementById("bootCtn");
  c.innerHTML = ME ? appView() : authView();
  if (ME) tickCountdowns();
  window.scrollTo(0, 0);
}

// ----- auth -----
function authView() {
  const inMode = AUTH_MODE === "in";
  return `<div class="center">
    <div class="hero"><div class="logo">RHYTHM</div>
    <p class="tagline">Discover Talent. Create Together. Rise Together.</p>
    <p class="small dim">Demo build — sign up instantly, no email needed. Pre-seeded demo login: <b>rahul@demo.in / demo</b> (or admin@demo.in / demo)</p></div>
    <div class="card">
      <div class="row">
        <button class="btn ${inMode ? "" : "ghost"}" onclick="R.setAuth('in')">Sign In</button>
        <button class="btn ${inMode ? "ghost" : ""}" onclick="R.setAuth('up')">Sign Up</button>
      </div>
      ${inMode ? `
      <label>Email or username</label><input id="liIdInput" placeholder="rahul@demo.in">
      <label>Password</label><input id="liPassInput" type="password" placeholder="demo">
      <div class="row" style="margin-top:14px"><button class="btn grow" onclick="R.login()">Sign In →</button></div>
      <p class="small dim"><a onclick="R.fakeRecovery()">Forgot password?</a> (demo: any account's password can be reset from Profile → not needed here)</p>
      ` : `
      <label>Full name</label><input id="suNameInput" placeholder="Your name">
      <label>Username</label><input id="suUserInput" placeholder="e.g. deelbeats">
      <label>Email</label><input id="suEmailInput" placeholder="you@email.in">
      <div class="grid2"><div><label>Password</label><input id="suPassInput" type="password"></div>
      <div><label>Confirm password</label><input id="suPass2Input" type="password"></div></div>
      <div class="grid2"><div><label>Date of birth</label><input id="suDobInput" type="date"></div>
      <div><label>City</label><input id="suCityInput" placeholder="Dehradun"></div></div>
      <label>State / Union Territory (decides your leaderboard)</label>
      <select id="suStateInput">${REGIONS.map((r) => `<option>${r}</option>`).join("")}</select>
      <label>Creative domains (pick all that apply)</label>
      <div class="domPick">${DOMAINS.map((d) => `<label data-dom="${d}" class="${SIGNUP_DOMAINS.includes(d) ? "sel" : ""}"><input type="checkbox" ${SIGNUP_DOMAINS.includes(d) ? "checked" : ""} onchange="R.toggleDom('${d}')">${DOMAIN_LABEL[d]}</label>`).join("")}</div>
      <label>Primary domain (your main ranking)</label><select id="suPrimaryInput">${SIGNUP_DOMAINS.map((d) => `<option value="${d}">${DOMAIN_LABEL[d]}</option>`).join("")}</select>
      <label>Bio</label><input id="suBioInput" placeholder="Short intro…">
      <div class="row" style="margin-top:14px"><button class="btn grow" onclick="R.signup()">Create account →</button></div>`}
    </div></div>${MODAL ? modalHtml() : ""}`;
}

// ----- app shell -----
function appView() {
  const m = me();
  const unread = DB.notifications.filter((n) => n.userId === ME && !n.read).length;
  const tabs = [["home", "🏠 Home"], ["explore", "🔍 Explore"], ["boards", "🏆 Leaderboards"], ["collabs", "🤝 Collabs"], ["auctions", "🔨 Auctions"], ["msgs", "💬 Messages"], ["notifs", `🔔 Alerts${unread ? ` (${unread})` : ""}`], ["profile", "👤 Profile"]];
  if (m.admin) tabs.push(["admin", "🛡 Admin"]);
  let body = "";
  if (TAB === "home") body = homeView();
  else if (TAB === "explore") body = exploreView();
  else if (TAB === "boards") body = boardsView();
  else if (TAB === "collabs") body = collabsView();
  else if (TAB === "auctions") body = auctionsView();
  else if (TAB === "msgs") body = msgsView();
  else if (TAB === "notifs") body = notifsView();
  else if (TAB === "profile") body = profileView();
  else if (TAB === "admin") body = adminView();
  return `<div class="topbar"><div class="topbarIn">
      <span class="brand" onclick="R.go('home')">♪ RHYTHM</span>
      <span class="small dim hidem">${esc(m.username)} · ${esc(m.state)}</span>
      <span class="grow"></span>
      <button class="btn small ghost" onclick="R.resetDemo()">↺ demo</button>
      <button class="btn small ghost" onclick="R.logout()">Logout</button>
    </div></div>
    <div class="wrap">
      <nav class="tabs">${tabs.map(([k, l]) => `<button class="${TAB === k ? "on" : ""}" onclick="R.go('${k}')">${l}</button>`).join("")}</nav>
      ${m.suspended ? `<div class="card"><b style="color:var(--red)">Account suspended</b><p class="small muted">An admin suspended this account. Posting, voting and bidding are disabled.</p></div>` : ""}
      ${body}
    </div>${MODAL ? modalHtml() : ""}`;
}

// ----- post card -----
function postCard(p, opts) {
  const a = userById(p.userId);
  const myVote = p.votes.find((v) => v.u === ME);
  const s = postScore(p, Infinity);
  const audio = p.audioSeed || ["singer", "instrumentalist", "composer", "beatmaker"].includes(p.domain);
  const live = DB.auctions.find((x) => x.postId === p.id && x.status === "live");
  return `<div class="post">
    <div class="postHead">${ava(a ? a.username : "?")}
      <div><b style="cursor:pointer" onclick="R.viewUser('${p.userId}')">${esc(a ? a.username : "deleted")}</b>
      <span class="badge">${DOMAIN_LABEL[p.domain]}</span>
      ${p.collabOpen ? `<span class="badge green">open to collab</span>` : ""}
      ${live ? `<span class="badge gold">🔨 on auction</span>` : ""}
      <div class="pmeta">${esc(a ? a.state : "")} · ${esc(p.genre)} · ${esc(p.language)} · ${timeAgo(p.createdAt)}</div></div>
    </div>
    <h3 style="margin:10px 0 2px">${esc(p.title)} ${p.collabMeta ? `<span class="small dim">· with ${esc(p.collabMeta)}</span>` : ""}</h3>
    <p class="small muted" style="margin:2px 0">${esc(p.desc || "")}</p>
    ${p.domain === "lyricist" && p.body ? `<div class="lyricsBox">${esc(p.body.length > 220 && !opts.expanded ? p.body.slice(0, 220) + "…" : p.body)}</div>` : ""}
    ${audio ? `<div class="row" style="margin-top:8px">
      <button class="chip" onclick="R.play('${p.id}',this)">▶ ${isPlaying(p.id) ? "Stop preview" : "Play demo preview"}</button>
      ${p.bpm ? `<span class="badge">${p.bpm} BPM</span>` : ""}${p.key ? `<span class="badge">${esc(p.key)}</span>` : ""}
      ${p.instrument ? `<span class="badge">${esc(p.instrument)}</span>` : ""}${p.duration ? `<span class="small dim">~${esc(p.duration)}</span>` : ""}
    </div>` : ""}
    ${p.tags && p.tags.length ? `<div style="margin-top:6px">${p.tags.map((t) => `<span class="badge">#${esc(t)}</span>`).join("")}</div>` : ""}
    <div class="actions">
      <button class="chip ${myVote && myVote.v === 1 ? "votedUp" : ""}" onclick="R.vote('${p.id}',1)">▲ ${p.votes.filter((v) => v.v === 1).length}</button>
      <button class="chip ${myVote && myVote.v === -1 ? "votedDown" : ""}" onclick="R.vote('${p.id}',-1)">▼ ${p.votes.filter((v) => v.v === -1).length}</button>
      <button class="chip" onclick="R.toggleExpand('${p.id}')">💬 ${p.comments.length}</button>
      ${p.userId !== ME ? `<button class="chip" onclick="R.openCollab('${p.id}')">🤝 Collaborate</button>` : ""}
      <button class="chip" onclick="R.share('${p.id}')">↗ Share</button>
      ${p.userId === ME ? `${p.auctionEligible && !live ? `<button class="chip" onclick="R.openAuctionCreate('${p.id}')">🔨 Auction</button>` : ""}<button class="chip" onclick="R.deletePost('${p.id}')">🗑</button>` : `<button class="chip" onclick="R.openReport('${p.id}')">⚑ Report</button>`}
    </div>
    ${opts.expanded ? commentsHtml(p) : ""}
  </div>`;
}
function commentsHtml(p) {
  return `<div style="margin-top:10px">${p.comments.map((c) => {
    const u = userById(c.u);
    return `<div class="msg"><b>${esc(u ? u.username : "?")}</b> <span class="dim small">${timeAgo(c.ts)}</span><br>${esc(c.text)}</div>`;
  }).join("") || `<p class="small dim">No comments yet.</p>`}
  <div class="row"><input id="cmt-${p.id}" class="grow" placeholder="Write a comment…"><button class="btn small" onclick="R.comment('${p.id}')">Send</button></div></div>`;
}

// ----- home -----
function homeView() {
  let list = DB.posts.slice();
  if (F.domain) list = list.filter((p) => p.domain === F.domain);
  list.sort((a, b) => F.sort === "top" ? postScore(b, Infinity) - postScore(a, Infinity) : b.createdAt - a.createdAt);
  return `<div class="row">
      <button class="btn" onclick="R.openPostModal()">＋ Create Post</button>
      <select id="fDomSel" style="max-width:190px" onchange="R.setF('domain',this.value)">
        <option value="">All domains</option>${DOMAINS.map((d) => `<option value="${d}" ${F.domain === d ? "selected" : ""}>${DOMAIN_LABEL[d]}</option>`).join("")}
      </select>
      <select id="fSortSel" style="max-width:150px" onchange="R.setF('sort',this.value)">
        <option value="top" ${F.sort === "top" ? "selected" : ""}>Top rated</option>
        <option value="new" ${F.sort === "new" ? "selected" : ""}>Newest</option>
      </select>
    </div>
    ${list.map((p) => postCard(p, { expanded: EXPANDED === p.id })).join("") || `<div class="card"><p class="muted">No posts yet — be the first!</p></div>`}`;
}

// ----- explore -----
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
  return `<div class="card"><h3 style="margin-top:0">🔍 Explore</h3>
    <input id="exQ" placeholder="Search lyrics, beats, artists, titles…" value="${esc(F.q)}" oninput="R.setFQ(this.value)">
    <div class="grid2" style="margin-top:8px">
      <div><label>Domain</label><select onchange="R.setF('domain',this.value)"><option value="">Any</option>${DOMAINS.map((d) => `<option value="${d}" ${F.domain === d ? "selected" : ""}>${DOMAIN_LABEL[d]}</option>`).join("")}</select></div>
      <div><label>State</label><select onchange="R.setF('state',this.value)"><option value="">Anywhere</option>${REGIONS.map((r) => `<option ${F.state === r ? "selected" : ""}>${r}</option>`).join("")}</select></div>
      <div><label>Genre</label><select onchange="R.setF('genre',this.value)"><option value="">Any</option>${GENRES.map((g) => `<option ${F.genre === g ? "selected" : ""}>${g}</option>`).join("")}</select></div>
      <div><label>Language</label><select onchange="R.setF('lang',this.value)"><option value="">Any</option>${LANGUAGES.map((l) => `<option ${F.lang === l ? "selected" : ""}>${l}</option>`).join("")}</select></div>
    </div>
    <label><input type="checkbox" style="width:auto" ${F.collab ? "checked" : ""} onchange="R.setF('collab',this.checked)"> Only open to collaboration</label>
    <p class="small muted">Try: a singer searching Hindi romantic lyricists open to collab → domain Lyricist + language Hindi + ☑ collab.</p></div>
    ${list.map((p) => postCard(p, { expanded: EXPANDED === p.id })).join("") || `<div class="card"><p class="muted">Nothing matches those filters.</p></div>`}`;
}

// ----- boards -----
function boardsView() {
  const w = PERIODS[B.period];
  const rows = B.scope === "national" ? nationalBoard(B.domain, w) : stateBoard(B.domain, B.scope === "mystate" ? myState() : B.state, w);
  const title = B.scope === "national" ? `National ${DOMAIN_LABEL[B.domain]} Championship` : `${B.scope === "mystate" ? myState() : B.state} · Top ${DOMAIN_LABEL[B.domain]}s`;
  return `<div class="card"><h3 style="margin-top:0">🏆 Leaderboards</h3>
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
    <div class="card"><h3 style="margin-top:0">${esc(title)} · ${PERIOD_LABEL[B.period]}</h3>
    ${rows.length ? `<table><tr><th>#</th><th>Artist</th><th>${B.scope === "national" ? "Qualified from" : "City"}</th><th>Score</th></tr>
      ${rows.slice(0, 20).map((r, i) => `<tr class="${i < 3 ? "rank1" : ""}"><td>${i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : i + 1}</td>
      <td><a onclick="R.viewUser('${r.u.id}')">${esc(r.u.username)}</a>${r.u.id === ME ? " (you)" : ""}${B.scope !== "national" && i < 3 ? ` <span class="badge gold">national qualifier</span>` : ""}</td>
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
  return `${mine ? "" : `<button class="btn small ghost" onclick="R.viewUser(null)">← My profile</button>`}
  <div class="card"><div class="row">${ava(u.username, 56)}
    <div><h2 style="margin:0">@{esc(u.username)}</h2><div class="small dim">${esc(u.name)} · ${esc(u.city)}, ${esc(u.state)}</div></div>
    <span class="grow"></span>
    ${mine ? `<button class="btn small ghost" onclick="R.resetDemo()">↺ Reset demo data</button>` : `<button class="btn small" onclick="R.contactUser('${u.id}')">💬 Message</button>`}
  </div>
  <p class="muted">${esc(u.bio || "")}</p>
  <div>${u.domains.map((d) => `<span class="badge ${d === u.primary ? "gold" : ""}">${DOMAIN_LABEL[d]}${d === u.primary ? " ★ primary" : ""}</span>`).join("")}</div>
  ${mine ? `<label>Bio</label><div class="row"><input id="bioInput" class="grow" value="${esc(u.bio || "")}"><button class="btn small" onclick="R.saveBio()">Save</button></div>` : ""}
  <div class="grid2" style="margin-top:10px">
    <div><b>${st.posts}</b> <span class="dim small">posts</span> · <b>${st.ups}</b> <span class="dim small">upvotes</span> · <b>${st.collabs}</b> <span class="dim small">collabs done</span></div>
    <div><span class="dim small">State rank (${DOMAIN_LABEL[u.primary]}):</span> <b>${rank ? "#" + rank : "—"}</b></div>
  </div>
  ${st.badges.length ? `<div style="margin-top:6px">${st.badges.map((b) => `<span class="badge gold">🏅 ${esc(b)}</span>`).join("")}</div>` : ""}
  ${mine ? `<p class="small dim">Sales: ${sales.length} · Revenue: ₹${sales.reduce((s, t) => s + t.amount - t.fee, 0)} ${listings.length ? `· Active listings: ${listings.filter((a) => a.status === "live").length}` : ""}</p>` : ""}
  </div>
  <h3>Portfolio</h3>
  ${DB.posts.filter((p) => p.userId === u.id).sort((a, b) => b.createdAt - a.createdAt).map((p) => postCard(p, { expanded: EXPANDED === p.id })).join("") || `<div class="card"><p class="muted">Nothing published yet.</p></div>`}`;
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
  if (p1.length < 4) return toast("Password too short (min 4 for demo).");
  if (DB.users.some((u) => u.username.toLowerCase() === username.toLowerCase())) return toast("Username taken.");
  if (DB.users.some((u) => u.email.toLowerCase() === email.toLowerCase())) return toast("Email already registered.");
  const primary = document.getElementById("suPrimaryInput").value;
  const u = { id: uid("u"), name, username, email, pass: await sha256(p1), pic: "", dob: v("suDobInput"), state: v("suStateInput"), city: v("suCityInput") || "—", bio: v("suBioInput"), domains: SIGNUP_DOMAINS.slice(), primary, suspended: false, admin: false, createdAt: Date.now() };
  DB.users.push(u); save();
  ME = u.id; setSession(ME); TAB = "home";
  notify(ME, "Welcome to RHYTHM! Publish your first post to enter your state leaderboard.", "info"); save();
  render(); toast(`Welcome, ${username}!`);
}

export async function login() {
  const id = document.getElementById("liIdInput").value.trim().toLowerCase();
  const pw = await sha256(document.getElementById("liPassInput").value);
  const u = DB.users.find((x) => (x.email.toLowerCase() === id || x.username.toLowerCase() === id) && x.pass === pw);
  if (!u) return toast("Invalid credentials. Try rahul@demo.in / demo.");
  ME = u.id; setSession(ME); TAB = "home"; VIEW_USER = null; VIEW_PROJECT = null; VIEW_AUCTION = null;
  render(); toast(`Welcome back, ${u.username}!`);
}
export function logout() { stopPreview(); ME = null; setSession(null); TAB = "home"; render(); }
export function resetDemo() { stopPreview(); wipeDB(); ME = null; setSession(null); boot(); }

export function go(t) { stopPreview(); TAB = t; if (t !== "collabs") VIEW_PROJECT = null; if (t !== "auctions") VIEW_AUCTION = null; if (t !== "msgs") VIEW_THREAD = null; if (t !== "profile") VIEW_USER = null; EXPANDED = null; render(); }
export function setF(k, val) { F[k] = val; EXPANDED = null; render(); }
export function setFQ(val) {
  F.q = val;
  const pos = document.getElementById("exQ");
  const start = pos ? pos.selectionStart : 0;
  EXPANDED = null; render();
  const el = document.getElementById("exQ");
  if (el) { el.focus(); el.setSelectionRange(start, start); }
}
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

export function play(postId, btn) {
  const p = postById(postId);
  const r = togglePreview(p);
  document.querySelectorAll(".chip").forEach(() => {});
  render();
  toast(r === "playing" ? "🔊 Playing synthesized demo preview…" : "⏹ Stopped.");
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
