// Mondes illustrés 2.5D (Entrées 2, 3, 4, 5, 7) : plans de profondeur, repères jouables, réaction propre à chaque monde.
import * as THREE from 'three';
import { anchor, plate, illustration, sway } from './demo-kit.js';

// --- Petits éléments de premier plan (poussières / éclats) --------------------
function makeMotes(color, count = 26) {
  const geo = new THREE.SphereGeometry(0.035, 8, 6);
  const mat = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.45, depthWrite: false });
  const mesh = new THREE.InstancedMesh(geo, mat, count);
  const seeds = [], m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), v = new THREE.Vector3(), s = new THREE.Vector3();
  for (let i = 0; i < count; i++) {
    seeds.push({
      x: (Math.random() - 0.5) * 7.2, y: (Math.random() - 0.5) * 4.6,
      z: 1.1 + Math.random() * 2.6, p: Math.random() * 6.28, s: 0.55 + Math.random() * 0.95,
    });
    v.set(seeds[i].x, seeds[i].y, seeds[i].z); s.setScalar(seeds[i].s);
    m4.compose(v, q, s); mesh.setMatrixAt(i, m4);
  }
  mesh.frustumCulled = false;
  const group = new THREE.Group(); group.add(mesh);
  return {
    group,
    update(dt, time, quiet) {
      for (let i = 0; i < count; i++) {
        const sd = seeds[i];
        const x = quiet ? sd.x : sd.x + Math.cos(time * 0.19 + sd.p) * 0.11;
        const y = quiet ? sd.y : sd.y + Math.sin(time * 0.23 * sd.s + sd.p) * 0.15;
        v.set(x, y, sd.z); s.setScalar(sd.s);
        m4.compose(v, q, s); mesh.setMatrixAt(i, m4);
      }
      mesh.instanceMatrix.needsUpdate = true;
    },
  };
}

// --- Héros 1 : la gorge de bois et la corde (Entrée 2) ------------------------
function heroEchos() {
  const g = new THREE.Group(); g.name = 'hero';
  const wood = new THREE.MeshStandardMaterial({ color: 0x8a6a46, roughness: 0.88 });
  const throat = new THREE.Mesh(new THREE.TorusGeometry(0.62, 0.19, 18, 40), wood);
  throat.position.set(0, -0.75, -2.6); throat.rotation.x = 0.22; g.add(throat);
  const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.33, 1.6, 30, 1, true),
    new THREE.MeshStandardMaterial({ color: 0x6f5335, roughness: 0.92, side: THREE.DoubleSide }));
  shaft.position.set(0, -1.75, -2.6); g.add(shaft);
  const uTime = { value: 0 }, uAmp = { value: 0 };
  const cord = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.022, 2.7, 6, 26),
    sway(new THREE.MeshStandardMaterial({ color: 0xe8d9b8, roughness: 0.62 }), { uTime, uAmp },
      'float env=cos(position.y*1.55);transformed.x+=sin(uTime*8.5+position.y*4.2)*uAmp*.11*env;transformed.z+=cos(uTime*6.7+position.y*3.1)*uAmp*.07*env;'));
  cord.position.set(0, -0.15, -2.55); g.add(cord);
  const rings = [];
  for (let i = 0; i < 3; i++) {
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.3, 0.014, 8, 48),
      new THREE.MeshBasicMaterial({ color: 0xdfe9cd, transparent: true, opacity: 0, depthWrite: false }));
    ring.position.set(0, -0.15, -2.5); g.add(ring); rings.push(ring);
  }
  let amp = 0, pulse = -1;
  return {
    group: g,
    update(dt, time, quiet) {
      uTime.value = time;
      amp += ((pulse >= 0 ? 1 : 0) - amp) * (quiet ? 1 : Math.min(1, dt * 1.4));
      if (pulse >= 0) { pulse += dt; if (pulse > 3.2) pulse = -1; }
      uAmp.value = amp;
      rings.forEach((r, i) => {
        const t = pulse - i * 0.42;
        if (t <= 0 || t > 1.25) { r.material.opacity = 0; return; }
        const k = Math.min(1, t);
        r.scale.setScalar(1 + k * 3.4);
        r.material.opacity = (1 - k) * 0.55;
      });
    },
    gesture(quiet) { if (!quiet) { pulse = 0; } return 'La corde vibre : la galerie rend un écho, puis se tait.'; },
  };
}

