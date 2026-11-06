// Demo dataset so every feature is clickable on first load.
import { uid } from "./store.js";

export const REGIONS = [
  "Andhra Pradesh", "Arunachal Pradesh", "Assam", "Bihar", "Chhattisgarh",
  "Goa", "Gujarat", "Haryana", "Himachal Pradesh", "Jharkhand", "Karnataka",
  "Kerala", "Madhya Pradesh", "Maharashtra", "Manipur", "Meghalaya",
  "Mizoram", "Nagaland", "Odisha", "Punjab", "Rajasthan", "Sikkim",
  "Tamil Nadu", "Telangana", "Tripura", "Uttar Pradesh", "Uttarakhand",
  "West Bengal", "Andaman and Nicobar Islands", "Chandigarh",
  "Dadra and Nagar Haveli and Daman and Diu", "Delhi", "Jammu and Kashmir",
  "Ladakh", "Lakshadweep", "Puducherry",
];

export const DOMAINS = ["singer", "instrumentalist", "lyricist", "composer", "beatmaker"];
export const DOMAIN_LABEL = { singer: "Singer", instrumentalist: "Instrumentalist", lyricist: "Lyricist", composer: "Composer", beatmaker: "Beatmaker" };
export const GENRES = ["Hip-Hop", "Lo-fi", "Pop", "Romantic", "Classical", "Rock", "EDM", "Folk", "Trap", "Indie"];
export const LANGUAGES = ["Hindi", "English", "Punjabi", "Bengali", "Tamil", "Telugu", "Marathi", "Other"];

const DAY = 86400000;
const HOUR = 3600000;

// Deterministic pseudo-random for stable demo votes.
function rng(seed) {
  let s = seed;
  return () => { s = (s * 1664525 + 1013904223) % 4294967296; return s / 4294967296; };
}

