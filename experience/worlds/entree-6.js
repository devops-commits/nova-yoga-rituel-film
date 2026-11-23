// Entrée 06 · Le courant suspendu — raccord oblique (lacet ≤ 25°, zéro roulis) à travers un pli végétal.
import * as THREE from 'three';
import { anchor, dome, sway, illustration, plate } from './demo-kit.js';
const SPOTS = [[-2.4, 1.32, -1.2], [-1.2, 1.38, -2.7], [0, 1.3, -0.5], [1.2, 1.4, -3.3], [2.4, 1.34, -1.9]];
const sm = x => { x = Math.min(1, Math.max(0, x)); return x * x * (3 - 2 * x); };
export function buildDecor(entree) {
  const g = new THREE.Group();
  g.add(dome('#e3f1e8', '#7fae9a'));
  // Décor de profondeur : la vue du film éclaire le pli végétal depuis le fond.
  if (entree && entree.planche) {
    const board = plate(entree.planche, { width: 32, color: 0xffffff, toneMapped: false, fallback: entree.cover });
    board.position.set(0, 0.3, -9.4); board.renderOrder = -12; g.add(board);
    const haze = plate(null, { width: 7.5, color: 0xdff2e8, opacity: 0.08, toneMapped: false, ratio: 1 });
    haze.position.set(1.4, 1.2, -5.2); haze.renderOrder = -11; g.add(haze);
  }
  const bed = new THREE.Mesh(new THREE.PlaneGeometry(60, 60), new THREE.MeshStandardMaterial({ color: 0x143a33, roughness: 0.9 })); bed.rotation.x = -Math.PI / 2; bed.position.y = -0.7; if (!entree?.planche) g.add(bed);
  // Pli végétal opaque : deux feuilles courbées, passage étroit entre elles.
  const leafGeo = new THREE.PlaneGeometry(5, 7, 14, 10), pos = leafGeo.attributes.position;
  for (let i = 0; i < pos.count; i++) pos.setZ(i, Math.sin(pos.getX(i) * 0.9) * 0.45 + Math.cos(pos.getY(i) * 0.6) * 0.2);
  leafGeo.computeVertexNormals();
  const leafMat = new THREE.MeshStandardMaterial({ color: 0x2f5a45, roughness: 0.8, side: THREE.DoubleSide });
  [[-4.35, 0.35], [1.55, -0.3]].forEach(([x, ry]) => { const leaf = new THREE.Mesh(leafGeo, leafMat); leaf.position.set(x, 2.6, 6.6); leaf.rotation.y = ry; g.add(leaf); });
  g.add(new THREE.HemisphereLight(0xeafff4, 0x2b5a4c, 1.2));
  const sun = new THREE.DirectionalLight(0xfff3d6, 1.3); sun.position.set(-3, 6, 3); g.add(sun);
  anchor(g, 'orbit', -3.4, 1.5, 10.5); anchor(g, 'surface', -2.9, 1.45, 9);
  anchor(g, 'crossing', -2.6, 1.45, 8.2); anchor(g, 'arrival', 0, 1.3, 4.6); anchor(g, 'lookTarget', 0, 1.15, -1.2);
  SPOTS.forEach((p, i) => anchor(g, `fragment_${i + 1}`, p[0], p[1], p[2]));
  return g;
}
export function buildProps(group, anchors, entree, ctx) {
  const uTime = { value: 0 }, uWave = { value: -1 };
  // Plan d'eau unique : normales défilantes, Fresnel, caustiques légères, une onde lente à la demande.
  const water = new THREE.Mesh(new THREE.PlaneGeometry(60, 60), new THREE.ShaderMaterial({
    transparent: true, depthWrite: false,
    uniforms: { uTime, uWave, uDeep: { value: new THREE.Color(0x1d5a4e) }, uSky: { value: new THREE.Color(0xdff2e8) } },
    vertexShader: 'varying vec3 vW;void main(){vec4 w=modelMatrix*vec4(position,1.);vW=w.xyz;gl_Position=projectionMatrix*viewMatrix*w;}',
    fragmentShader: `uniform float uTime;uniform float uWave;uniform vec3 uDeep;uniform vec3 uSky;varying vec3 vW;
void main(){vec2 p=vW.xz;float r=length(p)+1e-4;float q=r-uWave*1.1;
float wave=uWave<0.?0.:sin(q*3.)*exp(-q*q*.8)*(1.-smoothstep(5.,8.,uWave));
vec2 n=vec2(sin(p.x*1.3+uTime*.5)+sin(p.y*2.1-uTime*.35),cos(p.y*1.7+uTime*.4)+cos(p.x*2.3+uTime*.3))*.06+wave*.5*p/r;
vec3 N=normalize(vec3(n.x,1.,n.y));vec3 V=normalize(cameraPosition-vW);float f=pow(1.-max(dot(N,V),0.),3.);
float ca=pow(max(0.,sin(p.x*3.+n.x*20.+uTime*.6)*sin(p.y*3.2+n.y*20.-uTime*.5)),3.)*.22;
gl_FragColor=vec4(mix(uDeep,uSky,f)+ca*vec3(.9,1.,.85)+wave*.24,.27 + .2*abs(wave));
#include <tonemapping_fragment>
#include <colorspace_fragment>
}`,
  }));
  water.rotation.x = -Math.PI / 2; water.renderOrder = 1; group.add(water);
  // 3 voiles max, renderOrder explicite, décalés pour ne jamais se superposer entre eux.
  [[-3.7, -2.2, 0.25], [3.7, -2.8, -0.25], [0.5, -6.2, 0]].forEach(([x, z, ry], i) => {
    const veil = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 4.4, 8, 18), sway(new THREE.MeshStandardMaterial({ color: 0xf7efe5, transparent: true, opacity: 0.3, side: THREE.DoubleSide, depthWrite: false, roughness: 0.9 }), { uTime },
      'transformed.z+=sin(uTime*.5+position.y*1.4+position.x*2.)*.12*(.5-uv.y+.5);'));
    veil.position.set(x, 2.5, z); veil.rotation.y = ry; veil.renderOrder = 2 + i; group.add(veil);
  });
  // Bulles : un InstancedMesh, Fresnel additif, depthWrite false. Les 5 premières accompagnent les fragments.
  const COUNT = 60, rise = new Float32Array(COUNT), m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), v = new THREE.Vector3(), s = new THREE.Vector3();
  const geo = new THREE.SphereGeometry(1, 18, 12);
  const bubbles = new THREE.InstancedMesh(geo, new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, uniforms: { uTime, uColor: { value: new THREE.Color(0xeafff2) } },
    vertexShader: 'attribute float aRise;uniform float uTime;varying float vF;void main(){vec4 w=modelMatrix*instanceMatrix*vec4(position,1.);float b=instanceMatrix[3].y;w.y+=mod(b+uTime*aRise,5.)-b;w.x+=sin(uTime*.6+b*9.)*.05*step(.001,aRise);vec3 N=normalize(mat3(modelMatrix*instanceMatrix)*normal);vec3 V=normalize(cameraPosition-w.xyz);vF=pow(1.-abs(dot(N,V)),2.5);gl_Position=projectionMatrix*viewMatrix*w;}',
    fragmentShader: 'uniform vec3 uColor;varying float vF;void main(){gl_FragColor=vec4(uColor*vF*.9,vF);}',
  }), COUNT);
  const big = SPOTS.map(p => ({ x: p[0], z: p[2] + 0.12, y: 0.3, to: 0.3 }));
  const place = (i, x, y, z, r) => { m4.compose(v.set(x, y, z), q, s.setScalar(r)); bubbles.setMatrixAt(i, m4); };
  for (let i = 0; i < COUNT; i++) {
    if (i < 5) { place(i, big[i].x, big[i].y, big[i].z, 0.15); rise[i] = 0; continue; }
    const a = i * 2.39996, r = 0.8 + 4.6 * Math.sqrt(i / COUNT);
    place(i, Math.cos(a) * r, (i * 0.37) % 4.6 + 0.1, Math.sin(a) * r - 1.5, 0.03 + (i % 5) * 0.012); rise[i] = 0.06 + (i % 7) * 0.015;
  }
  geo.setAttribute('aRise', new THREE.InstancedBufferAttribute(rise, 1));
  bubbles.renderOrder = 5; bubbles.frustumCulled = false; group.add(bubbles);
  const droplet = new THREE.Mesh(
    new THREE.SphereGeometry(0.12, 20, 12),
    new THREE.MeshPhysicalMaterial({color: 0xb4e9d5, roughness: 0.14, metalness: 0.15, clearcoat: 1})
  );
  droplet.position.set(0, 1.25, -0.1);
  droplet.scale.y = 1.45;
  group.add(droplet);
  let fall = null;
  // Cinq repères discrets renvoient aux illustrations intégrales.
  const cards = anchors.fragments.map((p, i) => {
    const pic = illustration(entree.fragments[i]?.image, 0.38, () => ctx.invalidate());
    pic.position.copy(p); pic.userData.fragment = i; pic.material.color.setScalar(0.84); group.add(pic);
    return { pic, base: p.y, warm: 0, target: 0 };
  });
  let hover = null, chosen = null;
  const retarget = () => cards.forEach((c, i) => { c.target = i === chosen ? 1 : i === hover ? 0.7 : 0; big[i].to = i === chosen ? 2.45 : 0.3; });
  return {
    crossingMs: 4900, glideMax: 6, pickables: cards.map(c => c.pic), gesturePickables: [droplet],
    // 25° de lacet au départ, redressement en 1,2 s (70 % de la phase monde), horizon stable ensuite.
    yawAt: w => (25 * Math.PI / 180) * (1 - sm(w / 0.7)),
    update(dt, time, quiet) {
      if (!quiet) uTime.value = time;
      if (fall !== null) {
        fall = quiet ? 1 : Math.min(1, fall + dt / 0.62);
        droplet.position.y = 0.1 + 1.15 * (1 - fall ** 2);
        if (fall === 1) { fall = null; droplet.visible = false; uWave.value = quiet ? 0.65 : 0; }
      }
      if (!quiet && uWave.value >= 0) { uWave.value += dt; if (uWave.value > 8) uWave.value = -1; }
      const k = quiet ? 1 : Math.min(1, dt * 3);
      cards.forEach((c, i) => {
        c.warm += (c.target - c.warm) * k; c.pic.material.color.setScalar(0.84 + 0.16 * c.warm);
        c.pic.position.y = c.base + (quiet ? 0 : Math.sin(time * 0.5 + i * 1.3) * 0.04);
        const b = big[i]; b.y += (b.to - b.y) * (quiet ? 1 : Math.min(1, dt * 0.8)); place(i, b.x, b.y, b.z, 0.15);
      });
      bubbles.instanceMatrix.needsUpdate = true;
    },
    gesture(quiet) { droplet.visible = true; fall = 0; return 'La goutte touche l’eau et l’onde traverse le courant.'; },
    warm(i) { hover = i; retarget(); }, select(i) { chosen = i; retarget(); },
  };
}