// --- Héros 2 : mousse, cendre, braise et lanterne (Entrée 3) -------------------
function heroLueurs() {
  const g = new THREE.Group(); g.name = 'hero';
  const moss = new THREE.Mesh(new THREE.CircleGeometry(7.5, 48), new THREE.MeshStandardMaterial({ color: 0x3d5a3a, roughness: 0.96 }));
  moss.rotation.x = -Math.PI / 2; moss.position.y = -1.65; g.add(moss);
  const ash = new THREE.Mesh(new THREE.CircleGeometry(1.15, 32), new THREE.MeshStandardMaterial({ color: 0x8e8477, roughness: 1 }));
  ash.rotation.x = -Math.PI / 2; ash.position.set(0.2, -1.62, 0.5); g.add(ash);
  const stone = new THREE.Mesh(new THREE.DodecahedronGeometry(0.24, 0), new THREE.MeshStandardMaterial({ color: 0x6d6156, roughness: 1 }));
  stone.position.set(0.2, -1.48, 0.5); g.add(stone);
  const ember = new THREE.Mesh(new THREE.SphereGeometry(0.1, 16, 12), new THREE.MeshBasicMaterial({ color: 0xffa54a }));
  ember.position.set(0.2, -1.36, 0.5); g.add(ember);
  const emberLight = new THREE.PointLight(0xff8a3c, 1.1, 5.5, 2); emberLight.position.copy(ember.position); g.add(emberLight);
  const lantern = new THREE.Group(); lantern.position.set(-1.7, -1.05, -1.7); g.add(lantern);
  const box = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.4, 0.3), new THREE.MeshStandardMaterial({ color: 0x5d4a33, roughness: 0.82 }));
  lantern.add(box);
  const flame = new THREE.Mesh(new THREE.SphereGeometry(0.075, 12, 10), new THREE.MeshBasicMaterial({ color: 0xffe2a8 }));
  lantern.add(flame);
  const lampLight = new THREE.PointLight(0xffd9a0, 0.85, 5.5, 2); lantern.add(lampLight);
  let approach = 0, active = false;
  return {
    group: g,
    update(dt, time, quiet) {
      if (active) { approach += dt; if (approach > 6) { active = false; approach = 6; } }
      const k = quiet ? 1 : Math.min(1, dt * 1.2);
      const p = active ? approach / 6 : 0;
      const z = 0.5 + p * 1.9;
      const y = -1.36 + p * 0.55;
      ember.position.z += (z - ember.position.z) * k;
      ember.position.y += (y - ember.position.y) * k;
      const sc = 1 + p * 1.5 + (quiet ? 0 : Math.sin(time * 3.2) * 0.06);
      ember.scale.setScalar(sc);
      emberLight.position.copy(ember.position);
      emberLight.intensity = 1.1 + p * 2.4;
      lampLight.intensity = 0.85 + p * 0.9;
      flame.scale.setScalar(1 + p * 0.5 + (quiet ? 0 : Math.sin(time * 4.1) * 0.05));
    },
    gesture(quiet) { if (!quiet) { active = true; approach = 0; } return 'La braise approche, la lanterne s’égalise : le sentier s’éclaire.'; },
  };
}

