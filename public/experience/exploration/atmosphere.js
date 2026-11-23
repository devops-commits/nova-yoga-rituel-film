import * as THREE from 'three';
import {finishPhotographicMaterials} from './photographic.js';

// Raccord avec la dernière image du survol Flow (images/sous-la-peau/plateforme-libre.jpg), vue de la clairière.
// Tout ce qui touche le lac et les massifs est pondéré par « loin » : nul sur les plans d'ouverture au bord
// du lac (caméra z ≥ 34), entier dans la clairière et les mondes (z ≤ 10). Réglages regroupés ici.
export const RACCORD={
  variation:.34,   // amplitude de la variation de teinte à grande échelle de la pierre (±17 %)
  rose:.05,        // glissement rosé ↔ gris de cette variation
  joint:.30,       // assombrissement des joints de la terrasse (1 cm, 8 dalles au cœur, 16 en couronne)
  poli:.42,        // baisse de rugosité des plages polies : reflets du ciel
  brume:'vec3(.62,.52,.52)',    // brume de rive (rose très pâle)
  voile:'vec3(.30,.30,.36)',    // voile atmosphérique des crêtes (lavande)
  loin:'(1.-smoothstep(10.,34.,cameraPosition.z))',
  // — Ciel et lac vus de la terrasse centrale (photographic.js : plaque des massifs et eau) —
  // Poids « clairière » : entier à moins de 5,5 m du centre, nul au-delà de 11,5 m. Les cinq poses de
  // capture-3d.mjs (rayons 11,9 à 36 m), le bord du lac, la goutte et les intérieurs restent donc inchangés.
  clairiere:'(1.-smoothstep(5.5,11.5,length(cameraPosition.xz)))',
  crete:.90,       // échelle verticale des massifs depuis la clairière (1 = film brut ; .41 ≈ plus haute crête visible à 27 % du cadre)
  ciel:1,          // part du ciel clair au-dessus des crêtes (0 = ciel photographié du film, sombre)
  cielBas:'vec3(.64,.53,.565)',   // ciel juste au-dessus des crêtes (rosé clair ≈ 209,192,198 sRGB)
  cielHaut:'vec3(.28,.315,.465)', // ciel vers le zénith (lavande ≈ 144,152,180 sRGB)
  cielPente:[.38,.75],            // tangentes d'élévation entre lesquelles court le dégradé bas → haut
  nuages:.35,      // nuages du film gardés en clair rosé (0 = ciel uni)
  nuage:'vec3(.80,.66,.66)',
  // Clé « ciel » lue dans la photo du lac (art/outils/masque-ciel.mjs → lac-ciel.png) : le ciel clair n'est posé
  // que là où la photo est du ciel ; sommets enneigés et crêtes lointaines restent photographiques.
  masqueCiel:new URL('../../images/sous-la-peau/lac-ciel.png',import.meta.url).href,
  cielBord:[.35,.65],             // seuils de la clé le long des crêtes (resserrer = bord plus net, baisser = ciel qui mord moins)
  cretesAir:.30,   // perspective aérienne : part de voile sur le faîte des crêtes lointaines (0 = photo brute)
  cretesTeinte:'vec3(.42,.40,.50)', // teinte de ce voile (lavande clair ≈ 173,170,187 sRGB)
  nuagesLegers:.22,               // nuages légers ajoutés au-dessus des crêtes (0 = aucun)
  nuagesPente:[.07,.20,.30,.44],  // tangentes d'élévation : apparition, plein, déclin, disparition (zone « ciel » mesurée ≥ .51, intacte)
  lac:'vec3(.205,.19,.235)',      // eau lointaine lavande-gris (≈ 125,121,133 sRGB ; cible 126,121,134)
  lacRive:-.0235,  // tangente d'élévation de la ligne d'eau (−.0235 ≈ ligne 374 px sur 720 à FOV 63°)
  lacFondu:.85,    // part de la teinte « lac » sur l'eau réelle près de la rive lointaine (remplace la brume laiteuse)
  lisere:.80,      // liseré de brume claire posé juste au-dessus de la ligne d'eau (0 = aucun)
  lisereTeinte:'vec3(.85,.66,.63)',
  lisereHaut:[-.010,.008],        // centre et demi-largeur du liseré, en tangente d'élévation
};
let skyMaterial=null;

