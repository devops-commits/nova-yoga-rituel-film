/* Scene inclusive et cinematique "Sous la peau" (film reel de 7,92 s).
   Module autonome, sans dependance, DOM progressif, degrade complet sans video.
   Export : mountFilmGuide(root, { entries, onArrival }) -> { showChoice(n), hide() }
   Contrat : entries = [{ n, name, question, threshold }]. onArrival(n) est appele
   uniquement sur action explicite de l'utilisateur.
   - au montage, root.hidden = false : le root se devoile ;
   - hide() passe root.hidden a true, met les deux videos en pause, et ne retire
     ni le DOM ni les ecouteurs : un showChoice() ulterieur redevient possible ;
   - showChoice(n) revele le root, retrouve l'entree selectionnee et lui rend le focus. */

const ASSETS = {
  lake: 'images/sous-la-peau/lac.webp',
  palm: 'images/sous-la-peau/paume.webp',
  video: 'videos/sous-la-peau-web.mp4',
  entry: n => 'images/sous-la-peau/entree-' + String(n).padStart(2, '0') + '.webp',
};

const FILM = { lakeToPalm: 2, crossStart: 2, crossEnd: 7.85, total: 7.92 };
const STEP_LAKE = 0.25;

/* Taille explicite des sept cibles carrees : 44 a 52 px selon l'ecran. */
const DROP_SIZE = 48;

/* Positions des sept reflets sur la paume, en pourcentage du cadre 16/9.
   Deux niveaux (haut et bas) qui suivent l'arc de la main, sans recouvrement :
   - meme niveau : ecart horizontal minimal de 20 % de la largeur ;
   - entre niveaux : ecart vertical minimal de 36 % de la hauteur, le cadre
     faisant 9/16 de sa largeur, soit 20,25 % de la largeur.
   A 280 px de page, le cadre fait 256 px de large et 144 px de haut :
   20 % de 256 = 51,2 px > 48 px (cible) et 20,25 % de 256 = 51,8 px > 48 px.
   L'entree n 1 repose sur la vraie goutte de la paume : x 36 %, y 59 %. */
const DROP_POS = {
  1: { x: 36, y: 59 },
  2: { x: 15, y: 30 },
  3: { x: 56, y: 66 },
  4: { x: 37, y: 23 },
  5: { x: 76, y: 63 },
  6: { x: 59, y: 24 },
  7: { x: 88, y: 26 },
};

const DEFAULT_NAMES = [
  'La chambre des appuis',
  'La galerie des échos',
  'Le sentier des lueurs',
  'L’horizon respirant',
  'L’atelier des traces',
  'Le courant suspendu',
  'Le tissage lumineux',
];

const DETAIL_POINT = {
  1: { x: 52, y: 46 }, 2: { x: 38, y: 54 }, 3: { x: 58, y: 47 },
  4: { x: 45, y: 58 }, 5: { x: 55, y: 42 }, 6: { x: 40, y: 50 }, 7: { x: 56, y: 52 },
};

const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const wrap = (v, n) => ((v % n) + n) % n;
const smooth = t => { t = clamp(t, 0, 1); return t * t * (3 - 2 * t); };
const step = (a, b, x) => smooth((x - a) / (b - a || 1));
const pad2 = n => String(n).padStart(2, '0');
const fr = (v, d) => v.toFixed(d === undefined ? 2 : d).replace('.', ',');

function normalizeEntries(list) {
  const src = Array.isArray(list) ? list : [];
  const byN = new Map();
  src.forEach((e, i) => {
    if (!e) return;
    const n = Number(e.n);
    const idx = (Number.isFinite(n) && n >= 1 && n <= 7) ? n - 1 : i;
    byN.set(idx, {
      n: (Number.isFinite(n) && n >= 1 && n <= 7) ? n : idx + 1,
      name: e.name || DEFAULT_NAMES[idx] || 'Entrée ' + (idx + 1),
      question: e.question || '',
      threshold: e.threshold || '',
    });
  });
  const out = [];
  for (let i = 0; i < 7; i++) {
    out.push(byN.get(i) || {
      n: i + 1,
      name: DEFAULT_NAMES[i] || 'Entrée ' + (i + 1),
      question: '',
      threshold: '',
    });
  }
  return out;
}

