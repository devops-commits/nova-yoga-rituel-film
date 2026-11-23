// Mapping des 7 Entrées (noms du storyboard), couvertures, fragments Jade, textes NOVA_PARCOURS.
const L1 = [['La poussière d’étoile', 'Nova_Yoga_Porte_1_1.1_La_poussiere_d_etoile.png'], ['L’objet déposé', 'Nova_Yoga_Porte_1_1.2_L_objet_depose.png'], ['Le jardin dans la tasse', 'Nova_Yoga_Porte_1_1.3_Le_jardin_dans_la_tasse.png'], ['La lune ce soir', 'Nova_Yoga_Porte_1_1.4_La_lune_ce_soir.png'], ['Du ciel à la terre', 'Nova_Yoga_Porte_1_1.5_Du_ciel_a_la_terre.png']];
const L6 = [['En apesanteur', 'Nova_Yoga_6.1_En_apesanteur.png'], ['À travers un regard', 'Nova_Yoga_6.2_A_travers_un_regard.png'], ['Une place inattendue', 'Nova_Yoga_6.3_Une_place_inattendue.png'], ['La première vague', 'Nova_Yoga_6.4_La_premiere_vague.png'], ['Les bulles dans la lumière', 'Nova_Yoga_6.5_Les_bulles_dans_la_lumiere.png']];
const img = (dir, list) => list.map(([title, file]) => ({ title, src: `images/${dir}/${file}` }));

const TITRES = {
  "1.1": "La poussière d’étoile",
  "1.2": "L’objet déposé",
  "1.3": "Le jardin dans la tasse",
  "1.4": "La lune ce soir",
  "1.5": "Du ciel à la terre",
  "2.1": "La musique familière",
  "2.2": "L’objet précieux",
  "2.3": "Une ouverture · titre de travail",
  "2.4": "Le cadre qui s’élargit",
  "2.5": "La plume",
  "3.1": "La braise sous la cendre",
  "3.2": "La lanterne au bord du chemin",
  "3.3": "La fleur qui demeure",
  "3.4": "S’apprivoiser en silence",
  "3.5": "Une danse invisible en hiver",
  "3.6": "L’autre visage du ciel",
  "4.1": "L’espace entre deux formes",
  "4.2": "Après le froid",
  "4.3": "Le ciel sur la mer",
  "4.4": "Le silence habité",
  "4.5": "Attendre sans se perdre",
  "5.1": "La pluie sous le soleil",
  "5.2": "Au fil des émotions",
  "5.3": "Le geste qui reste",
  "5.4": "Un coup de pinceau",
  "5.5": "Le livre retrouvé",
  "6.1": "En apesanteur",
  "6.2": "À travers un regard",
  "6.3": "Une place inattendue",
  "6.4": "La première vague",
  "6.5": "Les bulles dans la lumière",
  "7.1": "La pluie de pétales",
  "7.2": "Percevoir ce qui apparaît",
  "7.3": "La résonance d’un instant",
  "7.4": "L’envol",
  "7.5": "Le tissage de lumière"
};

export const ENTREES = [
  { n: 1, name: 'La chambre des appuis', gesture: 'Déposer', tint: '#e6d3bd', world: true, art: img('entree-01', L1) },
  { n: 2, name: 'La galerie des échos', gesture: 'Faire vibrer', tint: '#cfd6c4', world: true, art: [] },
  { n: 3, name: 'Le sentier des lueurs', gesture: 'Approcher la braise', tint: '#e2c58e', world: true, art: [] },
  { n: 4, name: 'L’horizon respirant', gesture: 'Écarter', tint: '#bcd3cf', world: true, art: [] },
  { n: 5, name: 'L’atelier des traces', gesture: 'Tracer', tint: '#dcc3a8', world: true, art: [] },
  { n: 6, name: 'Le courant suspendu', gesture: 'La première vague', tint: '#a9cdbd', world: true, art: img('entree-06', L6) },
  { n: 7, name: 'Le tissage lumineux', gesture: 'Relier', tint: '#e8cf9a', world: true, art: [] },
].map(e => ({
  ...e,
  cover: `images/ny-porte-0${e.n}.jpg`,
  // Vue « planche » du film : décor de profondeur pour les mondes.
  planche: `images/sous-la-peau/entree-0${e.n}.webp`,
  // Illustrations Jade individuelles (nombres simples, sans zéros).
  fragImage: m => `images/sous-la-peau/fragments/${e.n}-${m}.webp`,
  art: e.art || [],
}));
export const pad = n => String(n).padStart(2, '0');
const cache = new Map();

// Le catalogue de Jade fournit les textes et les URL des parcours.
export function getEntree(n) {
  if (cache.has(n)) return cache.get(n);
  const base = ENTREES[n - 1];
  if (!base) return null;
  const data = window.NOVA_PARCOURS;
  const door = data?.doors[n];
  const fragments = (data?.routes || []).filter(route => route.door === n).map(route => {
    const m = Number(route.id.split('.')[1]);
    return {
      m, id: route.id, direction: route.direction, text: route.fragment,
      title: TITRES[route.id], href: `parcours/${route.file}`,
      image: base.fragImage(m), artSrc: base.art[m - 1]?.src,
    };
  });
  const entry = { ...base, question: door?.question || '', threshold: door?.threshold || '', fragments };
  cache.set(n, entry);
  return entry;
}

// Teintes extraites des couvertures (moyenne 12×12) puis harmonisées vers la palette nacre/or.
function harmonize(r, g, b) {
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b), l = (mx + mn) / 510, k = Math.min(1.6, 0.6 / Math.max(0.08, l));
  const mix = (c, gold) => Math.round(Math.min(255, c * k) * 0.68 + gold * 0.32);
  return '#' + [mix(r, 221), mix(g, 177), mix(b, 104)].map(v => v.toString(16).padStart(2, '0')).join('');
}
export function extractTints() {
  return Promise.all(ENTREES.map(e => new Promise(resolve => {
    const im = new Image();
    im.onload = () => {
      try {
        const c = document.createElement('canvas'); c.width = c.height = 12;
        const x = c.getContext('2d'); x.drawImage(im, 0, 0, 12, 12);
        const d = x.getImageData(0, 0, 12, 12).data; let r = 0, g = 0, b = 0;
        for (let i = 0; i < d.length; i += 4) { r += d[i]; g += d[i + 1]; b += d[i + 2]; }
        resolve(harmonize(r / 144, g / 144, b / 144));
      } catch (err) { resolve(e.tint); }
    };
    im.onerror = () => resolve(e.tint);
    im.src = e.cover;
  })));
}