// Pierre de la terrasse : variation en coordonnées du monde (aucune répétition de tuile), joints discrets
// tracés à l'échelle réelle, plages plus polies qui prennent le ciel. S'ajoute au grain fin du GLB.
function terraceStone(mat){
  const previous=mat.onBeforeCompile;
  mat.onBeforeCompile=function(shader,renderer){
    previous.call(this,shader,renderer);
    shader.fragmentShader=`
      float nvHash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
      float nvNoise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(nvHash(i),nvHash(i+vec2(1,0)),f.x),mix(nvHash(i+vec2(0,1)),nvHash(i+vec2(1)),f.x),f.y);}
      float nvStone(vec2 p){return nvNoise(p*.13)*.50+nvNoise(p*.41+17.)*.30+nvNoise(p*1.7+5.)*.20;}
      float nvJoint(float d,float w){float aa=max(fwidth(d),.0001);return (1.-smoothstep(w-aa,w+aa,d))*clamp(w/aa,0.,1.);}
      float nvJoints(vec2 p){
        // Sans branche : les derivees (fwidth) restent definies partout.
        float r=length(p),a=atan(p.y,p.x);
        float line=max(nvJoint(abs(r-1.9),.005),nvJoint(abs(r-6.35),.005));
        float heart=nvJoint(abs(fract(a/.7853982)-.5)*.7853982*r,.004)*step(1.9,r)*step(r,6.35);
        float crown=nvJoint(abs(fract(a/.3926991)-.5)*.3926991*r,.004)*step(6.35,r);
        return max(line,max(heart,crown))*step(r,10.86);
      }
      `+shader.fragmentShader.replace('#include <map_fragment>',`#include <map_fragment>
        float nvBig=nvStone(vGround.xz);
        float nvLine=nvJoints(vGround.xz)*step(abs(vGround.y),.06);
        diffuseColor.rgb*=(1.+${RACCORD.variation}*(nvBig-.5))*vec3(1.+${RACCORD.rose}*(nvBig-.5),1.,1.-${RACCORD.rose}*(nvBig-.5))*(1.-${RACCORD.joint}*nvLine);`)
      .replace('#include <roughnessmap_fragment>',`#include <roughnessmap_fragment>
        roughnessFactor=clamp(roughnessFactor*mix(1.-${RACCORD.poli},1.04,smoothstep(.30,.72,nvStone(vGround.xz*1.9+31.)))+.25*nvLine,.18,1.);`);
  };
  mat.customProgramCacheKey=()=>'chalk-raccord-plateforme';
}

export function atmosphere(scene) {
  scene.background=new THREE.Color(0xcfc3b8);
  scene.fog=new THREE.FogExp2(0xb9bbb8,.0068);
  scene.add(new THREE.HemisphereLight(0xffefe3,0x807b81,1.1));
  const sun=new THREE.DirectionalLight(0xffdfb5,2.15);
  sun.position.set(-36,58,-26);
  Object.assign(sun.shadow.camera,{left:-52,right:52,top:68,bottom:-68,near:.5,far:165});
  sun.castShadow=true;sun.shadow.mapSize.set(2048,2048);sun.shadow.normalBias=.065;sun.shadow.bias=-.0003;
  scene.add(sun);
  const rim=new THREE.DirectionalLight(0xb5e0ef,.7);
  rim.position.set(22,14,30);scene.add(rim);
  const sky=new THREE.Mesh(new THREE.SphereGeometry(185,48,24),new THREE.ShaderMaterial({
    side:THREE.BackSide,depthWrite:false,uniforms:{uRaccord:{value:0}},
    vertexShader:'varying vec3 vDir; void main(){vDir=position;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
    fragmentShader:`
      varying vec3 vDir;
      uniform float uRaccord;
      float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
      float noise2(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(hash(i),hash(i+vec2(1,0)),f.x),mix(hash(i+vec2(0,1)),hash(i+vec2(1)),f.x),f.y);}
      void main(){
        vec3 d=normalize(vDir); float h=max(0.,d.y);
        vec3 light=normalize(vec3(-.49,.25,-.82));
        float s=max(dot(d,light),0.);
        vec3 col=mix(vec3(.68,.53,.43),vec3(.14,.28,.43),smoothstep(-.04,.69,h));
        vec2 uv=d.xz/(h+.16)*vec2(1.4,6.);
        float cloud=noise2(uv)*.52+noise2(uv*2.1)*.28+noise2(uv*4.3)*.12+noise2(uv*9.)*.08;
        col=mix(col,vec3(.94,.83,.72),smoothstep(.49,.71,cloud)*.54*smoothstep(.005,.16,h));
        col=mix(col*.48,vec3(.38,.27,.24),.12*pow(s,10.));
        // Sous l'horizon, vu de la clairiere : la brume de rive, pas un lisere chaud. uRaccord reste a 0
        // pendant le calcul de l'environnement (engine.js), l'eclairage ambiant ne change donc pas.
        col=mix(col,${RACCORD.brume},uRaccord*${RACCORD.loin}*(1.-smoothstep(-.035,.012,d.y)));
        gl_FragColor=vec4(col,1.);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`
  }));
  sky.renderOrder=-10;scene.add(sky);skyMaterial=sky.material;
}