function calmNow() {
  return (document.body && document.body.classList.contains('motion-off')) ||
    (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
}

export function mountFilmGuide(root, options = {}) {
  if (!root || typeof root.appendChild !== 'function') return null;

  const entries = normalizeEntries(options.entries);
  const onArrival = typeof options.onArrival === 'function' ? options.onArrival : () => {};

  const S = {
    phase: 'lac',      // lac | palm | cross
    cran: 0,
    lakeT: 0,          // 0..2 s : progression lac vers paume
    p: 0,              // 0..1  : progression de traversée
    calm: calmNow(),
    videoOk: false,       // metadonnees du film du lac
    videoDecoded: false,  // video de traversee decodable
    playing: false,
    dead: false,
    hidden: false,
    seekAt: 0,            // horodatage du dernier seek du film du lac
    seekTarget: null,     // temps vise dans la video de traversee
    seekForce: true,      // le prochain seek passe outre le bridage
    lastSeek: 0,
  };

  root.classList.add('fg-root');
  root.setAttribute('role', 'region');
  root.setAttribute('aria-label', 'Sous la peau, le choix des Sept Entrées');
  /* Le root se devoile au montage. */
  root.hidden = false;

  const wrap = document.createElement('div');
  wrap.className = 'fg-wrap';
  root.appendChild(wrap);

  const mk = (tag, cls, txt) => {
    const n = document.createElement(tag);
    if (cls) n.className = cls;
    if (txt != null) n.textContent = txt;
    return n;
  };
  const mkBtn = (cls, label, onClick) => {
    const b = mk('button', cls, label);
    b.type = 'button';
    b.addEventListener('click', onClick);
    return b;
  };
  const mkImg = (cls, src, alt) => {
    const i = mk('img', cls);
    i.src = src;
    i.alt = alt || '';
    i.decoding = 'async';
    i.loading = 'lazy';
    return i;
  };

  const live = mk('p', 'fg-live');
  live.setAttribute('role', 'status');
  live.setAttribute('aria-live', 'polite');
  const announce = txt => { live.textContent = txt; };

  /* ---------- Phase lac ---------- */
  const lac = mk('div', 'fg-lac');
  const lacStage = mk('div', 'fg-lac-stage');
  const imgLake = mkImg('fg-lac-img', ASSETS.lake, 'Le lac, premier plan de Sous la peau');
  const imgPalmFade = mkImg('fg-lac-img fg-lac-palm', ASSETS.palm, '');
  imgPalmFade.setAttribute('aria-hidden', 'true');
  const film = mk('video', 'fg-film');
  film.muted = true;
  film.setAttribute('muted', '');
  film.setAttribute('playsinline', '');
  film.setAttribute('aria-hidden', 'true');
  film.setAttribute('tabindex', '-1');
  film.preload = 'metadata';
  film.src = ASSETS.video;
  lacStage.appendChild(imgLake);
  lacStage.appendChild(imgPalmFade);
  lacStage.appendChild(film);

  const lacUi = mk('div', 'fg-lac-ui');
  lacUi.appendChild(mk('h2', 'fg-title', 'Sous la peau'));
  lacUi.appendChild(mk('p', 'fg-lede',
    'Un lac, une paume, sept reflets. La traversée commence sur la peau du monde.'));

  const scrub = mk('div', 'fg-scrub');
  scrub.setAttribute('role', 'group');
  scrub.setAttribute('aria-label', 'Progression du plan, du lac vers la paume');
  const btnPrev = mkBtn('fg-btn fg-btn-ghost', 'Précédent', () => nudgeLake(-STEP_LAKE));
  const btnPlay = mkBtn('fg-btn fg-btn-ghost', 'Lecture courte', () => togglePlay());
  const btnNext = mkBtn('fg-btn fg-btn-ghost', 'Suivant', () => nudgeLake(STEP_LAKE));
  const scrubVal = mk('span', 'fg-scrub-val', '0,00 s / 2,00 s');
  scrub.appendChild(btnPrev);
  scrub.appendChild(btnPlay);
  scrub.appendChild(btnNext);
  scrub.appendChild(scrubVal);
  lacUi.appendChild(scrub);

  const btnDiscover = mkBtn('fg-btn fg-btn-primary', 'Découvrir les Entrées', () => {
    setPhase('palm');
    selectCran(S.cran, true);
    scrollToPalm();
    announce('Sept reflets sur la paume. Choisissez une Entrée, puis entrez.');
  });
  lacUi.appendChild(btnDiscover);
  lac.appendChild(lacStage);
  lac.appendChild(lacUi);

  /* ---------- Phase paume ---------- */
  const palm = mk('div', 'fg-palm');
  palm.hidden = true;
  const palmFrame = mk('div', 'fg-palm-frame');
  /* Le calque de fond et le calque des reflets partagent exactement le meme
     cadre 16/9, identique au ratio de l'image de fond de la paume. */
  const palmMedia = mk('div', 'fg-palm-media');
  const imgPalm = mkImg('fg-img', ASSETS.palm, 'La paume ouverte, où sont posés les sept reflets');
  palmMedia.appendChild(imgPalm);
  const palmLayer = mk('div', 'fg-palm-layer');
  const drops = mk('div', 'fg-drops');
  palmLayer.appendChild(drops);
  palmFrame.appendChild(palmMedia);
  palmFrame.appendChild(palmLayer);

  const panel = mk('aside', 'fg-panel');
  const panelIdx = mk('p', 'fg-panel-idx', 'Entrée 01 sur 07');
  const panelTitle = mk('h3', 'fg-panel-title', '');
  const panelQ = mk('p', 'fg-panel-q', '');
  const panelTh = mk('p', 'fg-panel-th', '');
  const panelActions = mk('div', 'fg-panel-actions');
  const btnPrevCran = mkBtn('fg-btn fg-btn-ghost', 'Précédent', () => stepCran(-1, true));
  const btnNextCran = mkBtn('fg-btn fg-btn-ghost', 'Suivant', () => stepCran(1, true));
  const btnEnter = mkBtn('fg-btn fg-btn-primary', 'Entrer', () => startCross());
  const btnBackLake = mkBtn('fg-btn fg-btn-ghost', 'Revenir au lac', () => {
    setPhase('lac');
    btnDiscover.focus({ preventScroll: true });
    announce('Vous revenez au lac.');
  });
  panelActions.appendChild(btnPrevCran);
  panelActions.appendChild(btnNextCran);
  panelActions.appendChild(btnEnter);
  panelActions.appendChild(btnBackLake);
  panel.appendChild(panelIdx);
  panel.appendChild(panelTitle);
  panel.appendChild(panelQ);
  panel.appendChild(panelTh);
  panel.appendChild(panelActions);

  const palmGrid = mk('div', 'fg-palm-grid');
  palmGrid.appendChild(palmFrame);
  palmGrid.appendChild(panel);
  palm.appendChild(palmGrid);

  const dropBtns = [];
  entries.forEach((e, i) => {
    const pos = DROP_POS[e.n] || { x: 50, y: 50 };
    const b = mk('button', 'fg-drop');
    b.type = 'button';
    b.style.left = pos.x.toFixed(2) + '%';
    b.style.top = pos.y.toFixed(2) + '%';
    /* Repere de niveau et de bord, pour que l'infobulle reste dans le cadre. */
    b.classList.toggle('is-top', pos.y < 45);
    b.classList.toggle('is-left', pos.x < 32);
    b.classList.toggle('is-right', pos.x > 68);
    b.setAttribute('aria-label', 'Entrée ' + pad2(e.n) + ' : ' + e.name);
    b.setAttribute('aria-pressed', 'false');
    const media = mk('span', 'fg-drop-media');
    const thumb = mkImg('fg-drop-thumb', ASSETS.entry(e.n), '');
    thumb.setAttribute('aria-hidden', 'true');
    media.appendChild(thumb);
    b.appendChild(media);
    const tip = mk('span', 'fg-drop-tip', e.name);
    tip.setAttribute('aria-hidden', 'true');
    b.appendChild(tip);
    b.addEventListener('click', () => selectCran(i, true));
    b.addEventListener('focus', () => selectCran(i, false));
    drops.appendChild(b);
    dropBtns.push(b);
  });

  /* ---------- Phase traversée ---------- */
  const cross = mk('div', 'fg-cross');
  cross.hidden = true;
  const track = mk('div', 'fg-cross-track');
  const sticky = mk('div', 'fg-cross-sticky');
  sticky.setAttribute('tabindex', '-1');

  const scenes = mk('div', 'fg-scenes');
  const scenePalm = mk('div', 'fg-scene fg-scene-palm');
  const imgScenePalm = mkImg('fg-scene-img', ASSETS.palm, '');
  scenePalm.appendChild(imgScenePalm);
  const sceneDepth = mk('div', 'fg-scene fg-scene-depth');
  const imgSceneDepth = mkImg('fg-scene-img', ASSETS.entry(1), '');
  sceneDepth.appendChild(imgSceneDepth);
  const sceneEntry = mk('div', 'fg-scene fg-scene-entry');
  const imgSceneEntry = mkImg('fg-scene-img', ASSETS.entry(1), '');
  sceneEntry.appendChild(imgSceneEntry);
  const sceneDetail = mk('div', 'fg-scene fg-scene-detail');
  const imgSceneDetail = mkImg('fg-scene-img', ASSETS.entry(1), '');
  sceneDetail.appendChild(imgSceneDetail);
  const sceneVideo = mk('div', 'fg-scene fg-scene-video');
  sceneVideo.hidden = true;
  const crossVideo = mk('video', 'fg-scene-img fg-scene-video-el');
  crossVideo.muted = true;
  crossVideo.setAttribute('muted', '');
  crossVideo.setAttribute('playsinline', '');
  crossVideo.setAttribute('aria-hidden', 'true');
  crossVideo.preload = 'auto';
  crossVideo.src = ASSETS.video;
  sceneVideo.appendChild(crossVideo);
  const veil = mk('div', 'fg-veil');
  scenes.appendChild(scenePalm);
  scenes.appendChild(sceneDepth);
  scenes.appendChild(sceneEntry);
  scenes.appendChild(sceneDetail);
  scenes.appendChild(sceneVideo);
  scenes.appendChild(veil);

  const hud = mk('div', 'fg-hud');
  const hudTop = mk('div', 'fg-hud-top');
  hudTop.appendChild(mk('p', 'fg-hud-brand', 'Sous la peau'));
  const hudTitle = mk('h3', 'fg-hud-title', '');
  hudTop.appendChild(hudTitle);

  const progWrap = mk('div', 'fg-progress');
  progWrap.setAttribute('role', 'progressbar');
  progWrap.setAttribute('aria-valuemin', '0');
  progWrap.setAttribute('aria-valuemax', '100');
  progWrap.setAttribute('aria-valuenow', '0');
  progWrap.setAttribute('aria-label', 'Progression de la traversée');
  const progBar = mk('span', 'fg-progress-bar');
  progWrap.appendChild(progBar);
  const progLabel = mk('p', 'fg-progress-label', 'Traversée 0 %');

  const actions = mk('div', 'fg-actions');
  const btnBack = mkBtn('fg-btn fg-btn-ghost', 'Reculer', () => setP(S.p - 0.14));
  const btnFwd = mkBtn('fg-btn fg-btn-ghost', 'Avancer', () => setP(S.p + 0.14));
  const btnExplore = mkBtn('fg-btn fg-btn-primary', 'Explorer ce monde', () => arrive());
  btnExplore.disabled = true;
  const btnSkip = mkBtn('fg-btn fg-btn-ghost', 'Passer la traversée', () => {
    setP(1, false);
    arrive();
  });
  const btnReturn = mkBtn('fg-btn fg-btn-ghost', 'Retour aux reflets', () => backToPalm());
  actions.appendChild(btnBack);
  actions.appendChild(btnFwd);
  actions.appendChild(btnExplore);
  actions.appendChild(btnSkip);
  actions.appendChild(btnReturn);

  hud.appendChild(hudTop);
  hud.appendChild(progWrap);
  hud.appendChild(progLabel);
  hud.appendChild(actions);
  sticky.appendChild(scenes);
  sticky.appendChild(hud);
  track.appendChild(sticky);
  cross.appendChild(track);

  wrap.appendChild(lac);
  wrap.appendChild(palm);
  wrap.appendChild(cross);
  wrap.appendChild(live);

  /* ---------- video : etat et repli ---------- */
  film.addEventListener('loadedmetadata', () => {
    S.videoOk = !!film.duration && isFinite(film.duration) && film.duration > 0.5;
    updateLake();
  });
  film.addEventListener('error', () => { S.videoOk = false; updateLake(); });
  film.addEventListener('play', () => {
    /* Le film du lac ne tourne que sur action explicite, phase lac seulement. */
    if (S.phase !== 'lac' || S.hidden) { try { film.pause(); } catch (err) { /* ignore */ } }
  });
  crossVideo.addEventListener('canplay', () => {
    S.videoDecoded = true;
    S.seekForce = true;
    updateVideoScene();
    applyPendingSeek();
  });
  crossVideo.addEventListener('loadeddata', () => { S.videoDecoded = true; updateVideoScene(); });
  crossVideo.addEventListener('error', () => {
    S.videoDecoded = false;
    S.seekTarget = null;
    sceneVideo.hidden = true;
    applyProgress();
  });
  crossVideo.addEventListener('play', () => {
    /* Aucune lecture automatique dans la traversée : la video reste cadree. */
    try { crossVideo.pause(); } catch (err) { /* ignore */ }
  });
  film.addEventListener('timeupdate', () => {
    if (!S.playing) return;
    if (film.currentTime >= FILM.lakeToPalm || film.currentTime >= S.lakeT + 1.2) {
      film.pause();
      S.playing = false;
      S.lakeT = clamp(film.currentTime, 0, FILM.lakeToPalm);
      updateLake();
    }
  });
  film.addEventListener('ended', () => { S.playing = false; updateLake(); });

  /* ---------- lac ---------- */
  function nudgeLake(d) {
    S.lakeT = clamp(S.lakeT + d, 0, FILM.lakeToPalm);
    updateLake();
    announce('Plan à ' + fr(S.lakeT) + ' seconde' + (S.lakeT > 1 ? 's' : '') + '.');
  }
  function togglePlay() {
    if (!S.videoOk) {
      announce('Le film n’est pas disponible ici. L’aperçu fixe reste utilisable.');
      return;
    }
    if (S.playing) {
      film.pause(); S.playing = false; updateLake(); return;
    }
    if (S.lakeT >= FILM.lakeToPalm) S.lakeT = 0;
    try { film.currentTime = S.lakeT; } catch (err) { /* ignore */ }
    const pr = film.play();
    if (pr && pr.catch) pr.catch(() => { S.playing = false; updateLake(); });
    S.playing = true;
    updateLake();
  }
  function updateLake() {
    const q = clamp(S.lakeT / FILM.lakeToPalm, 0, 1);
    imgPalmFade.style.opacity = q.toFixed(3);
    film.style.opacity = S.videoOk ? (q * 0.92).toFixed(3) : '0';
    btnPlay.textContent = S.playing ? 'Pause' : 'Lecture courte';
    if (!S.videoOk) {
      scrubVal.textContent = 'Aperçu fixe (film indisponible)';
      return;
    }
    scrubVal.textContent = fr(S.lakeT) + ' s / 2,00 s';
    if (Math.abs(film.currentTime - S.lakeT) > 0.06) {
      const now = performance.now();
      if (now - S.seekAt > 90) { S.seekAt = now; try { film.currentTime = S.lakeT; } catch (err) { /* ignore */ } }
    }
  }

  /* ---------- paume ---------- */
  /* Taille de cible explicite : 48 px en grand ecran, 44 px sur petit ecran. */
  function syncDropSize() {
    const s = (window.innerWidth || 1024) <= 520 ? 44 : DROP_SIZE;
    palmFrame.style.setProperty('--fg-drop-size', s + 'px');
  }
  syncDropSize();

  function stepCran(d, focus) {
    const idx = wrap(S.cran + d, entries.length);
    selectCran(idx, focus);
    announce('Entrée ' + pad2(entries[idx].n) + ' : ' + entries[idx].name + '.');
  }

  function selectCran(i, focus) {
    const idx = clamp(i, 0, entries.length - 1);
    S.cran = idx;
    const e = entries[idx];
    panelIdx.textContent = 'Entrée ' + pad2(e.n) + ' sur 07';
    panelTitle.textContent = e.name;
    panelQ.textContent = e.question || 'Que garde la paume de ce monde ?';
    panelTh.textContent = e.threshold ? 'Seuil : ' + e.threshold : '';
    panelTh.hidden = !e.threshold;
    dropBtns.forEach((b, k) => {
      const on = k === idx;
      b.setAttribute('aria-pressed', on ? 'true' : 'false');
      b.classList.toggle('is-on', on);
    });
    if (focus && dropBtns[idx]) dropBtns[idx].focus({ preventScroll: true });
  }

  /* ---------- traversée ---------- */
  function currentEntry() { return entries[S.cran]; }

  function useVideoScene() {
    return S.phase === 'cross' && currentEntry().n === 1 && S.videoDecoded && !S.calm && !S.hidden;
  }

  function updateVideoScene() {
    const use = useVideoScene();
    sceneVideo.hidden = !use;
    sceneVideo.style.opacity = use ? '1' : '0';
    if (!use) {
      try { crossVideo.pause(); } catch (err) { /* ignore */ }
      S.seekTarget = null;
    }
  }

  function requestSeek(t, force) {
    S.seekTarget = t;
    if (force) S.seekForce = true;
  }

  /* Le seek en attente est toujours applique, meme si le defilement s'arrete
     pendant le bridage : la boucle rAF le reprend des que le delai passe. */
  function applyPendingSeek() {
    if (S.seekTarget == null || !S.videoDecoded) return;
    const now = performance.now();
    if (!S.seekForce && now - S.lastSeek < 90) return;
    const diff = Math.abs(crossVideo.currentTime - S.seekTarget);
    if (diff < 0.01) { S.seekForce = false; S.lastSeek = now; return; }
    S.lastSeek = now;
    S.seekForce = false;
    try { crossVideo.currentTime = S.seekTarget; } catch (err) { /* ignore */ }
  }

  function prepareCross() {
    const e = currentEntry();
    const src = ASSETS.entry(e.n);
    imgSceneEntry.src = src;
    imgSceneDepth.src = src;
    imgSceneDetail.src = src;
    hudTitle.textContent = 'Entrée ' + pad2(e.n) + ' - ' + e.name;
    const det = DETAIL_POINT[e.n] || { x: 50, y: 50 };
    sceneDetail.style.setProperty('--fg-dx', det.x + '%');
    sceneDetail.style.setProperty('--fg-dy', det.y + '%');
    sceneDetail.style.transformOrigin = det.x + '% ' + det.y + '%';
    const pos = DROP_POS[e.n] || { x: 50, y: 50 };
    scenePalm.style.transformOrigin = pos.x + '% ' + pos.y + '%';
    updateVideoScene();
    /* Premier seek : il part tout de suite, hors bridage. */
    if (useVideoScene()) requestSeek(FILM.crossStart, true);
  }

  function trackSpan() {
    const r = track.getBoundingClientRect();
    const vh = window.innerHeight || 1;
    return { top: r.top + (window.pageYOffset || 0), height: r.height, span: Math.max(0, r.height - vh) };
  }

  function readProgress() {
    if (S.calm) return S.p;
    const r = track.getBoundingClientRect();
    const vh = window.innerHeight || 1;
    const span = r.height - vh;
    if (span <= 1) return 0;
    return clamp(-r.top / span, 0, 1);
  }

  function setP(p, scroll) {
    S.p = clamp(p, 0, 1);
    if (scroll !== false && !S.calm) {
      const g = trackSpan();
      if (g.span > 1) {
        const top = g.top + S.p * g.span;
        try { window.scrollTo({ top, behavior: S.calm ? 'auto' : 'smooth' }); }
        catch (err) { window.scrollTo(0, top); }
      }
    }
    applyProgress();
  }

  function applyProgress() {
    const p = S.p;
    if (S.calm) {
      /* Mode calme : images fixes, aucune animation, pas de video. */
      scenePalm.style.opacity = '0';
      scenePalm.style.transform = 'none';
      sceneDepth.style.opacity = '0';
      sceneDepth.style.transform = 'none';
      sceneEntry.style.opacity = '1';
      sceneEntry.style.transform = 'none';
      sceneDetail.style.opacity = '0';
      sceneDetail.style.transform = 'none';
      sceneDetail.style.clipPath = 'none';
      sceneDetail.style.webkitClipPath = 'none';
      veil.style.opacity = '0';
      sceneVideo.hidden = true;
      sceneVideo.style.opacity = '0';
      S.seekTarget = null;
      const pctCalm = Math.round(p * 100);
      progBar.style.width = pctCalm + '%';
      progWrap.setAttribute('aria-valuenow', String(pctCalm));
      progLabel.textContent = 'Traversée ' + pctCalm + ' %';
      btnExplore.disabled = p < 0.985;
      return;
    }
    const palmOut = 1 - step(0.04, 0.34, p);
    scenePalm.style.opacity = palmOut.toFixed(3);
    scenePalm.style.transform = 'scale(' + (1.12 + 1.55 * p).toFixed(3) + ')';

    const eIn = step(0.2, 0.5, p);
    const u = step(0.2, 1, p);
    sceneEntry.style.opacity = eIn.toFixed(3);
    sceneEntry.style.transform = 'scale(' + (0.86 + 0.26 * u).toFixed(3) + ')';

    sceneDepth.style.opacity = (eIn * 0.8).toFixed(3);
    sceneDepth.style.transform = 'scale(' + (0.92 + 0.42 * u).toFixed(3) + ') translateX(' + (-3 + 6 * u).toFixed(2) + '%)';

    const dIn = step(0.42, 0.62, p);
    sceneDetail.style.opacity = dIn.toFixed(3);
    sceneDetail.style.transform = 'scale(2.35)';
    const circle = 'circle(' + (step(0.42, 1, p) * 74).toFixed(2) + '% at var(--fg-dx, 50%) var(--fg-dy, 50%))';
    sceneDetail.style.clipPath = circle;
    sceneDetail.style.webkitClipPath = circle;

    veil.style.opacity = ((1 - step(0.08, 0.42, p)) * 0.72).toFixed(3);

    if (useVideoScene()) {
      const want = FILM.crossStart + (FILM.crossEnd - FILM.crossStart) * p;
      /* Dernier seek force quand la traversée arrive au bout. */
      requestSeek(want, p >= 0.995);
      sceneVideo.hidden = false;
      sceneVideo.style.opacity = '1';
    } else {
      sceneVideo.hidden = true;
      sceneVideo.style.opacity = '0';
      S.seekTarget = null;
    }

    const pct = Math.round(p * 100);
    progBar.style.width = pct + '%';
    progWrap.setAttribute('aria-valuenow', String(pct));
    progLabel.textContent = 'Traversée ' + pct + ' %';
    btnExplore.disabled = p < 0.985;
  }

  function startCross() {
    setPhase('cross');
    S.p = 0;
    prepareCross();
    applyProgress();
    const g = trackSpan();
    if (!S.calm && g.span > 1) {
      try { window.scrollTo({ top: g.top, behavior: 'auto' }); } catch (err) { window.scrollTo(0, g.top); }
    }
    sticky.focus({ preventScroll: true });
    announce('Traversée vers ' + currentEntry().name + '. Faites défiler la page ou utilisez les flèches pour avancer.');
  }

  function backToPalm() {
    setPhase('palm');
    selectCran(S.cran, true);
    scrollToPalm();
    announce('Retour aux reflets. Entrée ' + pad2(currentEntry().n) + ' sélectionnée.');
  }

  function scrollToPalm() {
    const r = palm.getBoundingClientRect();
    const top = r.top + (window.pageYOffset || 0) - 76;
    try { window.scrollTo({ top, behavior: S.calm ? 'auto' : 'smooth' }); } catch (err) { window.scrollTo(0, top); }
  }

  function arrive() {
    const e = currentEntry();
    try { onArrival(e.n); } catch (err) { /* l orchestrateur decide de la suite */ }
    announce('Vous êtes arrivé dans ' + e.name + '.');
  }

  function setPhase(phase) {
    S.phase = phase;
    lac.hidden = phase !== 'lac';
    palm.hidden = phase !== 'palm';
    cross.hidden = phase !== 'cross';
    wrap.classList.toggle('is-cross', phase === 'cross');
    if (phase !== 'cross') {
      try { crossVideo.pause(); } catch (err) { /* ignore */ }
      S.seekTarget = null;
    }
    if (phase !== 'lac') {
      try { film.pause(); } catch (err) { /* ignore */ }
      S.playing = false;
    }
    if (phase === 'cross') updateVideoScene();
  }

  /* ---------- gestes tactiles horizontaux sur la paume (scroll vertical conserve) ---------- */
  let gStart = null;
  palmFrame.addEventListener('pointerdown', ev => {
    if (ev.pointerType === 'mouse') return;
    gStart = { x: ev.clientX, y: ev.clientY };
  }, { passive: true });
  palmFrame.addEventListener('pointerup', ev => {
    if (!gStart) return;
    const dx = ev.clientX - gStart.x, dy = ev.clientY - gStart.y;
    gStart = null;
    if (Math.abs(dx) < 46 || Math.abs(dx) < Math.abs(dy) * 1.35) return;
    stepCran(dx < 0 ? 1 : -1, true);
  }, { passive: true });
  palmFrame.addEventListener('pointercancel', () => { gStart = null; }, { passive: true });

  /* ---------- clavier ---------- */
  wrap.addEventListener('keydown', ev => {
    const k = ev.key;
    if (S.phase === 'lac') {
      if (k === 'ArrowRight') { ev.preventDefault(); nudgeLake(STEP_LAKE); }
      else if (k === 'ArrowLeft') { ev.preventDefault(); nudgeLake(-STEP_LAKE); }
      return;
    }
    if (S.phase === 'palm') {
      if (k === 'ArrowRight') { ev.preventDefault(); stepCran(1, true); }
      else if (k === 'ArrowLeft') { ev.preventDefault(); stepCran(-1, true); }
      else if (k === 'Home') { ev.preventDefault(); selectCran(0, true); }
      else if (k === 'End') { ev.preventDefault(); selectCran(entries.length - 1, true); }
      return;
    }
    if (S.phase === 'cross') {
      if (k === 'Escape') { ev.preventDefault(); backToPalm(); return; }
      if (k === 'ArrowDown' || k === 'PageDown') { ev.preventDefault(); setP(S.p + (k === 'PageDown' ? 0.28 : 0.12)); }
      else if (k === 'ArrowUp' || k === 'PageUp') { ev.preventDefault(); setP(S.p - (k === 'PageUp' ? 0.28 : 0.12)); }
      else if (k === 'Home') { ev.preventDefault(); setP(0); }
      else if (k === 'End') { ev.preventDefault(); setP(1); }
    }
  });

  /* ---------- defilement natif : aucun vol de roue ---------- */
  let raf = 0;
  function onScroll() {
    if (raf) return;
    raf = requestAnimationFrame(() => {
      raf = 0;
      if (S.dead || S.hidden || S.phase !== 'cross') return;
      const p = readProgress();
      if (Math.abs(p - S.p) > 0.0005) { S.p = p; applyProgress(); }
    });
  }
  window.addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener('resize', () => {
    if (S.dead) return;
    syncDropSize();
    if (S.hidden) return;
    if (S.phase === 'cross') { S.p = readProgress(); applyProgress(); }
    updateLake();
  });
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      try { film.pause(); crossVideo.pause(); } catch (err) { /* ignore */ }
      S.playing = false;
    }
  });

  /* Boucle rAF : garantit que le premier et le dernier seek de la video sont
     bien sollicites, meme si le defilement s'arrete pendant le bridage. */
  function tick() {
    requestAnimationFrame(tick);
    if (S.dead || S.hidden) return;
    if (S.phase === 'cross') applyPendingSeek();
  }
  requestAnimationFrame(tick);

  /* ---------- mode calme ---------- */
  const mq = window.matchMedia ? window.matchMedia('(prefers-reduced-motion: reduce)') : null;
  function syncCalm() {
    const wasCalm = S.calm;
    S.calm = calmNow();
    wrap.classList.toggle('fg-calm', S.calm);
    if (S.calm && !wasCalm) {
      /* La video disparait des que le mouvement reduit s'active. */
      try { crossVideo.pause(); } catch (err) { /* ignore */ }
      S.seekTarget = null;
      sceneVideo.hidden = true;
    }
    if (S.phase === 'cross') { updateVideoScene(); applyProgress(); }
    else updateVideoScene();
  }
  if (mq) {
    const onMq = () => syncCalm();
    if (mq.addEventListener) mq.addEventListener('change', onMq);
    else if (mq.addListener) mq.addListener(onMq);
  }
  const mo = new MutationObserver(syncCalm);
  mo.observe(document.body, { attributes: true, attributeFilter: ['class'] });
  syncCalm();

  /* ---------- API publique ---------- */
  function showChoice(n) {
    if (S.dead) return;
    /* Le root redevient visible, la selection est retrouvee et le focus revient. */
    root.hidden = false;
    S.hidden = false;
    const num = Number(n);
    let idx = entries.findIndex(e => e.n === num);
    if (idx < 0) idx = clamp((Number.isFinite(num) ? num : 1) - 1, 0, entries.length - 1);
    S.p = 0;
    setPhase('palm');
    selectCran(idx, true);
    scrollToPalm();
    announce('Entrée ' + pad2(entries[idx].n) + ' : ' + entries[idx].name + '. Vous pouvez entrer ou revenir au lac.');
  }

  function hide() {
    if (S.dead) return;
    /* Le DOM et les ecouteurs restent en place : seul le root se cache. */
    S.hidden = true;
    root.hidden = true;
    try { film.pause(); } catch (err) { /* ignore */ }
    try { crossVideo.pause(); } catch (err) { /* ignore */ }
    S.playing = false;
    S.seekTarget = null;
    sceneVideo.hidden = true;
  }

  /* ---------- init ---------- */
  setPhase('lac');
  selectCran(0, false);
  updateLake();
  applyProgress();
  root.hidden = false;

  return { showChoice, hide };
}
