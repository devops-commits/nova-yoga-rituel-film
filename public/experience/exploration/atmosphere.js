import * as THREE from 'three';
import {finishPhotographicMaterials} from './photographic.js';

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
    side:THREE.BackSide,depthWrite:false,
    vertexShader:'varying vec3 vDir; void main(){vDir=position;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
    fragmentShader:`
      varying vec3 vDir;
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
        gl_FragColor=vec4(col,1.);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`
  }));
  sky.renderOrder=-10;scene.add(sky);
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
  const films=new Set();
  const lakeTime={value:0};
  root.traverse(obj=>{
    if(!obj.isMesh)return;
    obj.receiveShadow=true;obj.castShadow=true;
    for (const mat of [].concat(obj.material)){
      if(['chalk','basalt','clay','rose','brass','jade','ink','silk'].includes(mat.name)){
        mat.onBeforeCompile=shader=>{
          shader.uniforms.uGroundShade={value:groundShadow};
          shader.vertexShader='varying vec3 vGround;\n'+shader.vertexShader.replace('#include <worldpos_vertex>','#include <worldpos_vertex>\n vGround=(modelMatrix*vec4(transformed,1.)).xyz;');
          shader.fragmentShader='varying vec3 vGround;uniform sampler2D uGroundShade;\n'+shader.fragmentShader.replace('#include <opaque_fragment>',`
            float shade=texture2D(uGroundShade,vec2((vGround.x+48.)/96.,(-vGround.z+68.)/116.)).r;
            outgoingLight*=mix(1.,shade,1.-smoothstep(.08,.85,vGround.y));
            #include <opaque_fragment>`);
        };
      }
      if(mat.name==='alpes'){
        // The film carries the light of the distant mountains.
        mat.emissiveMap=mat.map;mat.emissive.setRGB(.78,.83,.91);mat.emissiveIntensity=1;
        mat.color.setScalar(.10);mat.metalness=0;mat.roughness=1;
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
      if(/^film[0-7]$/.test(mat.name))films.add(mat);
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
      mat.needsUpdate=true;
    }
  }
  const filmMix={value:0};
  const lakeReveal=finishPhotographicMaterials(root,lakeTime,texture,filmMix);
  let enabled=!matchMedia('(prefers-reduced-motion: reduce)').matches;
  function play(){if(enabled&&!document.hidden) video.play().catch(()=>{});}
  video.addEventListener('playing',apply,{once:true});
  document.addEventListener('pointerdown',play,{passive:true});
  document.addEventListener('keydown',play);
  document.addEventListener('visibilitychange',()=>document.hidden?video.pause():play());
  if(enabled)play();
  return {video,update(dt){if(enabled)lakeTime.value+=dt;},get enabled(){return enabled;},setEnabled(value){enabled=value;if(value)play();else video.pause();}};
}
