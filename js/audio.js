import { S } from './state.js';

/* ============================== audio ============================== */
export function initAudio() {
  if (!S.AC) { try { S.AC = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) {} }
  if (S.AC && S.AC.state === 'suspended') S.AC.resume();
}
export function tone(f, dur = 0.15, type = 'sine', vol = 0.15, delay = 0, slideTo = 0) {
  if (!S.soundOn || !S.AC) return;
  const AC = S.AC;
  const t0 = AC.currentTime + delay;
  const o = AC.createOscillator(), g = AC.createGain();
  o.type = type; o.frequency.setValueAtTime(f, t0);
  if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t0 + dur);
  g.gain.setValueAtTime(0, t0);
  g.gain.linearRampToValueAtTime(vol, t0 + 0.012);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  o.connect(g); g.connect(AC.destination);
  o.start(t0); o.stop(t0 + dur + 0.05);
}
export const sfx = {
  pick(c) { const n = [523, 587, 659, 784, 880, 1047]; const f = n[Math.min(c - 1, 5)] || 523;
    tone(f, 0.12, 'triangle', 0.18); tone(f * 1.5, 0.18, 'sine', 0.09, 0.05); },
  gold() { tone(880, 0.1, 'triangle', 0.16); tone(1175, 0.1, 'triangle', 0.16, 0.08); tone(1568, 0.3, 'sine', 0.15, 0.16); },
  rainbow() { [659, 784, 988, 1175, 1568].forEach((f, i) => tone(f, 0.14, 'triangle', 0.15, i * 0.07)); },
  bee() { tone(220, 0.32, 'sawtooth', 0.12, 0, 105); tone(150, 0.25, 'square', 0.05, 0.06); },
  buzz() { tone(170, 0.2, 'sawtooth', 0.05, 0, 200); },
  shield() { tone(523, 0.1, 'triangle', 0.15); tone(784, 0.22, 'sine', 0.14, 0.07); },
  swat() { tone(520, 0.16, 'sawtooth', 0.1, 0, 180); tone(900, 0.08, 'sine', 0.08, 0.02); },
  swatHit() { tone(700, 0.08, 'square', 0.1); tone(950, 0.12, 'square', 0.09, 0.06); },
  crow() { tone(740, 0.1, 'square', 0.07, 0, 480); tone(700, 0.1, 'square', 0.06, 0.14, 460); },
  fly() { tone(1047, 0.09, 'sine', 0.12); tone(1319, 0.09, 'sine', 0.12, 0.07); tone(1568, 0.22, 'sine', 0.12, 0.14); },
  clover() { tone(660, 0.08, 'square', 0.09); tone(880, 0.08, 'square', 0.09, 0.06); tone(1320, 0.16, 'square', 0.08, 0.12); },
  heart() { tone(784, 0.12, 'sine', 0.16); tone(1047, 0.25, 'sine', 0.15, 0.1); },
  gift() { [523, 659, 880, 1319].forEach((f, i) => tone(f, 0.12, 'triangle', 0.13, i * 0.06)); },
  nom() { tone(390, 0.08, 'square', 0.08); tone(320, 0.1, 'square', 0.08, 0.08); },
  buy() { tone(784, 0.09, 'triangle', 0.16); tone(1175, 0.16, 'triangle', 0.15, 0.07); },
  msg() { tone(880, 0.07, 'sine', 0.08); tone(1175, 0.1, 'sine', 0.07, 0.06); },
  win() { [523, 659, 784, 1047].forEach((f, i) => tone(f, 0.22, 'triangle', 0.15, i * 0.12)); tone(1319, 0.5, 'sine', 0.13, 0.5); },
  lose() { [392, 330, 262, 196].forEach((f, i) => tone(f, 0.3, 'triangle', 0.13, i * 0.18)); },
  click() { tone(660, 0.07, 'sine', 0.12); },
  poof() { tone(320, 0.18, 'sine', 0.06, 0, 140); },
  count(go) { tone(go ? 880 : 523, 0.14, 'triangle', 0.14); },
};