// --- Héros 3 : la mer entre deux voiles (Entrée 4) ----------------------------
function heroHorizon() {
  const g = new THREE.Group(); g.name = 'hero';
  const sea = new THREE.Mesh(new THREE.PlaneGeometry(28, 14),
    new THREE.MeshStandardMaterial({ color: 0x3d6f78, roughness: 0.32, metalness: 0.12 }));
  sea.rotation.x = -Math.PI / 2; sea.position.set(0, -1.25, -4); g.add(sea);
  const glow = new THREE.Mesh(new THREE.PlaneGeometry(28, 0.14), new THREE.MeshBasicMaterial({ color: 0xf6e6c4 }));
  glow.position.set(0, -0.62, -9.4); g.add(glow);
  const veilMat = new THREE.MeshStandardMaterial({ color: 0xf4f0e7, transparent: true, opacity: 0.86, side: THREE.DoubleSide, roughness: 0.96 });
  const left = new THREE.Mesh(new THREE.PlaneGeometry(3.3, 7.4, 6, 12), veilMat); left.position.set(-1.45, 0.45, -1.15); g.add(left);
  const right = new THREE.Mesh(new THREE.PlaneGeometry(3.3, 7.4, 6, 12), veilMat); right.position.set(1.45, 0.45, -1.15); g.add(right);
  let open = 0, opening = false;
  return {
    group: g,
    update(dt, time, quiet) {
      if (opening) { open += dt * 0.55; if (open > 1) { open = 1; opening = false; } }
      const k = quiet ? 1 : Math.min(1, dt * 1.6);
      const off = open * 1.55;
      left.position.x += ((-1.45 - off) - left.position.x) * k;
      right.position.x += ((1.45 + off) - right.position.x) * k;
      const breathe = quiet ? 0 : Math.sin(time * 0.32) * 0.035;
      left.rotation.y = breathe; right.rotation.y = -breathe;
      sea.material.color.setHSL(0.52, 0.26, 0.32 + open * 0.06);
    },
    gesture(quiet) { if (!quiet) { opening = true; } return 'Les voiles s’écartent : la mer reprend sa respiration.'; },
  };
}

// --- Héros 4 : le papier et le pigment ocre (Entrée 5) ------------------------
function heroAtelier() {
  const g = new THREE.Group(); g.name = 'hero';
  const desk = new THREE.Mesh(new THREE.PlaneGeometry(22, 13), new THREE.MeshStandardMaterial({ color: 0x4a3a2b, roughness: 0.95 }));
  desk.rotation.x = -Math.PI / 2; desk.position.y = -1.55; g.add(desk);
  const paper = new THREE.Mesh(new THREE.PlaneGeometry(4.3, 2.7), new THREE.MeshStandardMaterial({ color: 0xf1e6d2, roughness: 0.94 }));
  paper.position.set(-0.35, -0.95, -1.7); paper.rotation.set(-0.52, 0.14, 0.04); g.add(paper);
  const N = 72, positions = new Float32Array(N * 6), indices = [];
  for (let i = 0; i < N; i++) {
    const t = i / (N - 1);
    const x = -1.75 + t * 3.5;
    const y = 0.42 * Math.sin(t * Math.PI * 1.7) + 0.1 * Math.sin(t * Math.PI * 5.1);
    positions[i * 6 + 0] = x; positions[i * 6 + 1] = y + 0.035; positions[i * 6 + 2] = 0;
    positions[i * 6 + 3] = x; positions[i * 6 + 4] = y - 0.035; positions[i * 6 + 5] = 0;
  }
  for (let i = 0; i < N - 1; i++) { const a = i * 2; indices.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geo.setIndex(indices);
  const stroke = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: 0xd39a5a, side: THREE.DoubleSide, transparent: true, opacity: 0.95 }));
  stroke.position.copy(paper.position); stroke.rotation.copy(paper.rotation); stroke.position.z += 0.03;
  g.add(stroke);
  const pot = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.26, 0.3, 20), new THREE.MeshStandardMaterial({ color: 0xb8862f, roughness: 0.55 }));
  pot.position.set(1.65, -1.38, -1.3); g.add(pot);
  const potLight = new THREE.PointLight(0xe0a34c, 0, 3.4, 2); potLight.position.copy(pot.position).y += 0.2; g.add(potLight);
  let drawn = 0, drawing = false;
  const total = (N - 1) * 6;
  return {
    group: g,
    update(dt, time, quiet) {
      if (drawing) { drawn += dt / 2.6; if (drawn >= 1) { drawn = 1; drawing = false; } }
      const shown = Math.floor(drawn * (N - 1)) * 6;
      geo.setDrawRange(0, Math.max(0, Math.min(total, shown)));
      potLight.intensity = drawn * 0.9;
      pot.material.emissive = pot.material.emissive || new THREE.Color(0x000000);
      pot.material.emissive.setRGB(drawn * 0.18, drawn * 0.09, 0);
    },
    gesture(quiet) { if (!quiet) { drawing = true; drawn = 0; } return 'Le pigment ocre suit la main : une trace se dessine.'; },
  };
}