// Fond de la salle du monde 4 (trois « Grand voile de lin », dont l'écran film0) et relique « Voile du souffle » :
// présents dans la salle, absents de la vue de la clairière (la cible n'y montre que le voile tendu devant les
// montagnes). Visibilité = 1 − smoothstep(plein, nul, distance horizontale caméra → centre de la salle), en mètres.
// Sur l'axe du passage : rien jusqu'à 14 m du centre de la clairière, tout à partir de 24 m.
export const FONDU_MONDE4={centre:[0,-33],plein:9,nul:19};
const glsl=n=>Number(n).toFixed(2);

// Fondu sans tri de transparence : les matériaux restent opaques (profondeur écrite, passe opaque), les fragments
// sont écartés par une trame ordonnée fixe à l'écran, la même que celle du rivage (photographic.js, lakeReveal).
function fonduMonde4(mat){
  const previous=mat.onBeforeCompile,previousKey=mat.customProgramCacheKey();
  mat.onBeforeCompile=function(shader,renderer){
    previous.call(this,shader,renderer);
    shader.fragmentShader=shader.fragmentShader.replace('#include <clipping_planes_fragment>',`#include <clipping_planes_fragment>
      float fond4=1.-smoothstep(${glsl(FONDU_MONDE4.plein)},${glsl(FONDU_MONDE4.nul)},distance(cameraPosition.xz,vec2(${glsl(FONDU_MONDE4.centre[0])},${glsl(FONDU_MONDE4.centre[1])})));
      if(fond4<.999){
        float trame4=fract(52.9829189*fract(dot(floor(gl_FragCoord.xy),vec2(.06711056,.00583715))));
        if(fond4<=trame4)discard;
      }`);
  };
  mat.customProgramCacheKey=()=>previousKey+'-fond4';
  mat.needsUpdate=true;
}
function fondMonde4(obj){
  const nom=obj.material?.name;
  if(obj.name==='Relique4')return nom==='silk';
  if(nom!=='silk'&&nom!=='film0')return false;
  for(let o=obj;o;o=o.parent)if(/^Monde[ _]?04/.test(o.name))return true;
  return false;
}

