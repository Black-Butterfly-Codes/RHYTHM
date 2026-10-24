// Tiny WebAudio synth: generates a deterministic preview loop per post.
// (Demo stand-in for real uploaded audio.)
let ctx = null;
let playing = null; // {postId, nodes, timer}

function hashStr(s) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return (h >>> 0) / 4294967296;
}

const SCALES = {
  "Lo-fi": [0, 3, 5, 7, 10], "Trap": [0, 2, 3, 7, 8], "Hip-Hop": [0, 3, 5, 7, 10],
  "Pop": [0, 2, 4, 7, 9], "Romantic": [0, 2, 4, 7, 9], "Classical": [0, 2, 4, 5, 7, 9, 11],
  "Rock": [0, 3, 5, 6, 7, 10], "EDM": [0, 2, 5, 7, 9], "Folk": [0, 2, 4, 7, 9], "Indie": [0, 2, 3, 7, 9],
};

export function isPlaying(postId) {
  return !!(playing && playing.postId === postId);
}

export function stopPreview() {
  if (!playing) return;
  try {
    playing.timer && clearInterval(playing.timer);
    playing.nodes.forEach((n) => { try { n.stop && n.stop(); } catch (e) {} try { n.disconnect && n.disconnect(); } catch (e) {} });
  } catch (e) {}
  playing = null;
}

export function togglePreview(post) {
  if (isPlaying(post.id)) { stopPreview(); return "stopped"; }
  stopPreview();
  try {
    ctx = ctx || new (window.AudioContext || window.webkitAudioContext)();
    if (ctx.state === "suspended") ctx.resume();
    const seed = hashStr(post.audioSeed || post.id);
    const scale = SCALES[post.genre] || SCALES.Pop;
    const base = 196 + Math.floor(seed * 120); // G3..~
    const tempo = post.bpm || (post.genre === "Lo-fi" ? 82 : post.genre === "Trap" ? 140 : 100);
    const step = 60 / tempo / 2;
    const notes = [];
    for (let i = 0; i < 32; i++) {
      const r = hashStr((post.id || "") + ":" + i);
      notes.push(r < 0.3 ? null : scale[Math.floor(r * scale.length) % scale.length] + 12 * (r > 0.8 ? 1 : 0));
    }
    const master = ctx.createGain();
    master.gain.value = 0.5;
    master.connect(ctx.destination);
    const nodes = [master];
    let idx = 0;
    const startAt = ctx.currentTime + 0.05;
    const playStep = (i, t) => {
      const n = notes[i % 32];
      if (n !== null) {
        const o = ctx.createOscillator();
        const g = ctx.createGain();
        o.type = (post.domain === "beatmaker") ? "sawtooth" : "triangle";
        o.frequency.value = base * Math.pow(2, n / 12);
        g.gain.setValueAtTime(0.0001, t);
        g.gain.exponentialRampToValueAtTime(0.5, t + 0.02);
        g.gain.exponentialRampToValueAtTime(0.0001, t + step * 1.8);
        o.connect(g); g.connect(master);
        o.start(t); o.stop(t + step * 2);
        nodes.push(o, g);
      }
      if (i % 4 === 0) { // soft kick
        const o = ctx.createOscillator();
        const g = ctx.createGain();
        o.type = "sine";
        o.frequency.setValueAtTime(120, t);
        o.frequency.exponentialRampToValueAtTime(45, t + 0.12);
        g.gain.setValueAtTime(0.6, t);
        g.gain.exponentialRampToValueAtTime(0.0001, t + 0.15);
        o.connect(g); g.connect(master);
        o.start(t); o.stop(t + 0.2);
        nodes.push(o, g);
      }
    };
    for (let i = 0; i < 32; i++) playStep(i, startAt + i * step);
    const timer = setInterval(() => {
      if (!playing) { clearInterval(timer); return; }
      const t = ctx.currentTime + 0.1;
      for (let i = 0; i < 8; i++) playStep((idx + i) % 32, t + i * step);
      idx = (idx + 8) % 32;
    }, step * 8 * 1000);
    playing = { postId: post.id, nodes, timer };
    return "playing";
  } catch (e) { return "error"; }
}
