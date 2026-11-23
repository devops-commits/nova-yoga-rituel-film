// Liens profonds : #portes (alias) → #entrees, #entree-N, #entree-N/fragment-M
const RE = /^#entree-([1-7])(?:\/fragment-([1-6]))?$/;
let actions = null;
export function parse(hash = location.hash) {
  if (hash === '#portes') return { kind: 'alias' };
  if (hash === '#entrees') return { kind: 'entrees' };
  const m = RE.exec(hash);
  if (m) return { kind: m[2] ? 'fragment' : 'entree', n: +m[1], m: m[2] ? +m[2] : null };
  return { kind: 'other' };
}
export function normalizeAlias() { if (parse().kind === 'alias') history.replaceState(history.state, '', '#entrees'); }
function sync(initial) {
  const p = parse(), s = history.state, first = initial === true;
  if (p.kind === 'alias') { history.replaceState(null, '', '#entrees'); return actions.orbit(null, { scroll: true }); }
  if (p.kind === 'entrees') return actions.orbit(null, { scroll: false });
  if (p.kind === 'entree') return s && s.ny === 'world' ? actions.world(p.n, null, { instant: first }) : actions.orbit(p.n, { scroll: true });
  if (p.kind === 'fragment') return actions.world(p.n, p.m, { instant: first });
  if (!first) actions.away();
}
export function initRouter(a) { actions = a; normalizeAlias(); addEventListener('popstate', sync); sync(true); }
export const pushWorld = n => history.pushState({ ny: 'world', n }, '', `#entree-${n}`);
export const pushFragment = (n, m) => history.pushState({ ny: 'fragment', n, m }, '', `#entree-${n}/fragment-${m}`);
export const replace = hash => history.replaceState(null, '', hash);
// Échap intelligent : history.back() si un état a été poussé, sinon transition directe.
export function escape() { if (history.state && history.state.ny) history.back(); else actions.escapeDirect(); }
export function exitWorld() {
  const s = history.state;
  if (s && s.ny === 'fragment') history.go(-2); else if (s && s.ny === 'world') history.back(); else actions.escapeDirect(true);
}
// Repli sans WebGL : alias + défilement vers la section classique.
export function initFallback() {
  const run = () => { normalizeAlias(); if (/^(entree|fragment)$/.test(parse().kind)) { const el = document.getElementById('entrees'); if (el) el.scrollIntoView(); } };
  addEventListener('hashchange', run); run();
}
