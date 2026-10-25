// RHYTHM Web Audio synthesizer.
// Generates a deterministic demo preview for each post.

let ctx = null;
let playing = null;
let volume = 0.8;

function hashStr(s) {
    let h = 2166136261;

    for (let i = 0; i < s.length; i++) {
        h ^= s.charCodeAt(i);
        h = Math.imul(h, 16777619);
    }

    return (h >>> 0) / 4294967296;
}

const SCALES = {
    "Lo-fi": [0, 3, 5, 7, 10],
    "Trap": [0, 2, 3, 7, 8],
    "Hip-Hop": [0, 3, 5, 7, 10],
    "Pop": [0, 2, 4, 7, 9],
    "Romantic": [0, 2, 4, 7, 9],
    "Classical": [0, 2, 4, 5, 7, 9, 11],
    "Rock": [0, 3, 5, 6, 7, 10],
    "EDM": [0, 2, 5, 7, 9],
    "Folk": [0, 2, 4, 7, 9],
    "Indie": [0, 2, 3, 7, 9]
};

export function setVolume(value) {
    volume = Math.max(0, Math.min(1, Number(value) || 0));

    if (playing && playing.master) {
        playing.master.gain.value = volume * 0.5;
    }
}

export function getVolume() {
    return volume;
}

export function currentTrack() {
    if (!playing) return null;

    const elapsed = Math.max(0, ctx.currentTime - playing.startAt);

    return {
        postId: playing.postId,
        elapsed: elapsed % playing.duration,
        dur: playing.duration
    };
}

export function isPlaying(postId) {
    return !!(playing && playing.postId === postId);
}

export function stopPreview() {
    if (!playing) return;

    try {
        clearInterval(playing.timer);

        playing.nodes.forEach((node) => {
            try {
                if (node.stop) node.stop();
                if (node.disconnect) node.disconnect();
            } catch (e) {}
        });
    } catch (e) {}

    playing = null;
}

export function togglePreview(post) {
    if (isPlaying(post.id)) {
        stopPreview();
        return "stopped";
    }

    stopPreview();

    try {
        ctx = ctx || new (window.AudioContext || window.webkitAudioContext)();

        if (ctx.state === "suspended") {
            ctx.resume();
        }

        const seed = hashStr(post.audioSeed || post.id);
        const scale = SCALES[post.genre] || SCALES.Pop;
        const base = 196 + Math.floor(seed * 120);

        const tempo = post.bpm ||
            (post.genre === "Lo-fi" ? 82 :
            post.genre === "Trap" ? 140 : 100);

        const step = 60 / tempo / 2;
        const duration = step * 32;

        const notes = [];

        for (let i = 0; i < 32; i++) {
            const r = hashStr((post.id || "") + ":" + i);

            notes.push(
                r < 0.3
                    ? null
                    : scale[Math.floor(r * scale.length) % scale.length]
                      + 12 * (r > 0.8 ? 1 : 0)
            );
        }

        const master = ctx.createGain();
        master.gain.value = volume * 0.5;
        master.connect(ctx.destination);

        const nodes = [master];

        let idx = 0;
        const startAt = ctx.currentTime + 0.05;

        const playStep = (i, t) => {
            const n = notes[i % 32];

            if (n !== null) {
                const oscillator = ctx.createOscillator();
                const gain = ctx.createGain();

                oscillator.type =
                    post.domain === "beatmaker" ? "sawtooth" : "triangle";

                oscillator.frequency.value =
                    base * Math.pow(2, n / 12);

                gain.gain.setValueAtTime(0.0001, t);
                gain.gain.exponentialRampToValueAtTime(0.5, t + 0.02);
                gain.gain.exponentialRampToValueAtTime(
                    0.0001,
                    t + step * 1.8
                );

                oscillator.connect(gain);
                gain.connect(master);

                oscillator.start(t);
                oscillator.stop(t + step * 2);

                nodes.push(oscillator, gain);
            }

            if (i % 4 === 0) {
                const oscillator = ctx.createOscillator();
                const gain = ctx.createGain();

                oscillator.type = "sine";

                oscillator.frequency.setValueAtTime(120, t);
                oscillator.frequency.exponentialRampToValueAtTime(
                    45,
                    t + 0.12
                );

                gain.gain.setValueAtTime(0.6, t);
                gain.gain.exponentialRampToValueAtTime(
                    0.0001,
                    t + 0.15
                );

                oscillator.connect(gain);
                gain.connect(master);

                oscillator.start(t);
                oscillator.stop(t + 0.2);

                nodes.push(oscillator, gain);
            }
        };

        for (let i = 0; i < 32; i++) {
            playStep(i, startAt + i * step);
        }

        const timer = setInterval(() => {
            if (!playing) {
                clearInterval(timer);
                return;
            }

            const t = ctx.currentTime + 0.1;

            for (let i = 0; i < 8; i++) {
                playStep((idx + i) % 32, t + i * step);
            }

            idx = (idx + 8) % 32;

        }, step * 8 * 1000);

        playing = {
            postId: post.id,
            nodes,
            timer,
            master,
            startAt,
            duration
        };

        return "playing";

    } catch (e) {
        return "error";
    }
}