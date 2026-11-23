// Kit de décor procédural (démonstration) + chargeur GLB prioritaire.
// Contrat : 5 repères nommés (orbit, surface, crossing, arrival, lookTarget) + fragment_1..N (N variable).
import * as THREE from 'three';
export const ANCHORS = ['orbit', 'surface', 'crossing', 'arrival', 'lookTarget'];
const FRAG_RE = /^fragment_(\d+)$/;
export function anchor(parent, name, x, y, z) { const o = new THREE.Object3D(); o.name = name; o.position.set(x, y, z); parent.add(o); return o; }
export function readAnchors(root) {
  root.updateMatrixWorld(true);
  const out = { fragments: [] };
  for (const name of ANCHORS) {
    const o = root.getObjectByName(name); if (!o) return null;
    out[name] = o.getWorldPosition(new THREE.Vector3());
  }
  // Les repères de fragment sont discovered : leur nombre suit le contrat de l’Entrée (5, ou 6 pour l’Entrée 3).
  const found = [];
  root.traverse(o => { const m = FRAG_RE.exec(o.name); if (m) found.push([+m[1], o]); });
  found.sort((a, b) => a[0] - b[0]);
  out.fragments = found.map(([, o]) => o.getWorldPosition(new THREE.Vector3()));
  return out;
}
export function dome(top, bottom, radius = 60) {
  return new THREE.Mesh(new THREE.SphereGeometry(radius, 32, 16), new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false,
    uniforms: { a: { value: new THREE.Color(top) }, b: { value: new THREE.Color(bottom) } },
    vertexShader: 'varying vec3 vP;void main(){vP=position;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
    fragmentShader: 'uniform vec3 a;uniform vec3 b;varying vec3 vP;void main(){float h=normalize(vP).y*.5+.5;gl_FragColor=vec4(mix(b,a,smoothstep(.25,.85,h)),1.);\n#include <tonemapping_fragment>\n#include <colorspace_fragment>\n}',
  }));
}
export const nacre = (color = 0xf3e9dc) => new THREE.MeshPhysicalMaterial({ color, roughness: 0.55, sheen: 0.6, sheenColor: 0xffe7c4, sheenRoughness: 0.4 });
// Injecte du GLSL après <begin_vertex> (oscillations lentes), uniforms partagés.
export function sway(mat, uniforms, glsl) {
  mat.onBeforeCompile = sh => {
    Object.assign(sh.uniforms, uniforms);
    sh.vertexShader = Object.keys(uniforms).map(k => `uniform float ${k};`).join('') + '\n' + sh.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\n' + glsl);
  };
  mat.customProgramCacheKey = () => glsl;
  return mat;
}
const loader = new THREE.TextureLoader();
// Plan image à largeur fixe : la hauteur suit le ratio natif de l’image (dimensions cohérentes).
export function plate(src, opts = {}) {
  const { width = 12, color = 0x2a2622, opacity = 1, toneMapped = true, ratio = 16 / 9, depthWrite = true } = opts;
  const mat = new THREE.MeshBasicMaterial({ color, transparent: opacity < 1, opacity, toneMapped, depthWrite });
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), mat);
  mesh.scale.set(width, width / ratio, 1);
  mesh.userData.width = width;
  if (src) loader.load(src, tex => {
    tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 4;
    const r = tex.image.width / tex.image.height;
    mesh.scale.set(width, width / r, 1);
    mesh.userData.ratio = r;
    mat.map = tex; mat.needsUpdate = true;
    if (opts.onReady) opts.onReady(mesh, r);
  }, undefined, () => {
    // Image absente : on tente une source de repli, sinon le plan reste uni.
    if (opts.fallback && !mesh.userData.fallbackTried) {
      mesh.userData.fallbackTried = true;
      loader.load(opts.fallback, tex => {
        tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 4;
        const r = tex.image.width / tex.image.height;
        mesh.scale.set(width, width / r, 1);
        mesh.userData.ratio = r;
        mat.map = tex; mat.needsUpdate = true;
        if (opts.onReady) opts.onReady(mesh, r);
      }, undefined, () => { if (opts.onError) opts.onError(); });
    } else if (opts.onError) opts.onError();
  });
  return mesh;
}
// Illustration au ratio natif strict : largeur = hauteur × (image.width / image.height).
export function illustration(src, height, onReady) {
  const mat = new THREE.MeshBasicMaterial({ color: 0xffffff, toneMapped: false });
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), mat);
  mesh.visible = false; mesh.scale.set(height * 0.4, height, 1);
  if (src) loader.load(src, tex => {
    tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 4;
    const ratio = tex.image.width / tex.image.height;
    mesh.scale.set(height * ratio, height, 1); mesh.userData.ratio = ratio;
    mat.map = tex; mat.needsUpdate = true; mesh.visible = true;
    if (onReady) onReady(mesh, ratio);
  }, undefined, () => { /* illustration absente : l'alcôve reste nue */ });
  return mesh;
}
// Le décodeur Draco n’est branché que s’il est réellement présent sur le serveur.
async function hasDracoDecoder() {
  try {
    const r = await fetch('vendor/three/draco/draco_decoder.js', { method: 'HEAD' });
    return !!r.ok;
  } catch (e) { return false; }
}
async function tryGLB(n) {
  const url = `worlds/entree-0${n}.glb`;
  try {
    const head = await fetch(url, { method: 'HEAD' });
    if (!head.ok || /html/.test(head.headers.get('content-type') || '')) return null;
    const { GLTFLoader } = await import('../../vendor/three/GLTFLoader.js');
    const gl = new GLTFLoader();
    try {
      // Cas courant : GLB sans compression Draco.
      return (await gl.loadAsync(url)).scene;
    } catch (err) {
      if (!/draco/i.test(String((err && err.message) || err))) throw err;
      if (!await hasDracoDecoder()) {
        console.warn(`[Nova] ${url} utilise Draco mais le décodeur (vendor/three/draco/) est absent : décor procédural conservé.`);
        return null;
      }
      const { DRACOLoader } = await import('../../vendor/three/DRACOLoader.js');
      const draco = new DRACOLoader(); draco.setDecoderPath('vendor/three/draco/');
      gl.setDRACOLoader(draco);
      return (await gl.loadAsync(url)).scene;
    }
  } catch (e) {
    console.warn(`[Nova] ${url} non chargé (${(e && e.message) || e}) : décor procédural conservé.`);
    return null;
  }
}
// GLB prioritaire s'il existe et porte les repères ; sinon décor procédural ou illustré.
export async function createWorld(entree, mod, ctx) {
  const group = new THREE.Group(); group.name = `entree-${entree.n}`; group.visible = false;
  let anchors = null, procedural = true;
  const glb = await tryGLB(entree.n);
  if (glb) { anchors = readAnchors(glb); if (anchors) { group.add(glb); procedural = false; } }
  if (procedural) {
    const decor = mod.buildDecor(entree); group.add(decor); anchors = readAnchors(decor);
    // Les mondes illustrés (2,3,4,5,7) ne sont pas des décors de démonstration.
    if (mod.procedural === false) procedural = false;
  }
  if (!anchors) return null;
  const world = mod.buildProps(group, anchors, entree, ctx);
  return Object.assign({ crossingMs: 4400, glideMax: 0, yawAt: () => 0 }, world, { group, anchors, procedural, n: entree.n });
}
