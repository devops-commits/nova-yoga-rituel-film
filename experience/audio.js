// Web Audio synthétique pentatonique, strictement opt-in : aucun AudioContext avant enable().
const SCALE = [0, 2, 4, 7, 9], BASE = 220;
let ctx = null, master = null, timer = 0, enabled = false, inField = true;
const active = () => enabled && inField && !document.hidden;
function note(freq, dur = 3.6, vol = 0.5) {
  const t = ctx.currentTime, o = ctx.createOscillator(), g = ctx.createGain();
  o.type = 'sine'; o.frequency.value = freq;
  g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(vol, t + 0.7); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g); g.connect(master); o.start(t); o.stop(t + dur + 0.1);
}
function loop() {
  note(BASE * [0.5, 1, 1, 2][Math.random() * 4 | 0] * 2 ** (SCALE[Math.random() * 5 | 0] / 12));
  timer = setTimeout(loop, 2400 + Math.random() * 2600);
}
function sync() {
  if (!ctx) return;
  const on = active();
  master.gain.setTargetAtTime(on ? 0.14 : 0, ctx.currentTime, 0.4);
  if (on) { ctx.resume(); if (!timer) loop(); } else { clearTimeout(timer); timer = 0; setTimeout(() => { if (!active() && ctx.state === 'running') ctx.suspend(); }, 1200); }
}
export function enable() {
  if (!ctx) {
    const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return false;
    ctx = new AC(); master = ctx.createGain(); master.gain.value = 0;
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 1800;
    master.connect(lp); lp.connect(ctx.destination);
  }
  enabled = true; sync(); return true;
}
export function disable() { enabled = false; sync(); }
export function setInField(v) { inField = v; sync(); }
export function chime(i = 0) { if (ctx && active()) [0, 2].forEach(k => note(BASE * 2 * 2 ** (SCALE[(i + k) % 5] / 12), 2.6, 0.35)); }
document.addEventListener('visibilitychange', sync);