// --- Héros 5 : l’ouverture entre deux mailles (Entrée 7) ----------------------
function heroTissage() {
  const g = new THREE.Group(); g.name = 'hero';
  const makePanel = () => {
    const pts = [], W = 2.7, H = 5.4, cols = 6, rows = 11;
    for (let i = 0; i <= cols; i++) { const x = -W / 2 + (W * i / cols); pts.push(x, -H / 2, 0, x, H / 2, 0); }
    for (let j = 0; j <= rows; j++) { const y = -H / 2 + (H * j / rows); pts.push(-W / 2, y, 0, W / 2, y, 0); }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
    return new THREE.LineSegments(geo, new THREE.LineBasicMaterial({ color: 0xdcbc80, transparent: true, opacity: 0.88 }));
  };
  const left = makePanel(); left.position.set(-2.0, 0.2, -1.3); g.add(left);
  const right = makePanel(); right.position.set(2.0, 0.2, -1.3); g.add(right);
  const thread = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.022, 1.25, 6),
    new THREE.MeshBasicMaterial({ color: 0xfff0c4, transparent: true, opacity: 0.9 }));
  thread.rotation.z = -Math.PI / 2; thread.position.set(-0.65, 0.2, -1.3); thread.scale.y = 0.001; g.add(thread);
  const bead = new THREE.Mesh(new THREE.SphereGeometry(0.06, 12, 10), new THREE.MeshBasicMaterial({ color: 0xfff6d8 }));
  bead.visible = false; g.add(bead);
  const beadLight = new THREE.PointLight(0xffe6b0, 0, 4, 2); g.add(beadLight);
  let linked = 0, linking = false;
  return {
    group: g,
    update(dt, time, quiet) {
      if (linking) { linked += dt / 2.2; if (linked >= 1) { linked = 1; linking = false; } }
      const p = linked;
      thread.scale.y = Math.max(0.001, p);
      thread.position.x = -0.65 + 0.65 * p;
      bead.visible = p > 0.02 && p < 0.99;
      bead.position.set(-0.65 + 1.3 * p, 0.2, -1.3);
      beadLight.position.copy(bead.position);
      beadLight.intensity = p > 0.02 && p < 0.99 ? 1.6 : p * 0.6;
      const close = p * 0.18;
      left.position.x += ((-2.0 + close) - left.position.x) * (quiet ? 1 : Math.min(1, dt * 1.2));
      right.position.x += ((2.0 - close) - right.position.x) * (quiet ? 1 : Math.min(1, dt * 1.2));
    },
    gesture(quiet) { if (!quiet) { linking = true; linked = 0; } return 'Le fil relie les deux mailles : la lumière circule enfin.'; },
  };
}

