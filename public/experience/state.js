// Store unique + machine à états FILM → ORBIT ↔ MACRO → CROSSING → WORLD → RETURN → ORBIT
const FLOW = { FILM: ['ORBIT'], ORBIT: ['FILM', 'MACRO', 'CROSSING'], MACRO: ['ORBIT', 'CROSSING'], CROSSING: ['WORLD', 'RETURN'], WORLD: ['RETURN'], RETURN: ['ORBIT', 'CROSSING'] };
export const store = {
  state: 'FILM', entree: 1, cran: 0, fragment: null, t: 0, macro: 0, focusId: null,
  motionReduced: matchMedia('(prefers-reduced-motion: reduce)').matches, soundEnabled: false, webglReady: false,
};
const subs = new Set();
export function subscribe(fn) { subs.add(fn); return () => subs.delete(fn); }
export function set(patch) { const prev = { ...store }; Object.assign(store, patch); subs.forEach(fn => fn(store, prev)); }
export function go(next) {
  if (store.state === next) return true;
  if (!FLOW[store.state].includes(next)) return false;
  set({ state: next }); return true;
}
export function force(state) { set({ state }); }
let ctrl = null;
export function cancelTween() { if (ctrl) ctrl.abort(); ctrl = null; }
// t progresse linéairement (l'easing vit dans la pose caméra) : l'inversion est donc exacte.
export function tweenT(to, ms, onFrame) {
  cancelTween();
  const c = ctrl = new AbortController(), from = store.t;
  if (ms <= 0 || from === to) { store.t = to; if (onFrame) onFrame(to); ctrl = null; return Promise.resolve(true); }
  return new Promise(resolve => {
    const t0 = performance.now();
    const step = now => {
      if (c.signal.aborted) return resolve(false);
      const k = Math.min(1, (now - t0) / ms);
      store.t = from + (to - from) * k; if (onFrame) onFrame(store.t);
      if (k < 1) requestAnimationFrame(step); else { if (ctrl === c) ctrl = null; resolve(true); }
    };
    requestAnimationFrame(step);
  });
}
export function wait(ms) {
  cancelTween();
  const c = ctrl = new AbortController();
  return new Promise(resolve => {
    const id = setTimeout(() => { if (ctrl === c) ctrl = null; resolve(true); }, ms);
    c.signal.addEventListener('abort', () => { clearTimeout(id); resolve(false); });
  });
}
