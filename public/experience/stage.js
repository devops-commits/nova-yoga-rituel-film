// Renderer WebGL, scène, caméra, alignement sur .cinema-orbit, resize, contextlost, rendu à la demande en mode calme.
import * as THREE from 'three';
import { store, set } from './state.js';

export function createStage(canvas) {
  let renderer = null;
  try {
    renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'high-performance' });
  } catch (e) {
    return null;
  }
  if (!renderer.getContext()) return null;

  const isMobile = () => innerWidth <= 768;
  const maxDpr = () => Math.min(devicePixelRatio || 1, isMobile() ? 1.5 : 2);
  renderer.setPixelRatio(maxDpr());
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  renderer.outputColorSpace = THREE.SRGBColorSpace;

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 140);
  camera.up.set(0, 1, 0);

  const hemi = new THREE.HemisphereLight(0xfff6e8, 0x173a31, 1.05);
  const key = new THREE.DirectionalLight(0xffe7c2, 1.25);
  key.position.set(3, 6, 5);
  scene.add(hemi, key);

  let width = 1, height = 1, dirty = true, raf = 0, last = performance.now();
  const hooks = new Set();

  function resize() {
    const rect = canvas.parentElement ? canvas.parentElement.getBoundingClientRect() : { width: innerWidth, height: innerHeight };
    width = Math.max(1, Math.round(rect.width));
    height = Math.max(1, Math.round(rect.height));
    renderer.setPixelRatio(maxDpr());
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    dirty = true;
    renderNow();
  }

  function invalidate() {
    dirty = true;
    if (store.motionReduced && !raf) renderNow();
  }

  function renderNow() {
    const now = performance.now();
    const dt = Math.min(0.05, Math.max(0.001, (now - last) / 1000));
    last = now;
    const t = now / 1000;
    hooks.forEach(fn => fn(dt, t, store.motionReduced));
    renderer.render(scene, camera);
    dirty = false;
  }

  function loop() {
    raf = 0;
    if (!store.webglReady) return;
    if (document.hidden) return;
    if (!store.motionReduced || dirty) renderNow();
    if (!store.motionReduced) raf = requestAnimationFrame(loop);
  }

  function start() {
    last = performance.now();
    dirty = true;
    if (!raf) raf = requestAnimationFrame(loop);
  }

  function stop() {
    if (raf) cancelAnimationFrame(raf);
    raf = 0;
  }

  // Calcule l'échelle/décalage vertical pour aligner l'anneau 3D sur .cinema-orbit (top: 64%, width: min(76vw, 880px))
  function getOrbitLayout() {
    const mobile = width <= 600;
    const ringPx = mobile ? width * 1.15 : Math.min(width * 0.76, 880);
    const centerYFrac = mobile ? 0.69 : 0.64;
    const radius = 3.2;
    const vFov = THREE.MathUtils.degToRad(42);
    const hFov = 2 * Math.atan(Math.tan(vFov / 2) * (width / height));
    const widthFrac = Math.min(0.95, ringPx / width);
    const dist = Math.max(5.5, Math.min(14, (radius / widthFrac) / Math.tan(hFov / 2)));
    const visH = 2 * Math.tan(vFov / 2) * dist;
    const offsetY = (centerYFrac - 0.5) * visH;
    return { radius, dist, offsetY };
  }

  canvas.addEventListener('webglcontextlost', e => {
    e.preventDefault();
    stop();
    set({ webglReady: false });
    document.body.classList.remove('webgl-active');
  });

  canvas.addEventListener('webglcontextrestored', () => {
    set({ webglReady: true });
    document.body.classList.add('webgl-active');
    resize();
    start();
  });

  addEventListener('resize', resize, { passive: true });
  if (typeof ResizeObserver !== 'undefined' && canvas.parentElement) {
    new ResizeObserver(() => resize()).observe(canvas.parentElement);
  }
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) stop(); else if (store.webglReady && !store.motionReduced) start();
  });

  document.body.classList.add('webgl-active');
  resize();
  set({ webglReady: true });

  return {
    renderer, scene, camera,
    onFrame(fn) { hooks.add(fn); return () => hooks.delete(fn); },
    invalidate, resize, start, stop, renderNow, getOrbitLayout,
    get size() { return { width, height }; },
    disposeObject(obj) {
      if (!obj) return;
      obj.traverse(o => {
        if (o.geometry) o.geometry.dispose();
        if (o.material) {
          const mats = Array.isArray(o.material) ? o.material : [o.material];
          mats.forEach(m => {
            if (m.map) m.map.dispose();
            m.dispose();
          });
        }
      });
    },
  };
}
