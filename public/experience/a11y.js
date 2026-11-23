// Annonces aria-live, clavier (← → Entrée Échap R), focus, ancrage respiratoire 4 s / 6 s.
import { store } from './state.js';
let live = null, h = {}, breathing = false;
export function announce(msg) { if (!live) return; live.textContent = ''; requestAnimationFrame(() => { live.textContent = msg; }); }
export function saveFocus() { const a = document.activeElement; return a && a.id ? a.id : 'btnEnter'; }
export function focusId(id) { const el = id && document.getElementById(id); if (el) el.focus({ preventScroll: true }); }
const sleep = ms => new Promise(r => setTimeout(r, ms));
export async function breath() {
  if (breathing) return; breathing = true;
  const cue = document.getElementById('breathCue'), run = async (label, ms, cls, to) => {
    if (cue) { cue.hidden = false; cue.textContent = label; cue.className = 'breath-cue ' + cls; cue.style.transitionDuration = ms + 'ms'; }
    announce(label);
    const t0 = performance.now(), from = to ? 0 : 1;
    while (performance.now() - t0 < ms) { const k = (performance.now() - t0) / ms; if (h.onBreath && !store.motionReduced) h.onBreath(from + (to - from) * k); await sleep(32); }
  };
  await run('Inspirez… quatre secondes', 4000, 'in', 1);
  await run('Expirez… six secondes', 6000, 'out', 0);
  if (h.onBreath) h.onBreath(0);
  if (cue) cue.hidden = true;
  announce('Ancrage terminé.'); breathing = false;
}
export function initA11y(handlers) {
  h = handlers; live = document.getElementById('stageLive');
  addEventListener('keydown', e => {
    if (e.defaultPrevented || e.altKey || e.ctrlKey || e.metaKey || !store.webglReady) return;
    const el = e.target, tag = el.tagName, typing = /^(INPUT|TEXTAREA|SELECT)$/.test(tag) || el.isContentEditable;
    if (typing) return;
    const s = store.state, orbit = s === 'ORBIT' || s === 'MACRO';
    if (e.key === 'Escape') { if (s === 'CROSSING' || s === 'WORLD') { e.preventDefault(); h.onEscape(); } return; }
    if (!h.inView()) return;
    if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
      const dir = e.key === 'ArrowRight' ? 1 : -1;
      if (orbit) { e.preventDefault(); h.onStep(dir); } else if (s === 'WORLD' && !store.fragment) { e.preventDefault(); h.onGlide(dir); }
    } else if (e.key === 'Enter' && orbit && !/^(BUTTON|A)$/.test(tag)) { e.preventDefault(); h.onEnter(); }
    else if ((e.key === 'r' || e.key === 'R') && s !== 'CROSSING' && s !== 'RETURN') breath();
  });
}
