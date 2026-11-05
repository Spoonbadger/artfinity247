// Royalty-free background music, made on the spot with Web Audio: no recordings, nothing licensed, nothing bundled.
// Two moods: "pad" (slow chords) and "pulse" (the same chords over a soft beat). Videos are silent by default.
import type { MusicId } from "@/lib/social/presets";

// I – vi – IV – V in C, voiced warm and low.
const CHORDS = [
  [261.63, 329.63, 392.0, 493.88],
  [220.0, 261.63, 329.63, 392.0],
  [174.61, 220.0, 261.63, 329.63],
  [196.0, 246.94, 293.66, 392.0],
];

/** Starts the track on `dest` and returns a stop handle. `duration` in seconds (it fades out at the end). */
export function playTrack(ac: AudioContext, dest: AudioNode, id: MusicId, duration: number) {
  const out = ac.createGain();
  const t0 = ac.currentTime + 0.05;
  out.gain.setValueAtTime(0, t0);
  out.gain.linearRampToValueAtTime(0.5, t0 + 0.8);
  out.gain.setValueAtTime(0.5, t0 + Math.max(1, duration - 1.2));
  out.gain.linearRampToValueAtTime(0, t0 + duration);
  const lp = ac.createBiquadFilter();
  lp.type = "lowpass";
  lp.frequency.value = id === "pulse" ? 2400 : 1500;
  lp.connect(out);
  out.connect(dest);
  const nodes: AudioScheduledSourceNode[] = [];
  const bar = id === "pulse" ? 2 : 2.5;
  for (let b = 0, at = t0; at < t0 + duration; b++, at += bar) {
    CHORDS[b % CHORDS.length].forEach((f, i) => {
      const o = ac.createOscillator();
      o.type = i === 0 ? "triangle" : "sine";
      o.frequency.value = i === 0 ? f / 2 : f;
      o.detune.value = (i - 1.5) * 4;
      const g = ac.createGain();
      g.gain.setValueAtTime(0, at);
      g.gain.linearRampToValueAtTime(i === 0 ? 0.16 : 0.07, at + (id === "pulse" ? 0.05 : 0.6));
      g.gain.linearRampToValueAtTime(0, at + bar + 0.3);
      o.connect(g).connect(lp);
      o.start(at);
      o.stop(at + bar + 0.35);
      nodes.push(o);
    });
    if (id === "pulse") {
      // a soft kick on each beat (90 bpm) and a pluck on the off-beats
      for (let k = 0; k < 3; k++) {
        const kt = at + k * (60 / 90);
        if (kt > t0 + duration) break;
        const o = ac.createOscillator();
        o.type = "sine";
        o.frequency.setValueAtTime(110, kt);
        o.frequency.exponentialRampToValueAtTime(45, kt + 0.18);
        const g = ac.createGain();
        g.gain.setValueAtTime(0.35, kt);
        g.gain.exponentialRampToValueAtTime(0.001, kt + 0.25);
        o.connect(g).connect(out);
        o.start(kt);
        o.stop(kt + 0.3);
        nodes.push(o);
        const p = ac.createOscillator();
        p.type = "triangle";
        p.frequency.value = CHORDS[b % CHORDS.length][(k + 1) % 4] * 2;
        const pg = ac.createGain();
        const pt = kt + 30 / 90;
        pg.gain.setValueAtTime(0.06, pt);
        pg.gain.exponentialRampToValueAtTime(0.001, pt + 0.2);
        p.connect(pg).connect(lp);
        p.start(pt);
        p.stop(pt + 0.25);
        nodes.push(p);
      }
    }
  }
  return {
    stop() {
      for (const n of nodes) { try { n.stop(); } catch { /* already stopped */ } }
      try { out.disconnect(); } catch { /* gone */ }
    },
  };
}

/** A few seconds through the speakers, for the "Listen" button. */
export function previewTrack(id: MusicId, seconds = 5) {
  if (id === "none" || typeof AudioContext === "undefined") return () => {};
  const ac = new AudioContext();
  const t = playTrack(ac, ac.destination, id, seconds);
  const timer = setTimeout(() => { t.stop(); ac.close().catch(() => {}); }, seconds * 1000 + 200);
  return () => { clearTimeout(timer); t.stop(); ac.close().catch(() => {}); };
}