// --- Fabrique commune ---------------------------------------------------------
function makeWorld(cfg) {
  return {
    procedural: false,
    buildDecor() {
      const g = new THREE.Group();
      const bg = plate(cfg.planche, { width: 19, color: cfg.bg, toneMapped: false, fallback: cfg.cover });
      bg.position.set(0, 0.1, -7.2); bg.renderOrder = -20; g.add(bg);
      cfg.layers.forEach((l, i) => {
        const p = plate(l.src, { width: l.w, color: l.color, opacity: l.op, toneMapped: false, ratio: l.ratio || 16 / 9 });
        p.position.set(l.x || 0, l.y || 0, -5 + i * 1.5); p.renderOrder = -19 + i; g.add(p);
      });
      g.add(new THREE.HemisphereLight(0xfff6e8, cfg.ground, 1.05));
      const key = new THREE.DirectionalLight(cfg.key || 0xffe7c2, 1.15); key.position.set(2.2, 4, 5); g.add(key);
      const motes = makeMotes(cfg.mote);
      g.add(motes.group);
      const hero = cfg.hero();
      g.add(hero.group);
      anchor(g, 'orbit', 0, 0.4, 9.2);
      anchor(g, 'surface', 0, 0.36, 8.1);
      anchor(g, 'crossing', 0, 0.3, 6.5);
      anchor(g, 'arrival', 0, 0.24, 3.7);
      anchor(g, 'lookTarget', 0, 0.1, -1.4);
      cfg.layout.forEach((p, i) => anchor(g, `fragment_${i + 1}`, p[0], p[1], p[2]));
      g.userData.api = { hero, motes };
      return g;
    },
    buildProps(group, anchors, entree, ctx) {
      const api = group.userData.api || {};
      const hero = api.hero, motes = api.motes;
      const markers = anchors.fragments.map((p, i) => {
        const holder = new THREE.Group(); holder.position.copy(p); group.add(holder);
        const back = new THREE.Mesh(new THREE.PlaneGeometry(1.28, 1.44),
          new THREE.MeshBasicMaterial({ color: cfg.back, transparent: true, opacity: 0.3, depthWrite: false }));
        back.position.z = -0.06; holder.add(back);
        const frag = (entree.fragments || [])[i];
        const pic = illustration(frag ? frag.image : null, 1.15, (mesh, ratio) => {
          back.scale.set(1.15 * ratio + 0.16, 1.31, 1);
          if (ctx && ctx.invalidate) ctx.invalidate();
        });
        pic.userData.fragment = i; pic.material.color.setScalar(0.86); holder.add(pic);
        return { holder, back, pic, warm: 0, target: 0, baseY: p.y };
      });
      let hover = null, chosen = null;
      const retarget = () => markers.forEach((m, i) => { m.target = i === chosen ? 1 : i === hover ? 0.7 : 0; });
      return {
        crossingMs: cfg.crossingMs,
        glideMax: 8,
        pickables: markers.map(m => m.pic),
        update(dt, time, quiet) {
          if (hero) hero.update(dt, time, quiet);
          if (motes) motes.update(dt, time, quiet);
          const k = quiet ? 1 : Math.min(1, dt * 3);
          markers.forEach((m, i) => {
            m.warm += (m.target - m.warm) * k;
            m.pic.material.color.setScalar(0.86 + 0.14 * m.warm);
            m.back.material.opacity = 0.26 + 0.42 * m.warm;
            m.holder.position.y = m.baseY + (quiet ? 0 : Math.sin(time * 0.42 + i * 1.4) * 0.045);
          });
        },
        gesture(quiet) { return hero ? hero.gesture(quiet) : ''; },
        warm(i) { hover = i; retarget(); },
        select(i) { chosen = i; retarget(); },
      };
    },
  };
}

// --- Définition des cinq mondes ----------------------------------------------
const PLANCHE = n => `images/sous-la-peau/entree-0${n}.webp`;
const COVER = n => `images/ny-porte-0${n}.jpg`;

