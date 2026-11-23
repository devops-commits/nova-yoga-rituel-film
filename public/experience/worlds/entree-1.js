// Entrée 01 · La chambre des appuis — descente (~3 m) à travers 48 fils vers un bol de céramique satiné.
import * as THREE from 'three';
import { anchor, dome, nacre, sway, illustration, plate } from './demo-kit.js';
const ARC = 140 * Math.PI / 180, RAD = 3.3;
export function buildDecor(entree) {
  const g = new THREE.Group();
  g.add(dome('#f4ead9', '#cdb79b'));
  if (entree?.planche) {
    const board = plate('images/sous-la-peau/chambre.webp', { width: 26, color: 0xffffff, toneMapped: false, fallback: entree.planche });
    board.position.set(0, -0.9, -8.6);
    g.add(board);
  }
  g.add(new THREE.HemisphereLight(0xfff6e8, 0xb99f80, 1.1));
  const sun = new THREE.DirectionalLight(0xfff0d8, 1.5); sun.position.set(2, 7, 4); g.add(sun);
  anchor(g, 'orbit', 0, 4.75, 9); anchor(g, 'surface', 0, 4.75, 6.4);
  anchor(g, 'crossing', 0, 4.75, 5.4); anchor(g, 'arrival', 0, 1.75, 4.6); anchor(g, 'lookTarget', 0, 0.75, 0);
  for (let i = 0; i < 5; i++) { const a = -ARC / 2 + i * ARC / 4; anchor(g, `fragment_${i + 1}`, Math.sin(a) * RAD, 1.55, -Math.cos(a) * RAD); }
  return g;
}
export function buildProps(group, anchors, entree, ctx) {
  const uTime = { value: 0 }, uSlack = { value: 0 }, uRipple = { value: 99 }, L = anchors.lookTarget;
  // 48 fils : un seul InstancedMesh, oscillation lente en vertex shader (extrémités fixes).
  const mat = sway(new THREE.MeshStandardMaterial({ color: 0xc8a47b, emissive: 0xb69458, emissiveIntensity: 0.06, roughness: 0.4 }), { uTime, uSlack },
    'float ph=instanceMatrix[3].x*2.1+instanceMatrix[3].z*1.7;float env=cos(position.y*3.14159265);transformed.x+=sin(uTime*(.55-.25*uSlack)+ph)*env*(.012+.05*uSlack);transformed.z+=cos(uTime*(.4-.18*uSlack)+ph*1.3)*env*(.008+.04*uSlack);');
  const threads = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.008, 0.008, 1, 5, 14, true), mat, 48), m4 = new THREE.Matrix4();
  for (let i = 0; i < 48; i++) {
    const a = i * 2.39996, r = 1.3 + 4.2 * Math.sqrt((i + 0.5) / 48); let x = Math.cos(a) * r; const z = Math.sin(a) * r;
    if (Math.abs(x) < 0.5 && z > 1.5) x += x < 0 ? -0.9 : 0.9; // couloir libre pour la caméra
    m4.compose(new THREE.Vector3(L.x + x, 3.3, L.z + z), new THREE.Quaternion(), new THREE.Vector3(1, 6.6, 1)); threads.setMatrixAt(i, m4);
  }
  threads.frustumCulled = false; group.add(threads);
  // Bol satiné + onde concentrique (uRippleTime).
  const pts = [[0, 0], [0.18, 0], [0.24, 0.03], [0.5, 0.2], [0.62, 0.42], [0.59, 0.42], [0.47, 0.22], [0.2, 0.07], [0, 0.06]].map(p => new THREE.Vector2(p[0], p[1]));
  const bowlMat = new THREE.MeshPhysicalMaterial({ color: 0x554135, roughness: 0.65, clearcoat: 0.25, clearcoatRoughness: 0.5, side: THREE.DoubleSide });
  bowlMat.onBeforeCompile = sh => {
    sh.uniforms.uRippleTime = uRipple;
    sh.vertexShader = 'varying vec3 vLoc;\n' + sh.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\nvLoc=position;');
    sh.fragmentShader = 'uniform float uRippleTime;varying vec3 vLoc;\n' + sh.fragmentShader.replace('#include <emissivemap_fragment>',
      '#include <emissivemap_fragment>\nfloat rr=length(vLoc.xz);float fd=(1.-smoothstep(0.,2.8,uRippleTime))*step(0.,uRippleTime);float rg=exp(-pow((rr-uRippleTime*.26)*22.,2.))+.6*exp(-pow((rr-(uRippleTime-.5)*.26)*22.,2.));totalEmissiveRadiance+=vec3(1.,.82,.55)*rg*fd*1.4;');
  };
  const bowl = new THREE.Mesh(new THREE.LatheGeometry(pts, 64), bowlMat); bowl.position.set(L.x, L.y - 0.37, L.z);
  group.add(bowl);
  const pebble = new THREE.Mesh(
    new THREE.IcosahedronGeometry(0.13, 2),
    new THREE.MeshStandardMaterial({ color: 0xbe9b67, roughness: 0.79 })
  );
  pebble.position.copy(bowl.position);
  pebble.position.y += 0.89;
  pebble.scale.set(1.18, 0.75, 0.94);
  group.add(pebble);
  let fall = null;
  const glow = new THREE.Mesh(new THREE.SphereGeometry(0.06, 20, 14), new THREE.MeshBasicMaterial({ color: 0xffdca0 })); glow.position.set(L.x, L.y - 0.12, L.z); glow.scale.setScalar(0.001); group.add(glow);
  const lamp = new THREE.PointLight(0xffd9a0, 0, 4, 1.6); lamp.position.copy(glow.position).y += 0.15; group.add(lamp);
  // Cinq repères discrets renvoient aux illustrations intégrales.
  const alcoves = anchors.fragments.map((p, i) => {
    const a = new THREE.Group(); a.position.copy(p); a.lookAt(L.x, p.y, L.z); group.add(a);
    const back = new THREE.Mesh(new THREE.BoxGeometry(1, 0.53, 0.03), new THREE.MeshStandardMaterial({ color: 0xeadbc6, roughness: 0.7, emissive: 0xffc98a, emissiveIntensity: 0 }));
    back.position.z = -0.06; back.scale.x = 0.9; a.add(back);
    const pic = illustration(entree.fragments[i]?.image, 0.45, (mesh, ratio) => { back.scale.x = 0.45 * ratio + 0.08; ctx.invalidate(); });
    pic.userData.fragment = i; pic.material.color.setScalar(0.8); a.add(pic);
    return { back, pic, warm: 0, target: 0 };
  });
  let glowT = 0, slackT = 0, hover = null, chosen = null;
  const retarget = () => alcoves.forEach((al, i) => { al.target = i === chosen ? 1 : i === hover ? 0.7 : 0; });
  return {
    crossingMs: 4400, glideMax: 5, pickables: alcoves.map(a => a.pic), gesturePickables: [bowl, pebble],
    update(dt, time, quiet) {
      if (!quiet) uTime.value = time;
      if (uRipple.value < 10) uRipple.value += dt;
      if (fall !== null) {
        fall = quiet ? 1 : Math.min(1, fall + dt / 0.56);
        pebble.position.y = bowl.position.y + THREE.MathUtils.lerp(0.89, 0.18, fall ** 2);
        if (fall === 1) { fall = null; glowT = 1; slackT = 4.5; uRipple.value = quiet ? 99 : 0; }
      }
      if (slackT > 0) slackT -= dt;
      const k = quiet ? 1 : Math.min(1, dt * 3);
      uSlack.value += ((slackT > 0 ? 1 : 0) - uSlack.value) * (quiet ? 1 : Math.min(1, dt * 0.9));
      const gs = glow.scale.x + (Math.max(0.001, glowT) - glow.scale.x) * k; glow.scale.setScalar(gs); lamp.intensity = gs * 1.8;
      alcoves.forEach(al => { al.warm += (al.target - al.warm) * k; al.pic.material.color.setScalar(0.8 + 0.2 * al.warm); al.back.material.emissiveIntensity = 0.55 * al.warm; });
    },
    gesture(quiet) { fall = 0; return 'Le galet se dépose dans le bol. Les fils se détendent.'; },
    warm(i) { hover = i; retarget(); }, select(i) { chosen = i; retarget(); },
  };
}