export function movingFilm(root) {
  const video=document.createElement('video');
  Object.assign(video,{muted:true,loop:true,playsInline:true,preload:'auto'});
  video.setAttribute('playsinline','');
  const standard='worlds/film-huit-plans.mp4';
  const hd=!matchMedia('(pointer:coarse)').matches && !navigator.connection?.saveData;
  video.src=hd?'worlds/film-huit-plans-hd.mp4':standard;
  if(hd)video.addEventListener('error',()=>{video.src=standard;play();},{once:true});
  const texture=new THREE.VideoTexture(video);texture.colorSpace=THREE.SRGBColorSpace;texture.flipY=false;
  let active=false;
  const groundShadow=new THREE.TextureLoader().load('worlds/ombres-sol.png');
  const films=new Set(),fonds4=new Set();
  const lakeTime={value:0};
  if(skyMaterial)skyMaterial.uniforms.uRaccord.value=1;
  root.traverse(obj=>{
    if(!obj.isMesh)return;
    obj.receiveShadow=true;obj.castShadow=true;
    // Matériau propre aux voiles de fond et à la relique du monde 4 : 'silk' et 'film0' servent ailleurs.
    if(fondMonde4(obj)){obj.material=obj.material.clone();fonds4.add(obj.material);}
    for (const mat of [].concat(obj.material)){
      if(['chalk','basalt','clay','rose','brass','brass4','copper','jade','ink','silk','ash'].includes(mat.name)){
        mat.onBeforeCompile=shader=>{
          shader.uniforms.uGroundShade={value:groundShadow};
          shader.vertexShader='varying vec3 vGround;\n'+shader.vertexShader.replace('#include <worldpos_vertex>','#include <worldpos_vertex>\n vGround=(modelMatrix*vec4(transformed,1.)).xyz;');
          shader.fragmentShader='varying vec3 vGround;uniform sampler2D uGroundShade;\n'+shader.fragmentShader.replace('#include <opaque_fragment>',`
            float shade=texture2D(uGroundShade,vec2((vGround.x+48.)/96.,(-vGround.z+68.)/116.)).r;
            outgoingLight*=mix(1.,shade,1.-smoothstep(.08,.85,vGround.y));
            #include <opaque_fragment>`);
        };
        if(mat.name==='chalk')terraceStone(mat);
      }
      if(mat.name==='alpes'){
        // The film carries the light of the distant mountains.
        mat.emissiveMap=mat.map;mat.emissive.setRGB(.78,.83,.91);mat.emissiveIntensity=1;
        mat.color.setScalar(.10);mat.metalness=0;mat.roughness=1;
        // Depuis la clairière : crêtes fondues dans l'air, brume de rive au pied des massifs (à la place du trait vif).
        mat.onBeforeCompile=shader=>{
          shader.vertexShader='varying float vAlpesY;\n'+shader.vertexShader.replace('#include <worldpos_vertex>','#include <worldpos_vertex>\n vAlpesY=(modelMatrix*vec4(transformed,1.)).y;');
          shader.fragmentShader='varying float vAlpesY;\n'+shader.fragmentShader.replace('#include <emissivemap_fragment>',`#include <emissivemap_fragment>
            float alpesLoin=${RACCORD.loin};
            float alpesBas=1.-smoothstep(0.,42.,vAlpesY);
            vec3 alpesAir=mix(totalEmissiveRadiance*1.18,${RACCORD.voile},.10+.30*alpesBas*alpesBas);
            alpesAir=mix(alpesAir,${RACCORD.brume},.62*(1.-smoothstep(.4,7.,vAlpesY)));
            totalEmissiveRadiance=mix(totalEmissiveRadiance,alpesAir,alpesLoin);`);
        };
      }
      if(mat.name==='brass4'){
        // Arche centrale seule (raccord) : laiton clair satiné qui prend le ciel. Cible 136,116,108 contre 90,73,58,
        // soit ×1,95 / ×1,95 / ×2,3 en lumière de scène (ACES inversé) : teinte claire dans le GLB, reflet du ciel
        // renforcé ici, et un fond chaud qui tient lieu de ciel rosé sur la face à l'ombre.
        mat.roughness=.86;mat.envMapIntensity=1.2;mat.emissive.setRGB(.022,.008,.005);mat.emissiveIntensity=1;
      }
      if(mat.name==='film2'){mat.metalness=.48;mat.roughness=.115;mat.envMapIntensity=1.65;}
      if(mat.name==='water'){
        mat.onBeforeCompile=shader=>{
          shader.uniforms.uLakeTime=lakeTime;
          shader.vertexShader='varying vec3 vLake;\n'+shader.vertexShader.replace('#include <worldpos_vertex>','#include <worldpos_vertex>\n vLake=(modelMatrix*vec4(transformed,1.)).xyz;');
          shader.fragmentShader='varying vec3 vLake;uniform float uLakeTime;\n'+shader.fragmentShader.replace('#include <normal_fragment_maps>',`#include <normal_fragment_maps>
vec2 lakeP = vLake.xz;
float lakeT = uLakeTime;
vec2 lakeG = vec2(0.0);
vec2 lakeD1 = normalize(vec2(0.92, 0.38));
float lakeC1 = cos(dot(lakeP, lakeD1) * 1.7 + lakeT * 0.85);
lakeG += lakeD1 * (0.055 * 1.7 * lakeC1);
vec2 lakeD2 = normalize(vec2(-0.31, 0.95));
float lakeC2 = cos(dot(lakeP, lakeD2) * 2.9 - lakeT * 1.15);
lakeG += lakeD2 * (0.030 * 2.9 * lakeC2);
vec2 lakeD3 = normalize(vec2(0.72, -0.69));
float lakeC3 = cos(dot(lakeP, lakeD3) * 5.3 + lakeT * 1.7);
lakeG += lakeD3 * (0.014 * 5.3 * lakeC3);
vec2 lakeD4 = normalize(vec2(-0.88, -0.47));
float lakeC4 = cos(dot(lakeP, lakeD4) * 19.0 - lakeT * 3.1) * pow(1.0 - clamp(abs(normal.z), 0.0, 1.0), 2.0);
lakeG += lakeD4 * (0.0035 * 19.0 * lakeC4);
normal = normalize(normal + 0.65 * (viewMatrix * vec4(vec3(-lakeG.x, 0.0, -lakeG.y), 0.0)).xyz);`);
        };
      }
      if(mat.name==='veil'){
        // Voile tendu du monde 4 (raccord avec la fin du survol) : tissu fin, double face, lu en transparence,
        // sans ombre portée dure. Seul le bord libre respire : uv.y vaut 1 sur la lisière basse, 0 sur la
        // lisière haute, et uv.x/4 court d'une pointe tenue à l'autre. Mouvement coupé avec lakeTime (réduit).
        mat.transparent=true;mat.opacity=.62;mat.depthWrite=false;mat.side=THREE.DoubleSide;mat.alphaTest=0;
        // Blanc lumineux et chaud (cible 174,157,156 contre 144,146,147 : +0,067 / +0,021 / +0,017 en lumière de
        // scène). La lueur du tissu porte l'essentiel, modulée par l'orientation des plis pour qu'ils restent lus.
        mat.emissive.setRGB(.27,.195,.185);mat.emissiveIntensity=1;mat.envMapIntensity=.35;
        obj.castShadow=false;obj.renderOrder=2;
        mat.onBeforeCompile=shader=>{
          shader.uniforms.uVeilTime=lakeTime;
          shader.vertexShader='uniform float uVeilTime;\n'+shader.vertexShader.replace('#include <begin_vertex>',`#include <begin_vertex>
            float veilFree=uv.y*uv.y*sin(3.14159*clamp(uv.x*.25,0.,1.));
            transformed+=normal*(veilFree*.12*sin(uVeilTime*.8+uv.x*4.7));`);
          // Plis : la lueur suit la face tournée vers le ciel du couchant (moyenne ≈ 1, creux ×0,62, crêtes ×1,45).
          shader.fragmentShader=shader.fragmentShader.replace('#include <emissivemap_fragment>',`#include <emissivemap_fragment>
            float veilPli=abs(dot(inverseTransformDirection(normal,viewMatrix),vec3(.35,.80,.49)));
            totalEmissiveRadiance*=mix(.62,1.45,smoothstep(.05,.85,veilPli));`);
        };
        mat.customProgramCacheKey=()=>'veil';
      }
      if(/^film[0-7]$/.test(mat.name))films.add(mat);
      if(fonds4.has(mat))fonduMonde4(mat);
    }
  });
  function apply(){
    if(active)return;
    active=true;filmMix.value=1;
    for(const mat of films){
      const slot=Number(mat.name.slice(4));
      mat.map=texture;mat.emissiveMap=null;mat.emissive.setRGB(.028,.021,.018);
      const offset=[(slot%4)*.25,Math.floor(slot/4)*.5];
      mat.onBeforeCompile=shader=>{
        shader.vertexShader=shader.vertexShader.replace('#include <uv_vertex>',
          '#include <uv_vertex>\nvMapUv = clamp(vMapUv,vec2(0.0015),vec2(0.9985))*vec2(.25,.5)+vec2('+offset[0].toFixed(2)+','+offset[1].toFixed(2)+');');
      };
      mat.customProgramCacheKey=()=>mat.name;
      lakeReveal(mat);
      if(fonds4.has(mat))fonduMonde4(mat);
      mat.needsUpdate=true;
    }
  }
  const filmMix={value:0};
  const lakeReveal=finishPhotographicMaterials(root,lakeTime,texture,filmMix,RACCORD);
  let enabled=!matchMedia('(prefers-reduced-motion: reduce)').matches;
  function play(){if(enabled&&!document.hidden) video.play().catch(()=>{});}
  video.addEventListener('playing',apply,{once:true});
  document.addEventListener('pointerdown',play,{passive:true});
  document.addEventListener('keydown',play);
  document.addEventListener('visibilitychange',()=>document.hidden?video.pause():play());
  if(enabled)play();
  return {video,update(dt){if(enabled)lakeTime.value+=dt;},get enabled(){return enabled;},setEnabled(value){enabled=value;if(value)play();else video.pause();}};
}