export function seedDB() {
  const now = Date.now();
  const R = rng(42);

  const users = [
    { id: "u_rahul", name: "Rahul Bisht", username: "rahulmusic", email: "rahul@demo.in", pass: "demo", pic: "", dob: "2001-04-12", state: "Uttarakhand", city: "Dehradun", bio: "Lyricist & singer. Words first, melody always.", domains: ["lyricist", "singer"], primary: "lyricist", suspended: false, admin: false, createdAt: now - 300 * DAY },
    { id: "u_aman", name: "Aman Gill", username: "amankeys", email: "aman@demo.in", pass: "demo", pic: "", dob: "1999-08-03", state: "Punjab", city: "Ludhiana", bio: "Composer / pianist. I turn words into songs.", domains: ["composer"], primary: "composer", suspended: false, admin: false, createdAt: now - 280 * DAY },
    { id: "u_priya", name: "Priya Nair", username: "priyasings", email: "priya@demo.in", pass: "demo", pic: "", dob: "2002-01-25", state: "Maharashtra", city: "Mumbai", bio: "Vocalist — Hindi & English. Open to collabs.", domains: ["singer"], primary: "singer", suspended: false, admin: false, createdAt: now - 200 * DAY },
    { id: "u_arjun", name: "Arjun Mehta", username: "arjunbeats", email: "arjun@demo.in", pass: "demo", pic: "", dob: "2000-11-30", state: "Delhi", city: "New Delhi", bio: "Beatmaker. Trap / lo-fi / drill.", domains: ["beatmaker"], primary: "beatmaker", suspended: false, admin: false, createdAt: now - 150 * DAY },
    { id: "u_sahil", name: "Sahil Rawat", username: "sahilguitar", email: "sahil@demo.in", pass: "demo", pic: "", dob: "1998-06-14", state: "Uttarakhand", city: "Nainital", bio: "Guitarist. Acoustic loops & textures.", domains: ["instrumentalist"], primary: "instrumentalist", suspended: false, admin: false, createdAt: now - 120 * DAY },
    { id: "u_kavya", name: "Kavya Reddy", username: "kavyawrites", email: "kavya@demo.in", pass: "demo", pic: "", dob: "2003-02-09", state: "Telangana", city: "Hyderabad", bio: "Poet → lyricist. Telugu, Hindi, English.", domains: ["lyricist"], primary: "lyricist", suspended: false, admin: false, createdAt: now - 90 * DAY },
    { id: "u_vikram", name: "Vikram Singh", username: "vikram808", email: "vikram@demo.in", pass: "demo", pic: "", dob: "1997-12-01", state: "Rajasthan", city: "Jaipur", bio: "Beats & compositions. 808s with soul.", domains: ["beatmaker", "composer"], primary: "beatmaker", suspended: false, admin: false, createdAt: now - 60 * DAY },
    { id: "u_ananya", name: "Ananya Das", username: "ananyadas", email: "ananya@demo.in", pass: "demo", pic: "", dob: "2001-09-17", state: "West Bengal", city: "Kolkata", bio: "Singer-composer. Classical roots, indie heart.", domains: ["singer", "composer"], primary: "singer", suspended: false, admin: false, createdAt: now - 40 * DAY },
    { id: "u_admin", name: "Platform Admin", username: "admin", email: "admin@demo.in", pass: "demo", pic: "", dob: "1990-01-01", state: "Delhi", city: "New Delhi", bio: "Moderation & safety.", domains: ["composer"], primary: "composer", suspended: false, admin: true, createdAt: now - 400 * DAY },
  ];

  const P = (o) => Object.assign({ id: uid("p"), collabOpen: true, auctionEligible: true, tags: [], comments: [], votes: [], createdAt: now - Math.floor(R() * 200) * DAY }, o);

  const posts = [
    P({ userId: "u_rahul", domain: "lyricist", title: "Khamosh Raaste", desc: "A sad/romantic Hindi song about goodbyes. Looking for a composer!", genre: "Romantic", language: "Hindi", body: "Khamosh raaste, bheegi palkein\nChhod aaye hum woh galiyaan\nChaand bhi rootha, taare soye\nReh gayi bas teri nishaaniyaan\n\n[Hook]\nLaut aa, ek baar laut aa\nAdhoori si iss kahani ko mukammal kar jaa", tags: ["sad", "romantic", "hook"], createdAt: now - 20 * DAY }),
    P({ userId: "u_rahul", domain: "lyricist", title: "Incomplete Dreams", desc: "Draft hook + verse. Open to composers and singers.", genre: "Indie", language: "Hindi", body: "Adhoore khwaab, adhoori raatein\nNeend mein bhi chalti hain baatein\nSubah ka suraj pooche humse\nKab poori hogi mulaqaatein?", tags: ["draft", "hook"], createdAt: now - 6 * DAY }),
    P({ userId: "u_aman", domain: "composer", title: "Monsoon Piano Theme", desc: "Wordless piano composition. Lyricists welcome!", genre: "Classical", language: "Other", audioSeed: "monsoon-piano", duration: "2:14", createdAt: now - 25 * DAY }),
    P({ userId: "u_priya", domain: "singer", title: "Unfinished Dreams (vocal)", desc: "Original vocal idea, needs a full composition.", genre: "Pop", language: "Hindi", audioSeed: "unfinished-dreams", duration: "1:32", createdAt: now - 9 * DAY }),
    P({ userId: "u_arjun", domain: "beatmaker", title: "Midnight Hustle", desc: "90-second trap instrumental. 140 BPM, D minor.", genre: "Trap", language: "Other", audioSeed: "midnight-hustle", bpm: 140, key: "D minor", duration: "1:30", createdAt: now - 15 * DAY }),
    P({ userId: "u_arjun", domain: "beatmaker", title: "Chai & Rain (lo-fi)", desc: "Dusty lo-fi loop for rainy writing sessions. 82 BPM.", genre: "Lo-fi", language: "Other", audioSeed: "chai-rain", bpm: 82, key: "F major", duration: "1:48", createdAt: now - 3 * DAY }),
    P({ userId: "u_sahil", domain: "instrumentalist", title: "Acoustic Sunset", desc: "60-sec acoustic guitar loop. Singers, come find me!", genre: "Folk", language: "Other", instrument: "Guitar", audioSeed: "acoustic-sunset", duration: "1:04", createdAt: now - 12 * DAY }),
    P({ userId: "u_kavya", domain: "lyricist", title: "Neeli Syaahi", desc: "Telugu-Hindi poem for musical adaptation.", genre: "Romantic", language: "Telugu", body: "Neeli syaahi mein doobi raatein\nKora kaagaz, geele jazbaat\nHar lafz mein chhupa hai mausam\nHar misre mein teri baat", tags: ["poem"], createdAt: now - 5 * DAY }),
    P({ userId: "u_vikram", domain: "beatmaker", title: "Desert 808", desc: "Rajasthani folk chop over heavy 808s. 150 BPM.", genre: "Hip-Hop", language: "Other", audioSeed: "desert-808", bpm: 150, key: "C minor", duration: "1:56", createdAt: now - 8 * DAY }),
    P({ userId: "u_ananya", domain: "singer", title: "Bhor (dawn raga-ish)", desc: "Morning composition, classical roots. Needs tabla + arrangement.", genre: "Classical", language: "Bengali", audioSeed: "bhor-dawn", duration: "2:40", createdAt: now - 30 * DAY }),
    P({ userId: "u_ananya", domain: "composer", title: "City Lights Score", desc: "Short background score — city night mood.", genre: "Indie", language: "Other", audioSeed: "city-lights", duration: "1:20", createdAt: now - 2 * DAY }),
    P({ userId: "u_kavya", domain: "lyricist", title: "16 Bars: Metro Nights", desc: "Rap verse, open for beatmakers.", genre: "Hip-Hop", language: "Hindi", body: "Metro ki bheed mein akela safar\nSapne jeb mein, hausla kamar\nSignal tod ke nikal pade hum\nManzil khud aayegi nazar...", tags: ["rap", "16bars"], createdAt: now - 1 * DAY }),
  ];

  // Votes: {u, v, ts} — spread across time so all 4 boards have content.
  const voterIds = users.map((u) => u.id);
  const hot = { "p_hot": 0 };
  posts.forEach((p, i) => {
    const n = 6 + Math.floor(R() * 14) + (i < 3 ? 14 : 0);
    for (let k = 0; k < n; k++) {
      const voter = voterIds[Math.floor(R() * voterIds.length)];
      if (voter === p.userId) continue;
      if (p.votes.some((x) => x.u === voter)) continue;
      const age = [1, 3, 10, 40, 100, 200][Math.floor(R() * 6)] * DAY + Math.floor(R() * 20) * HOUR;
      p.votes.push({ u: voter, v: R() < 0.85 ? 1 : -1, ts: now - age });
    }
    p.comments.push({ u: voterIds[(i + 2) % voterIds.length], text: ["This is beautiful!", "Would love to collab on this.", "That hook is stuck in my head.", "Clean mix, great feel."][Math.floor(R() * 4)], ts: now - Math.floor(R() * 5) * DAY });
  });

  const collabRequests = [
    { id: "cr_1", fromId: "u_aman", toId: "u_rahul", postId: posts[1].id, attachPostId: posts[2].id, message: "I really like this concept — the hook has real ache in it.", reason: "I have a piano composition I think fits these words perfectly. I'd love to compose around them.", role: "Composer", status: "pending", createdAt: now - 2 * DAY },
  ];

  const projects = [
    {
      id: "pr_1", title: "Khamosh Raaste — full song", desc: "Rahul's lyrics + Aman's piano + Priya's vocals.",
      members: [{ userId: "u_rahul", role: "Lyricist" }, { userId: "u_aman", role: "Composer" }, { userId: "u_priya", role: "Singer" }],
      postIds: [posts[0].id], status: "in-progress",
      files: [{ id: uid("f"), userId: "u_aman", name: "piano-demo-v1.mp3", kind: "audio", ts: now - 5 * DAY }, { id: uid("f"), userId: "u_rahul", name: "lyrics-v2-final.txt", kind: "doc", ts: now - 4 * DAY }],
      chat: [
        { userId: "u_rahul", text: "Shared the updated verse — fixed the second line's meter.", ts: now - 4 * DAY },
        { userId: "u_aman", text: "Fits the bridge perfectly. Recording a fuller take tonight.", ts: now - 3 * DAY },
        { userId: "u_priya", text: "I can try vocals this weekend if you send the new chords!", ts: now - 1 * DAY },
      ],
      updates: ["Project created", "Piano demo v1 added", "Lyrics v2 added"],
      createdAt: now - 6 * DAY,
    },
  ];

  const threads = [
    { id: "th_1", members: ["u_rahul", "u_aman"], messages: [{ userId: "u_aman", text: "Bro, that hook is special. Sending you the piano sketch tonight.", ts: now - 2 * DAY }, { userId: "u_rahul", text: "Can't wait to hear it!", ts: now - 2 * DAY + HOUR }] },
  ];

  const auctions = [
    { id: "a_1", postId: posts[4].id, sellerId: "u_arjun", title: "Midnight Hustle — exclusive rights", desc: "Full stems + exclusive commercial ownership. 140 BPM trap.", startPrice: 500, reservePrice: 2000, minInc: 50, startsAt: now - 2 * DAY, endsAt: now + 26 * HOUR, rights: "Exclusive ownership", ownership: "I confirm this beat is 100% original and I own all rights.", status: "live", bids: [{ userId: "u_vikram", amount: 600, ts: now - 20 * HOUR }, { userId: "u_ananya", amount: 800, ts: now - 9 * HOUR }, { userId: "u_priya", amount: 1000, ts: now - 2 * HOUR }] },
    { id: "a_2", postId: posts[0].id, sellerId: "u_rahul", title: "Khamosh Raaste — non-exclusive license", desc: "Use these lyrics in your song. Credit required.", startPrice: 1000, reservePrice: 1000, minInc: 100, startsAt: now - 1 * DAY, endsAt: now + 3 * DAY, rights: "Non-exclusive license", ownership: "Original lyrics written by me.", status: "live", bids: [{ userId: "u_aman", amount: 1100, ts: now - 5 * HOUR }] },
    { id: "a_3", postId: posts[8].id, sellerId: "u_vikram", title: "Desert 808 — limited lease", desc: "1-year lease, 100k streams cap. Stems included.", startPrice: 300, reservePrice: 0, minInc: 50, startsAt: now - 3 * HOUR, endsAt: now + 50 * 60000, rights: "Limited lease (1 yr)", ownership: "Original work, folk chop cleared via own recording.", status: "live", bids: [] },
  ];

  const notifications = [
    { id: uid("n"), userId: "u_rahul", text: "Aman sent you a collaboration request on “Incomplete Dreams”.", kind: "collab", ts: now - 2 * DAY, read: false },
    { id: uid("n"), userId: "u_rahul", text: "Your post “Khamosh Raaste” entered the Uttarakhand Lyricist Top 3!", kind: "rank", ts: now - 1 * DAY, read: false },
  ];

  const reports = [];
  const transactions = [];
  const commissionPct = 5;

  return { users, posts, collabRequests, projects, threads, auctions, notifications, reports, transactions, commissionPct };
}
