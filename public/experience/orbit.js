// Orbite 3D : anneau doré calé sur .cinema-orbit, 7 gouttes de lumière, crans aimantés (ressort critique), mémoire poétique.
import * as THREE from 'three';
import { ENTREES } from './data-map.js';

const TAU = Math.PI * 2;
const STEP = TAU / 7;

function makeDropGeometry() {
  const g = new THREE.SphereGeometry(0.42, 40, 32);
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
    const pinch = y > 0 ? 1 - 0.34 * Math.pow(y / 0.42, 1.35) : 1 + 0.08 * Math.abs(y / 0.42);
    const stretch = y > 0 ? 1.24 : 0.94;
    p.setXYZ(i, x * pinch, y * stretch, z * pinch);
  }
  g.computeVertexNormals();
  return g;
}

export function createOrbit(scene, stage) {
  const root = new THREE.Group();
  root.name = 'orbit-root';
  scene.add(root);

  const radius = 3.2;
  const ringGroup = new THREE.Group();
  root.add(ringGroup);

  // Anneau principal doré + 2 anneaux intérieurs concentriques (miroir de .cinema-orbit)
  const makeRing = (r, color, opacity) => {
    const pts = [];
    for (let i = 0; i <= 128; i++) {
      const a = (i / 128) * TAU;
      pts.push(new THREE.Vector3(Math.cos(a) * r, 0, Math.sin(a) * r));
    }
    const geo = new THREE.BufferGeometry().setFromPoints(pts);
    return new THREE.LineLoop(geo, new THREE.LineBasicMaterial({ color, transparent: true, opacity }));
  };
  ringGroup.add(makeRing(radius, 0xddb168, 0.55));
  ringGroup.add(makeRing(radius * 0.76, 0xf7efe5, 0.2));
  ringGroup.add(makeRing(radius * 0.5, 0xf7efe5, 0.14));

  // Filaments de mémoire poétique (visibles pour les Entrées déjà traversées)
  const filaments = ENTREES.map((e, i) => {
    const a = i * STEP;
    const geo = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(0, 0, 0),
      new THREE.Vector3(Math.sin(a) * radius, 0, Math.cos(a) * radius),
    ]);
    const line = new THREE.Line(geo, new THREE.LineBasicMaterial({ color: 0xddb168, transparent: true, opacity: 0.48 }));
    line.visible = false;
    ringGroup.add(line);
    return line;
  });

  // 7 gouttes de lumière (seule la goutte active utilise une vraie transmission/iridescence)
  const dropGeo = makeDropGeometry();
  const haloGeo = new THREE.RingGeometry(0.46, 0.52, 40);
  const dotGeo = new THREE.SphereGeometry(0.04, 12, 10);

  const drops = ENTREES.map((e, i) => {
    const a = i * STEP;
    const holder = new THREE.Group();
    holder.position.set(Math.sin(a) * radius, 0, Math.cos(a) * radius);
    ringGroup.add(holder);

    const activeMat = new THREE.MeshPhysicalMaterial({
      color: new THREE.Color(e.tint),
      emissive: new THREE.Color(e.tint),
      emissiveIntensity: 0.22,
      roughness: 0.16,
      metalness: 0.05,
      transmission: 0.55,
      thickness: 0.9,
      ior: 1.38,
      iridescence: 0.75,
      iridescenceIOR: 1.3,
      clearcoat: 0.6,
      clearcoatRoughness: 0.2,
    });

    const idleMat = new THREE.MeshStandardMaterial({
      color: new THREE.Color(e.tint),
      emissive: new THREE.Color(e.tint),
      emissiveIntensity: 0.12,
      roughness: 0.34,
      metalness: 0.12,
      transparent: true,
      opacity: 0.86,
    });

    const mesh = new THREE.Mesh(dropGeo, i === 0 ? activeMat : idleMat);
    mesh.userData.entree = e.n;
    mesh.userData.cran = i;
    holder.add(mesh);

    const halo = new THREE.Mesh(haloGeo, new THREE.MeshBasicMaterial({
      color: 0xddb168, transparent: true, opacity: 0.28, side: THREE.DoubleSide, depthWrite: false,
    }));
    halo.rotation.x = -Math.PI / 2;
    halo.position.y = -0.34;
    holder.add(halo);

    // Points de lumière calmes pour les fragments lus (mémoire poétique, zéro compteur)
    const dots = [];
    for (let d = 0; d < 6; d++) {
      const da = (d / 6) * TAU;
      const dot = new THREE.Mesh(dotGeo, new THREE.MeshBasicMaterial({ color: 0xfff5dc }));
      dot.position.set(Math.cos(da) * 0.62, -0.26, Math.sin(da) * 0.62);
      dot.visible = false;
      holder.add(dot);
      dots.push(dot);
    }

    return { n: e.n, holder, mesh, halo, dots, activeMat, idleMat, scale: 1 };
  });

  // Lueur centrale subtile (respiration d'ancrage)
  const centerGlow = new THREE.PointLight(0xddb168, 0.85, 10, 1.5);
  centerGlow.position.set(0, 0.8, 0);
  root.add(centerGlow);

  // Ressort critique sans rebond pour l'angle orbital
  let angle = 0, targetAngle = 0, vel = 0;
  let activeCran = 0, breathAmt = 0;

  function setCran(cran, instant = false) {
    activeCran = ((cran % 7) + 7) % 7;
    const rawTarget = -activeCran * STEP;
    // Chemin angulaire le plus court
    let diff = (rawTarget - angle) % TAU;
    if (diff > Math.PI) diff -= TAU;
    if (diff < -Math.PI) diff += TAU;
    targetAngle = angle + diff;
    if (instant) { angle = targetAngle; vel = 0; ringGroup.rotation.y = angle; }
    drops.forEach((d, i) => {
      d.mesh.material = i === activeCran ? d.activeMat : d.idleMat;
    });
    stage.invalidate();
  }

  function applyTints(tints) {
    tints.forEach((hex, i) => {
      const c = new THREE.Color(hex);
      drops[i].activeMat.color.copy(c);
      drops[i].activeMat.emissive.copy(c);
      drops[i].idleMat.color.copy(c);
      drops[i].idleMat.emissive.copy(c);
    });
    stage.invalidate();
  }

  function applyMemory(list) {
    const visited = new Set(list.map(s => +s.split('.')[0]));
    filaments.forEach((f, i) => { f.visible = visited.has(i + 1); });
    drops.forEach((d, i) => {
      const frags = list.filter(s => s.startsWith(`${i + 1}.`)).length;
      d.dots.forEach((dot, idx) => { dot.visible = idx < frags; });
    });
    stage.invalidate();
  }

  function getActiveWorldPosition(out = new THREE.Vector3()) {
    root.updateMatrixWorld(true);
    return drops[activeCran].holder.getWorldPosition(out);
  }

  function update(dt, time, quiet) {
    // Ressort critique : omega = 5.4, dampingRatio = 1.0
    if (quiet) {
      angle = targetAngle; vel = 0;
    } else {
      const omega = 5.4;
      const err = targetAngle - angle;
      const acc = omega * omega * err - 2 * omega * vel;
      vel += acc * dt;
      angle += vel * dt;
      if (Math.abs(err) < 0.0005 && Math.abs(vel) < 0.0005) { angle = targetAngle; vel = 0; }
    }
    ringGroup.rotation.y = angle;

    // Inclinaison douce vers la goutte active + inspiration lente (+3 % sur 4 s)
    const breathe = quiet ? 0 : (Math.sin(time * (TAU / 4)) * 0.5 + 0.5) * 0.03;
    const anchorPulse = 1 + breathAmt * 0.14;
    centerGlow.intensity = 0.85 + breathAmt * 1.1;

    drops.forEach((d, i) => {
      const isAct = i === activeCran;
      const targetScale = (isAct ? 1.16 + breathe : 0.88) * anchorPulse;
      d.scale += (targetScale - d.scale) * (quiet ? 1 : Math.min(1, dt * 6));
      d.mesh.scale.setScalar(d.scale);
      d.mesh.position.y = quiet ? 0 : Math.sin(time * 0.85 + i * 1.1) * 0.055;
      d.mesh.rotation.y = quiet ? 0 : time * 0.18 + i;
      d.halo.material.opacity = isAct ? 0.52 + breathe * 4 : 0.16;
      d.activeMat.emissiveIntensity = isAct ? 0.24 + breathe * 5 + breathAmt * 0.25 : 0.12;
    });
  }

  return {
    root,
    drops,
    pickables: drops.map(d => d.mesh),
    setCran,
    applyTints,
    applyMemory,
    getActiveWorldPosition,
    setBreath(v) { breathAmt = v; stage.invalidate(); },
    setVisible(v) { root.visible = v; stage.invalidate(); },
    update,
  };
}