export const ILLUSTREES = {
  2: makeWorld({
    n: 2, planche: PLANCHE(2), cover: COVER(2), bg: 0x2b3226, ground: 0x33402f, key: 0xf2f0dc, mote: 0xdfe9cd, back: 0x9fb08a,
    crossingMs: 4000,
    layers: [
      { src: PLANCHE(2), w: 12, color: 0x39412f, op: 0.5, x: -0.6, ratio: 16 / 9 },
      { src: null, w: 8, color: 0x4d5a41, op: 0.22, x: 1.1, y: 0.4 },
    ],
    layout: [[-2.6, 0.95, -0.4], [-1.4, 0.15, 0.7], [0.1, 1.15, -0.9], [1.6, -0.25, -0.1], [2.7, 0.7, 0.9]],
    hero: heroEchos,
  }),
  3: makeWorld({
    n: 3, planche: PLANCHE(3), cover: COVER(3), bg: 0x27301f, ground: 0x3c5230, key: 0xffdcae, mote: 0xffd79a, back: 0xbfa06a,
    crossingMs: 4200,
    layers: [
      { src: PLANCHE(3), w: 12, color: 0x3a4527, op: 0.45, x: 0.5, ratio: 16 / 9 },
      { src: null, w: 7, color: 0x6b5a34, op: 0.18, x: -0.8, y: -0.5 },
    ],
    layout: [[-2.5, -0.55, -0.5], [-1.1, 0.65, 0.5], [0.2, -0.35, 0.95], [1.3, 0.95, -0.6], [2.4, -0.05, 0.25], [0.85, -0.95, 1.6]],
    hero: heroLueurs,
  }),
  4: makeWorld({
    n: 4, planche: PLANCHE(4), cover: COVER(4), bg: 0x2c4148, ground: 0x35555c, key: 0xffe9c8, mote: 0xd8ecec, back: 0x7fa6ad,
    crossingMs: 4300,
    layers: [
      { src: PLANCHE(4), w: 13, color: 0x3a555c, op: 0.45, x: 0, ratio: 16 / 9 },
      { src: null, w: 9, color: 0x8fb7bb, op: 0.16, x: 0, y: 0.2 },
    ],
    layout: [[-2.7, 0.35, 0.2], [-1.3, -0.55, -0.4], [0.2, 0.65, -0.2], [1.5, 0.1, 0.55], [2.6, -0.65, -0.3]],
    hero: heroHorizon,
  }),
  5: makeWorld({
    n: 5, planche: PLANCHE(5), cover: COVER(5), bg: 0x3a2f24, ground: 0x4a3a2b, key: 0xffe2b4, mote: 0xe8c48c, back: 0xb08a6e,
    crossingMs: 4100,
    layers: [
      { src: PLANCHE(5), w: 12, color: 0x4d3e2d, op: 0.45, x: -0.4, ratio: 16 / 9 },
      { src: null, w: 7, color: 0x8a6a4c, op: 0.2, x: 0.9, y: -0.3 },
    ],
    layout: [[-2.3, 0.85, -0.3], [-0.9, -0.35, 0.55], [0.55, 0.95, 0.05], [1.75, -0.45, -0.25], [2.5, 0.55, 0.8]],
    hero: heroAtelier,
  }),
  7: makeWorld({
    n: 7, planche: PLANCHE(7), cover: COVER(7), bg: 0x38301c, ground: 0x4a3d22, key: 0xffeec2, mote: 0xffe9ae, back: 0xd0ae6b,
    crossingMs: 4400,
    layers: [
      { src: PLANCHE(7), w: 12, color: 0x4a3d22, op: 0.45, x: 0.3, ratio: 16 / 9 },
      { src: null, w: 8, color: 0xc9a86a, op: 0.16, x: -0.6, y: 0.3 },
    ],
    layout: [[-2.6, 0.45, -0.2], [-1.2, 1.0, 0.55], [0.3, -0.6, -0.4], [1.6, 0.55, 0.3], [2.6, -0.25, -0.55]],
    hero: heroTissage,
  }),
};

export default ILLUSTREES;
