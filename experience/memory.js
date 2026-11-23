// Trace poétique locale (sessionStorage) : une suite de passages, jamais de score ni de compteur.
const KEY = 'ny-trace', subs = new Set();
export function read() {
  try { const v = JSON.parse(sessionStorage.getItem(KEY) || '[]'); return Array.isArray(v) ? v.filter(s => /^[1-7](\.[1-6])?$/.test(s)) : []; } catch (e) { return []; }
}
function save(list) { try { sessionStorage.setItem(KEY, JSON.stringify(list)); } catch (e) { /* stockage indisponible */ } subs.forEach(fn => fn(list)); }
export function mark(n, m) { const id = m ? `${n}.${m}` : `${n}`; const list = read().filter(x => x !== id); list.push(id); save(list.slice(-24)); }
export function clear() { try { sessionStorage.removeItem(KEY); } catch (e) { /* idem */ } subs.forEach(fn => fn([])); }
export function onChange(fn) { subs.add(fn); }
