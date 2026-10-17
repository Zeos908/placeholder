/**
 * Sound effects (front-end spec §15), synthesized with Web Audio: no files, no licensing.
 * The AudioContext is created lazily on the first user gesture (browsers block it before).
 * Respects the "Sound effects" setting; independent of video mute.
 */
import { usePrefs } from "@/lib/store";

let ctx: AudioContext | null = null;

function audio(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (!usePrefs.getState().soundEnabled) return null;
  try {
    ctx ??= new (window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
    if (ctx.state === "suspended") void ctx.resume();
    return ctx;
  } catch {
    return null;
  }
}

/** Gain envelope 0 → peak → 0 over `dur` seconds, starting at `t`. */
function envelope(ac: AudioContext, t: number, peak: number, dur: number, attack = 0.01) {
  const g = ac.createGain();
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(peak, t + attack);
  g.gain.linearRampToValueAtTime(0, t + dur);
  g.connect(ac.destination);
  return g;
}

/** Soft "pop": sine 660 → 880 Hz over 60 ms, gain 0 → 0.15 → 0 over 120 ms. */
function save() {
  const ac = audio();
  if (!ac) return;
  const t = ac.currentTime;
  const osc = ac.createOscillator();
  osc.type = "sine";
  osc.frequency.setValueAtTime(660, t);
  osc.frequency.linearRampToValueAtTime(880, t + 0.06);
  osc.connect(envelope(ac, t, 0.15, 0.12));
  osc.start(t);
  osc.stop(t + 0.13);
}

/** Low "swish": band-passed noise burst, 90 ms, gain 0.08. */
function pass() {
  const ac = audio();
  if (!ac) return;
  const t = ac.currentTime;
  const len = Math.floor(ac.sampleRate * 0.09);
  const buffer = ac.createBuffer(1, len, ac.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
  const src = ac.createBufferSource();
  src.buffer = buffer;
  const filter = ac.createBiquadFilter();
  filter.type = "bandpass";
  filter.frequency.setValueAtTime(900, t);
  filter.frequency.linearRampToValueAtTime(400, t + 0.09);
  filter.Q.value = 0.8;
  src.connect(filter);
  filter.connect(envelope(ac, t, 0.08, 0.09, 0.015));
  src.start(t);
  src.stop(t + 0.09);
}

/** Two-note chime: sine 784 Hz then 1047 Hz, 120 ms each, gain 0.15. */
function accepted() {
  const ac = audio();
  if (!ac) return;
  const t = ac.currentTime;
  [784, 1047].forEach((freq, i) => {
    const start = t + i * 0.12;
    const osc = ac.createOscillator();
    osc.type = "sine";
    osc.frequency.setValueAtTime(freq, start);
    osc.connect(envelope(ac, start, 0.15, 0.12));
    osc.start(start);
    osc.stop(start + 0.125);
  });
}

export const sound = { save, pass, accepted };
