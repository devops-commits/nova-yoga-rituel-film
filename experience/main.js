// Orchestrateur principal Lot 1 : WebGL progressif sur Rituel, Orbite 7 Entrées, Traversées Entrées 1 & 6, DOM accessible.
import * as THREE from 'three';
import { store, set, go, force, tweenT, cancelTween, wait, subscribe } from './state.js';
import { ENTREES, getEntree, pad, extractTints } from './data-map.js';
import * as router from './router.js';
import * as memory from './memory.js';
import * as audio from './audio.js';
import { initA11y, announce, saveFocus, focusId, breath } from './a11y.js';
import { createStage } from './stage.js';
import { createOrbit } from './orbit.js';
import { createCrossing } from './crossing.js';
import { createWorld } from './worlds/demo-kit.js';
import * as mod1 from './worlds/entree-1.js';
import * as mod6 from './worlds/entree-6.js';
import { ILLUSTREES } from './worlds/entree-illustree.js';

const WORLD_MODS = { 1: mod1, 6: mod6 };
// Les cinq autres Entrées disposent d’un monde illustré 2.5D.
Object.keys(ILLUSTREES).forEach(n => { WORLD_MODS[n] = ILLUSTREES[n]; });

async function boot() {
  const host = document.getElementById('stage-3d');
  const canvas = document.getElementById('stageCanvas');
  if (!host || !canvas) { router.initFallback(); return; }

  const stage = createStage(canvas);
  if (!stage) { router.initFallback(); return; }

  document.body.classList.add('webgl-active');
  const veilEl = document.getElementById('stageVeil');
  const orbit = createOrbit(stage.scene, stage);
  const crossing = createCrossing(stage, orbit, veilEl);

  // DOM HUD & panneaux
  const elNum = document.getElementById('hudNum');
  const elName = document.getElementById('hudName');
  const elQ = document.getElementById('hudQuestion');
  const elBtnEnter = document.getElementById('btnEnter');
  const elBtnPrev = document.getElementById('btnPrevEntree');
  const elBtnNext = document.getElementById('btnNextEntree');
  const elOrbitHud = document.getElementById('orbitHud');
  const elWorldHud = document.getElementById('worldHud');
  const elWorldTitle = document.getElementById('worldTitle');
  const elWorldDemo = document.getElementById('worldDemoBanner');
  const elBtnGesture = document.getElementById('btnGesture');
  const elBtnBack = document.getElementById('btnBackOrbit');
  const elFragBar = document.getElementById('worldFragBar');
  const elFragPanel = document.getElementById('worldFragPanel');
  const elFragTitle = document.getElementById('fragPanelTitle');
  const elFragDir = document.getElementById('fragPanelDir');
  const elFragImg = document.getElementById('fragPanelImg');
  const elFragText = document.getElementById('fragPanelText');
  const elFragLink = document.getElementById('fragPanelLink');
  const elFragClose = document.getElementById('btnFragClose');
  const elBtnSound = document.getElementById('btnSound');
  const elBtnTrace = document.getElementById('btnClearTrace');
  const elBtnBreath = document.getElementById('btnBreath');
  const elFallbackBox = document.getElementById('worldFallbackBox');
  const elFallbackList = document.getElementById('worldFallbackList');
  const elSection = document.getElementById('entrees');
  const heroVideo = document.querySelector('.open video');

  let activeWorld = null, loadingN = 0, preloadTimer = 0, stageInView = false;

  // --- Destination interactive du film -------------------------------------
  // Le guide (film-guide.js, mounted par l’orchestrateur) propose les sept Entrées.
  let guide = null, guideRoot = null, guided = false, guideReady = false;
  let arrivalToken = 0, enterToken = 0, loadToken = 0;
  const worldCache = new Map(); // n -> { promise, world }

  const stageWrap = () => document.querySelector('.stage-3d-wrap');
  const stageIsOpen = () => {
    const w = stageWrap();
    return !!w && w.classList.contains('nova-world-open');
  };

  // Annonces accessibles : la scène 3D est masquée tant que le guide est visible.
  let guideLive = null;
  function ensureLive() {
    if (guideLive) return guideLive;
    guideLive = document.createElement('div');
    guideLive.id = 'guideLive';
    guideLive.className = 'sr-only';
    guideLive.setAttribute('aria-live', 'polite');
    guideLive.setAttribute('aria-atomic', 'true');
    document.body.appendChild(guideLive);
    return guideLive;
  }
  const say = msg => {
    if (!msg) return;
    if (stageIsOpen()) { announce(msg); return; }
    const el = ensureLive();
    el.textContent = '';
    requestAnimationFrame(() => { el.textContent = msg; });
  };

  // Vidéo : jamais de lecture pendant le monde.
  const pauseMedia = () => {
    if (heroVideo) { try { heroVideo.pause(); } catch (e) { /* ignoré */ } }
    if (guideRoot) guideRoot.querySelectorAll('video').forEach(v => { try { v.pause(); } catch (e) { /* ignoré */ } });
  };

  async function revealStage() {
    const wrap = stageWrap();
    if (!wrap) return;
    wrap.classList.add('nova-world-open');
    if (guided) wrap.style.display = 'block';
    await new Promise(r => requestAnimationFrame(() => r()));
    stage.resize();
    setTimeout(() => stage.resize(), 90);
    if (store.motionReduced) stage.renderNow(); else stage.start();
  }

  function hideStage() {
    const wrap = stageWrap();
    if (!wrap) return;
    wrap.classList.remove('nova-world-open');
    if (guided) wrap.style.display = 'none';
    requestAnimationFrame(() => stage.resize());
    stage.stop(); // on fige les animations tant que le guide est à l’écran
  }

  function focusGuideChoice(n) {
    if (!guide) return;
    if (typeof guide.focusChoice === 'function') { try { guide.focusChoice(n); return; } catch (e) { /* API optionnelle */ } }
    if (!guideRoot) return;
    const sel = `[data-entree="${n}"], [data-choice="${n}"], [data-n="${n}"], [data-cran="${n - 1}"]`;
    const el = guideRoot.querySelector(sel);
    if (el && el.focus) el.focus({ preventScroll: true });
  }

  function showGuide(n, focus = true) {
    if (!guide) return;
    hideStage();
    const target = n || store.entree;
    if (typeof guide.showChoice === 'function') guide.showChoice(target);
    if (focus) focusGuideChoice(target);
  }

  // Arrivée choisie dans le guide : on masque le guide, on révèle la scène, puis on entre.
  async function onArrival(n) {
    const token = ++arrivalToken;
    enterToken++;
    if (guide && typeof guide.hide === 'function') guide.hide();
    pauseMedia();
    await revealStage();
    if (token !== arrivalToken) return;
    if (elSection) elSection.scrollIntoView({ behavior: 'auto', block: 'start' });
    if (host) {
      host.setAttribute('tabindex', '-1');
      host.focus({ preventScroll: true });
    }
    await enterWorld(n, null, { instant: true, fromGuide: true });
  }

  async function mountGuide() {
    let mount = null;
    try {
      const mod = await import('./film-guide.js');
      mount = mod.mountFilmGuide || (mod.default && (mod.default.mountFilmGuide || mod.default));
    } catch (e) {
      console.warn('[Nova] film-guide.js indisponible : les liens classiques restent actifs.', e);
      return null;
    }
    if (typeof mount !== 'function') return null;
    guideRoot = document.getElementById('filmGuide');
    if (!guideRoot) {
      guideRoot = document.createElement('div');
      guideRoot.id = 'filmGuide';
      const wrap = stageWrap();
      if (wrap && wrap.parentNode) wrap.parentNode.insertBefore(guideRoot, wrap);
      else document.body.appendChild(guideRoot);
    }
    const entries = [1, 2, 3, 4, 5, 6, 7].map(n => getEntree(n)).filter(Boolean);
    const g = mount(guideRoot, { entries, onArrival });
    if (!g) return null;
    guide = g;
    guided = true;
    document.body.classList.add('nova-film-guided');
    return g;
  }

  // Synchronisation mode calme avec cinema-3d.js
  const syncMotion = () => {
    const reduced = document.body.classList.contains('motion-off') || matchMedia('(prefers-reduced-motion: reduce)').matches;
    set({ motionReduced: reduced });
    if (!stageIsOpen()) { stage.stop(); return; }
    if (reduced) stage.renderNow(); else stage.start();
  };
  new MutationObserver(syncMotion).observe(document.body, { attributes: true, attributeFilter: ['class'] });
  matchMedia('(prefers-reduced-motion: reduce)').addEventListener('change', syncMotion);

  // Extraction harmonisée des teintes des 7 couvertures
  extractTints().then(tints => orbit.applyTints(tints));

  // Mémoire poétique
  const syncMemory = list => {
    orbit.applyMemory(list);
    if (elBtnTrace) elBtnTrace.hidden = list.length === 0;
  };
  memory.onChange(syncMemory);
  syncMemory(memory.read());
  if (elBtnTrace) elBtnTrace.addEventListener('click', () => { memory.clear(); say('Trace locale effacée.'); });

  // Son strictement opt-in
  if (elBtnSound) {
    elBtnSound.addEventListener('click', () => {
      if (store.soundEnabled) {
        audio.disable();
        set({ soundEnabled: false });
        elBtnSound.setAttribute('aria-pressed', 'false');
        elBtnSound.textContent = 'Activer le son';
      } else if (audio.enable()) {
        set({ soundEnabled: true });
        elBtnSound.setAttribute('aria-pressed', 'true');
        elBtnSound.textContent = 'Couper le son';
        audio.chime(store.cran);
      }
    });
  }

  if (elBtnBreath) elBtnBreath.addEventListener('click', () => breath());

  // Un seul monde instancié en mémoire à la fois (dispose strict)
  function disposeOtherWorlds(keepN) {
    for (const [n, entry] of worldCache.entries()) {
      if (n === keepN) continue;
      if (entry && entry.world) {
        stage.scene.remove(entry.world.group);
        stage.disposeObject(entry.world.group);
      }
      worldCache.delete(n);
    }
  }

  // Chargement annulable : une nouvelle requête invalide la précédente (course de l’utilisateur).
  async function ensureWorld(n) {
    if (!WORLD_MODS[n]) return null;
    const cached = worldCache.get(n);
    if (cached) return cached.promise;
    disposeOtherWorlds(n);
    const token = ++loadToken;
    loadingN = n;
    const promise = (async () => {
      const w = await createWorld(getEntree(n), WORLD_MODS[n], { invalidate: stage.invalidate });
      if (!w) return null;
      if (token !== loadToken) { stage.disposeObject(w.group); return null; }
      stage.scene.add(w.group);
      worldCache.set(n, { promise, world: w });
      return w;
    })();
    worldCache.set(n, { promise, world: null });
    return promise;
  }

  function schedulePreload(n) {
    clearTimeout(preloadTimer);
    if (!WORLD_MODS[n]) return;
    if (!stageIsOpen()) return; // le préchargement n’a lieu que scène ouverte
    preloadTimer = setTimeout(() => { if (store.entree === n) ensureWorld(n); }, 600);
  }

  function renderHud() {
    const e = getEntree(store.entree);
    const inWorld = store.state === 'WORLD';
    const inOrbit = store.state === 'FILM' || store.state === 'ORBIT' || store.state === 'MACRO';
    if (elNum) elNum.textContent = `Entrée ${pad(e.n)}`;
    if (elName) elName.textContent = e.name;
    if (elQ) elQ.textContent = e.question;
    if (elBtnEnter) elBtnEnter.textContent = e.world ? `Entrer · ${e.name}` : `Découvrir les fragments · ${e.name}`;
    if (elOrbitHud) elOrbitHud.hidden = !inOrbit;
    if (elWorldHud) elWorldHud.hidden = !inWorld;
    if (elWorldTitle) elWorldTitle.textContent = `Entrée ${pad(e.n)} · ${e.name}`;
    if (elBtnGesture) {
      elBtnGesture.textContent = e.gesture;
      elBtnGesture.hidden = !e.world;
    }
    if (elWorldDemo) elWorldDemo.hidden = !(inWorld && activeWorld && activeWorld.procedural);
    if (elFallbackBox) elFallbackBox.hidden = true;
  }

  function selectCran(cran, instant = false) {
    const c = ((cran % 7) + 7) % 7;
    const n = c + 1;
    set({ cran: c, entree: n });
    orbit.setCran(c, instant || store.motionReduced);
    renderHud();
    schedulePreload(n);
    const e = getEntree(n);
    say(`Entrée ${pad(n)} : ${e.name}`);
    audio.chime(c);
  }

  function renderWorldFragments(n) {
    const e = getEntree(n);
    if (!elFragBar) return;
    elFragBar.innerHTML = '';
    e.fragments.forEach((f, idx) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'world-frag-btn';
      btn.id = `world-frag-btn-${f.m}`;
      btn.textContent = `${f.m}. ${f.title}`;
      btn.addEventListener('mouseenter', () => { if (activeWorld) activeWorld.warm(idx); });
      btn.addEventListener('mouseleave', () => { if (activeWorld) activeWorld.warm(null); });
      btn.addEventListener('focus', () => { if (activeWorld) activeWorld.warm(idx); });
      btn.addEventListener('click', () => openFragment(n, f.m, true));
      elFragBar.appendChild(btn);
    });
  }

  function openFragment(n, m, push = true) {
    const e = getEntree(n);
    const frag = e.fragments.find(f => f.m === m) || e.fragments[0];
    if (!frag) return;
    set({ fragment: frag.m });
    memory.mark(n, frag.m);
    if (activeWorld) activeWorld.select(frag.m - 1);
    if (elFragTitle) elFragTitle.textContent = frag.title;
    if (elFragDir) elFragDir.textContent = frag.direction || '';
    if (elFragText) elFragText.textContent = frag.text;
    if (elFragLink) elFragLink.href = frag.href;
    if (elFragImg) {
      if (frag.image) { elFragImg.src = frag.image; elFragImg.alt = frag.title; elFragImg.hidden = false; }
      else { elFragImg.hidden = true; }
    }
    if (elFragPanel) { elFragPanel.hidden = false; }
    if (push) router.pushFragment(n, frag.m);
    say(`Fragment ${frag.m} : ${frag.title}`);
    if (elFragTitle) elFragTitle.focus({ preventScroll: true });
    audio.chime(frag.m);
  }

  function closeFragment(updateUrl = false) {
    if (!store.fragment) return;
    const prev = store.fragment;
    set({ fragment: null });
    if (activeWorld) activeWorld.select(null);
    if (elFragPanel) elFragPanel.hidden = true;
    if (updateUrl) router.replace(`#entree-${store.entree}`);
    focusId(`world-frag-btn-${prev}`);
  }

  async function enterWorld(n, fragM = null, opts = {}) {
    const e = getEntree(n);
    if (!e) return;
    const my = ++enterToken;
    set({ entree: n, cran: n - 1, focusId: saveFocus() });
    orbit.setCran(n - 1, true);

    // Repli : une Entrée sans monde 3D reste lisible en DOM (aperçu des fragments).
    if (!WORLD_MODS[n]) {
      if (elFallbackBox && elFallbackList) {
        elFallbackList.innerHTML = '';
        e.fragments.forEach(f => {
          const a = document.createElement('a');
          a.className = 'fragment-choice';
          a.href = f.href;
          a.innerHTML = `<strong>${f.direction || `Fragment ${f.m}`}</strong><span>${f.text.slice(0, 140)}…</span>`;
          elFallbackList.appendChild(a);
        });
        elFallbackBox.hidden = false;
        say(`${e.name} — aperçu des fragments.`);
      }
      return;
    }

    pauseMedia();
    if (guided) {
      if (guide && typeof guide.hide === 'function') guide.hide();
      await revealStage();
      if (my !== enterToken) return;
    }
    if (!go('CROSSING')) force('CROSSING');
    renderHud();
    say(`Traversée vers ${e.name}`);
    audio.chime(n - 1);

    const world = await ensureWorld(n);
    if (!world || store.state !== 'CROSSING' || my !== enterToken) return;
    activeWorld = world;
    crossing.resetGlide();

    const quiet = store.motionReduced;
    const ms = opts.instant ? 0 : (quiet ? 220 : world.crossingMs);
    const ok = await tweenT(1, ms, t => {
      crossing.applyCrossingPose(t, world, e.tint, quiet);
      stage.invalidate();
    });
    if (!ok) return;
    if (my !== enterToken) return;

    // Stabilisation 0,5 s (sauf lien profond instantané ou mode calme)
    if (!opts.instant && !quiet) {
      const waited = await wait(500);
      if (!waited) return;
    }
    if (my !== enterToken) return;

    force('WORLD');
    memory.mark(n);
    renderWorldFragments(n);
    renderHud();
    if (!opts.fromHistory) router.pushWorld(n);
    say(`Arrivée dans ${e.name}, ${e.fragments.length} fragments disponibles.`);
    if (fragM) openFragment(n, fragM, false);
    else if (elBtnBack) elBtnBack.focus({ preventScroll: true });
  }

  async function returnToOrbit(opts = {}) {
    closeFragment(false);
    const e = getEntree(store.entree);
    const quiet = store.motionReduced;
    if (store.state === 'ORBIT' || store.state === 'FILM') {
      if (opts.toGuide) showGuide(store.entree, opts.focus !== false);
      return;
    }
    arrivalToken++; enterToken++;

    force('RETURN');
    renderHud();
    say(`Retour vers l’orbite, Entrée ${pad(store.entree)}.`);

    const world = activeWorld;
    const ms = opts.instant ? 0 : (quiet ? 200 : Math.max(450, Math.round((world ? world.crossingMs * 0.55 : 900) * store.t)));
    const ok = await tweenT(0, ms, t => {
      crossing.applyCrossingPose(t, world, e.tint, quiet);
      stage.invalidate();
    });
    if (!ok) return;

    if (world) world.group.visible = false;
    orbit.setVisible(true);
    crossing.setVeil(0);
    set({ macro: 0 });
    crossing.applyOrbitPose(0);
    force('ORBIT');
    renderHud();
    if (!opts.fromHistory) router.replace('#entrees');
    if (opts.toGuide !== false && guided) showGuide(store.entree, opts.focus !== false);
    else focusId(store.focusId || 'btnEnter');
  }

  // Contrôles DOM
  if (elBtnPrev) elBtnPrev.addEventListener('click', () => selectCran(store.cran - 1));
  if (elBtnNext) elBtnNext.addEventListener('click', () => selectCran(store.cran + 1));
  if (elBtnEnter) {
    elBtnEnter.addEventListener('focus', () => schedulePreload(store.entree));
    elBtnEnter.addEventListener('mouseenter', () => schedulePreload(store.entree));
    elBtnEnter.addEventListener('click', () => enterWorld(store.entree));
  }
  if (elBtnBack) elBtnBack.addEventListener('click', () => router.exitWorld());
  if (elFragClose) elFragClose.addEventListener('click', () => closeFragment(true));
  if (elBtnGesture) elBtnGesture.addEventListener('click', actOnWorld);

  function actOnWorld() {
    if (!activeWorld?.gesture) return;
    const msg = activeWorld.gesture(store.motionReduced);
    if (msg) say(msg);
    audio.chime(store.entree + 2);
    stage.invalidate();
  }

  // Raycaster sur gouttes (Orbite) et alcôves/cartes (Monde) + distinction swipe horizontal / scroll vertical
  const ray = new THREE.Raycaster(), ptr = new THREE.Vector2();
  let dragStart = null, longPressTimer = 0;

  const setPtr = e => {
    const r = canvas.getBoundingClientRect();
    ptr.x = ((e.clientX - r.left) / r.width) * 2 - 1;
    ptr.y = -((e.clientY - r.top) / r.height) * 2 + 1;
  };

  canvas.addEventListener('pointerdown', e => {
    dragStart = { x: e.clientX, y: e.clientY, t: performance.now(), moved: false };
    clearTimeout(longPressTimer);
    if (store.state === 'ORBIT' || store.state === 'WORLD') {
      longPressTimer = setTimeout(() => { if (dragStart && !dragStart.moved) breath(); }, 650);
    }
  }, { passive: true });

  canvas.addEventListener('pointermove', e => {
    if (dragStart) {
      const dx = e.clientX - dragStart.x, dy = e.clientY - dragStart.y;
      if (Math.hypot(dx, dy) > 10) { dragStart.moved = true; clearTimeout(longPressTimer); }
      if (store.state === 'WORLD' && activeWorld && activeWorld.glideMax && Math.abs(dx) > Math.abs(dy)) {
        crossing.setGlideNorm(dx / Math.max(120, innerWidth * 0.25), activeWorld.glideMax);
      }
      return;
    }
    if (store.state === 'WORLD' && activeWorld && activeWorld.pickables) {
      setPtr(e); ray.setFromCamera(ptr, stage.camera);
      const hit = ray.intersectObjects(activeWorld.pickables, false)[0];
      activeWorld.warm(hit ? hit.object.userData.fragment : null);
    }
  }, { passive: true });

  canvas.addEventListener('pointerup', e => {
    clearTimeout(longPressTimer);
    if (!dragStart) return;
    const dx = e.clientX - dragStart.x, dy = e.clientY - dragStart.y;
    const isOrbit = store.state === 'ORBIT' || store.state === 'MACRO';
    if (dragStart.moved) {
      // Swipe horizontal uniquement (n'interfère jamais avec le scroll vertical)
      if (isOrbit && Math.abs(dx) > 42 && Math.abs(dx) > Math.abs(dy) * 1.4) {
        selectCran(store.cran + (dx < 0 ? 1 : -1));
      }
      dragStart = null;
      return;
    }
    dragStart = null;
    setPtr(e); ray.setFromCamera(ptr, stage.camera);
    if (isOrbit) {
      const hit = ray.intersectObjects(orbit.pickables, false)[0];
      if (hit) {
        const c = hit.object.userData.cran;
        if (c === store.cran) enterWorld(store.entree); else selectCran(c);
      }
    } else if (store.state === 'WORLD' && activeWorld && activeWorld.pickables) {
      const hit = ray.intersectObjects(activeWorld.pickables, false)[0];
      if (hit) openFragment(store.entree, hit.object.userData.fragment + 1, true);
      else if (ray.intersectObjects(activeWorld.gesturePickables || [], false).some(hit => hit.object.visible)) actOnWorld();
    }
  }, { passive: true });

  // Scroll libre : pilote uniquement l'approche macro réversible (42° → 35°) quand #entrees traverse le viewport
  let scrollRaf = 0;
  function onScroll() {
    if (scrollRaf) return;
    scrollRaf = requestAnimationFrame(() => {
      scrollRaf = 0;
      if (!elSection) return;
      const r = elSection.getBoundingClientRect();
      const span = Math.max(1, r.height - innerHeight);
      const prog = Math.max(0, Math.min(1, -r.top / span));
      if (store.state === 'ORBIT' || store.state === 'MACRO' || store.state === 'FILM') {
        set({ macro: prog });
        if (stageInView && store.state === 'FILM') { force('ORBIT'); if (heroVideo) heroVideo.pause(); }
        if (prog > 0.08 && store.state === 'ORBIT') go('MACRO');
        else if (prog <= 0.08 && store.state === 'MACRO') go('ORBIT');
        stage.invalidate();
      }
    });
  }
  addEventListener('scroll', onScroll, { passive: true });

  // Observateur de visibilité de la section #entrees (pause son + préchargement)
  if (elSection) {
    new IntersectionObserver(entries => {
      stageInView = entries[0].isIntersecting;
      audio.setInField(stageInView);
      if (stageInView) {
        if (store.state === 'FILM') { force('ORBIT'); if (heroVideo) heroVideo.pause(); }
        schedulePreload(store.entree);
        stage.invalidate();
      }
    }, { threshold: 0.15 }).observe(elSection);
  }

  // Boucle de rendu principale
  stage.onFrame((dt, time, quiet) => {
    const s = store.state;
    if (s === 'FILM' || s === 'ORBIT' || s === 'MACRO') {
      orbit.update(dt, time, quiet);
      crossing.applyOrbitPose(store.macro);
    } else if (s === 'WORLD' && activeWorld && !store.fragment) {
      crossing.updateGlide(dt, quiet);
      activeWorld.update(dt, time, quiet);
      crossing.applyWorldPose(activeWorld, 1);
    } else if ((s === 'CROSSING' || s === 'RETURN') && activeWorld) {
      orbit.update(dt, time, quiet);
      activeWorld.update(dt, time, quiet);
    }
  });

  // A11y & clavier
  initA11y({
    inView: () => stageIsOpen() && (stageInView || store.state === 'WORLD'),
    onStep: dir => selectCran(store.cran + dir),
    onEnter: () => enterWorld(store.entree),
    onGlide: dir => { if (activeWorld) crossing.stepGlide(dir, activeWorld.glideMax); },
    onBreath: v => orbit.setBreath(v),
    onEscape: () => {
      if (store.state === 'CROSSING') { cancelTween(); returnToOrbit(); }
      else if (store.fragment) closeFragment(true);
      else router.exitWorld();
    },
  });

  // Le guide du film est monté après le stage WebGL et avant le routeur.
  await mountGuide();

  // Init
  selectCran(0, true);
  syncMotion();
  if (guided) hideStage(); else stage.start();

  // Routeur liens profonds (#portes, #entrees, #entree-N, #entree-N/fragment-M)
  router.initRouter({
    orbit(n, { scroll } = {}) {
      if (store.state === 'WORLD' || store.state === 'CROSSING') { returnToOrbit({ fromHistory: true, toGuide: true }); return; }
      if (n) selectCran(n - 1, true);
      if (guided && (n || guideReady)) showGuide(n || store.entree, guideReady);
      if (scroll && elSection) elSection.scrollIntoView({ behavior: store.motionReduced ? 'auto' : 'smooth' });
    },
    world(n, m, { instant } = {}) {
      if (elSection && instant) elSection.scrollIntoView({ behavior: 'auto' });
      enterWorld(n, m, { instant: guided || instant, fromHistory: true });
    },
    away() {
      if (store.state === 'WORLD' || store.state === 'CROSSING') returnToOrbit({ fromHistory: true, instant: true, toGuide: true, focus: false });
      else if (guided && stageIsOpen()) showGuide(store.entree, false);
    },
    escapeDirect(exitAll) {
      if (!exitAll && store.fragment) closeFragment(true);
      else returnToOrbit({ toGuide: true });
    },
  });
  guideReady = true;

}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
else boot();
