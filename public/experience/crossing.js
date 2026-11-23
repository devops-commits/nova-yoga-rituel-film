// Chorégraphie caméra : Orbite (42°) ↔ Macro (35°) → Traversée (masque matière, 35°→46°, zéro roulis) → Monde → Retour exact.
import * as THREE from 'three';

const sm = x => { x = Math.min(1, Math.max(0, x)); return x * x * (3 - 2 * x); };
const lerp = (a, b, t) => a + (b - a) * t;

export function createCrossing(stage, orbit, veilEl) {
  const cam = stage.camera;
  const vPos = new THREE.Vector3();
  const vLook = new THREE.Vector3();
  const vDrop = new THREE.Vector3();
  const vA = new THREE.Vector3();
  const vB = new THREE.Vector3();

  let glide = 0, glideTarget = 0;

  function setVeil(alpha, tint) {
    if (!veilEl) return;
    veilEl.style.opacity = String(Math.max(0, Math.min(1, alpha)));
    if (tint) veilEl.style.setProperty('--veil-tint', tint);
    veilEl.style.pointerEvents = alpha > 0.05 ? 'auto' : 'none';
  }

  function applyOrbitPose(macro = 0) {
    const { radius, dist, offsetY } = stage.getOrbitLayout();
    const m = sm(macro);
    orbit.getActiveWorldPosition(vDrop);

    // Position Orbite : vue légèrement plongeante (cohérente avec rotateX(76deg))
    const orbitPos = vA.set(0, 2.35 - offsetY * 0.45, dist);
    const orbitLook = vB.set(0, -offsetY * 0.35, 0);

    // Position Macro : travelling avant vers la goutte active (champ 42° → 35°)
    const macroPos = new THREE.Vector3(vDrop.x, vDrop.y + 0.12, vDrop.z + 1.55);
    const macroLook = new THREE.Vector3(vDrop.x, vDrop.y + 0.02, vDrop.z);

    vPos.lerpVectors(orbitPos, macroPos, m);
    vLook.lerpVectors(orbitLook, macroLook, m);

    cam.position.copy(vPos);
    cam.fov = lerp(42, 35, m);
    cam.up.set(0, 1, 0);
    cam.lookAt(vLook);
    cam.updateProjectionMatrix();
    setVeil(0);
  }

  // t ∈ [0, 1] : 0..0.42 = plongée dans la goutte (Orbite), 0.42..0.52 = voile matière, 0.52..1 = travelling monde
  function applyCrossingPose(t, world, tint, quiet) {
    const k = Math.max(0, Math.min(1, t));
    if (quiet) {
      const inWorld = k >= 0.5;
      orbit.setVisible(!inWorld);
      if (world) world.group.visible = inWorld;
      const pulse = Math.sin(k * Math.PI);
      setVeil(pulse * 0.92, tint);
      if (inWorld && world) applyWorldPose(world, 1); else applyOrbitPose(0);
      return;
    }

    if (k < 0.46) {
      orbit.setVisible(true);
      if (world) world.group.visible = false;
      const p = sm(k / 0.46);
      orbit.getActiveWorldPosition(vDrop);
      const startPos = vA.set(vDrop.x, vDrop.y + 0.12, vDrop.z + 1.55);
      const endPos = vB.set(vDrop.x, vDrop.y + 0.02, vDrop.z + 0.22);
      cam.position.lerpVectors(startPos, endPos, p);
      cam.fov = lerp(35, 31, p);
      cam.up.set(0, 1, 0);
      cam.lookAt(vDrop);
      cam.updateProjectionMatrix();
      const veilA = sm((k - 0.28) / 0.18);
      setVeil(veilA, tint);
    } else {
      orbit.setVisible(false);
      if (world) world.group.visible = true;
      const w = sm((k - 0.46) / 0.54);
      const veilA = 1 - sm((k - 0.46) / 0.16);
      setVeil(veilA, tint);
      if (world) applyWorldPose(world, w);
    }
  }

  function applyWorldPose(world, w = 1) {
    const a = world.anchors;
    const p = sm(w);
    cam.position.lerpVectors(a.crossing, a.arrival, p);
    cam.fov = lerp(36, 46, p);
    cam.up.set(0, 1, 0);

    // Lacet oblique éventuel (Entrée 6 : 25° redressé en 1,2 s, horizon stable dès 70 %) + glissement borné
    const yaw = (world.yawAt ? world.yawAt(w) : 0) + THREE.MathUtils.degToRad(glide);
    vLook.copy(a.lookTarget).sub(cam.position);
    if (yaw !== 0) {
      const c = Math.cos(yaw), s = Math.sin(yaw);
      const nx = vLook.x * c - vLook.z * s;
      const nz = vLook.x * s + vLook.z * c;
      vLook.x = nx; vLook.z = nz;
    }
    vLook.add(cam.position);
    cam.lookAt(vLook);
    cam.updateProjectionMatrix();
  }

  function stepGlide(dir, maxDeg) {
    if (!maxDeg) return;
    glideTarget = Math.max(-maxDeg, Math.min(maxDeg, glideTarget + dir * (maxDeg * 0.5)));
  }

  function setGlideNorm(norm, maxDeg) {
    if (!maxDeg) return;
    glideTarget = Math.max(-maxDeg, Math.min(maxDeg, norm * maxDeg));
  }

  function resetGlide() { glide = 0; glideTarget = 0; }

  function updateGlide(dt, quiet) {
    glide += (glideTarget - glide) * (quiet ? 1 : Math.min(1, dt * 4));
  }

  return { applyOrbitPose, applyCrossingPose, applyWorldPose, stepGlide, setGlideNorm, resetGlide, updateGlide, setVeil };
}
