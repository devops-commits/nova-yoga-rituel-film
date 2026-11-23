import * as T from 'three';
import {MeshoptDecoder} from '../../vendor/meshoptimizer/meshopt_decoder.module.js';
import {GLTFLoader} from '../../vendor/three/GLTFLoader.js';
import {atmosphere,movingFilm} from './atmosphere.js';
import {terrain} from './terrain.js';
import {createWalkInput} from './movement.js';

export async function createExpedition(canvas,callbacks){
  const renderer=new T.WebGLRenderer({canvas,antialias:true,powerPreference:'high-performance'});
  renderer.setPixelRatio(Math.min(devicePixelRatio,1.6));
  renderer.shadowMap.enabled=true;renderer.shadowMap.type=T.PCFSoftShadowMap;
  renderer.shadowMap.autoUpdate=false;
  renderer.toneMapping=T.ACESFilmicToneMapping;renderer.toneMappingExposure=.91;
  const scene=new T.Scene(),camera=new T.PerspectiveCamera(63,1,.06,540);
  camera.rotation.order='YXZ';
  atmosphere(scene);
  const pmrem=new T.PMREMGenerator(renderer);
  const environment=pmrem.fromScene(scene,.04,.1,250);
  scene.environment=environment.texture;
  scene.environmentIntensity=.58;
  pmrem.dispose();
  const [model,grid]=await Promise.all([
    new GLTFLoader().setMeshoptDecoder(MeshoptDecoder).loadAsync('worlds/sous-la-peau.glb'),
    fetch('worlds/marche.json').then(r=>{if(!r.ok)throw Error('Carte de marche indisponible');return r.json();})
  ]);
  const land=terrain(grid);
  scene.add(model.scene);
  // Filtrage anisotrope : sans lui, lin, bronze et photographies se brouillent en vue rasante.
  const anisotropy=Math.min(8,renderer.capabilities.getMaxAnisotropy());
  model.scene.traverse(o=>{
    if(o.isMesh)for(const m of [].concat(o.material))for(const key of ['map','emissiveMap','normalMap','roughnessMap','metalnessMap'])if(m[key])m[key].anisotropy=anisotropy;
  });
  const film=movingFilm(model.scene);
  renderer.shadowMap.needsUpdate=true;
  const directions=grid.angles.map(deg=>new T.Vector3(Math.sin(deg*Math.PI/180),0,-Math.cos(deg*Math.PI/180)));
  const relics=directions.map((_,i)=>model.scene.getObjectByName('Relique'+(i+1)));
  const origins=relics.map(o=>o?.position.clone());
  const input=createWalkInput(canvas,document.querySelector('#stick'),document.querySelector('#knob'));
  const compass=document.querySelector('#compass b'),marker=document.querySelector('#marker');
  let yaw=0,pitch=.02,paused=false,lastFrame=0,steps=[],scrollDistance=0,elapsed=0;
  let macro=false;
  let zone={kind:'',n:0},near=0,anim=0,animN=0,nextHud=0;
  const pos=camera.position;
  const clamp=(v,a,b)=>Math.min(b,Math.max(a,v));
  function place(n){
    const d=directions[n-1];
    const x=d?d.x*28:0,z=d?d.z*28:n===0?62:1.8;
    pos.set(x,1.62,z);
    yaw=d?Math.atan2(d.x,-d.z):n===0?-.035:0;pitch=n===0?.18:0;
    steps=[];scrollDistance=0;input.reset();updateHud(true);
  }
  function getZone(){
    if(Math.abs(pos.x)<7.5&&pos.z>10.6) return {kind:'shot',n:clamp(Math.round((48-pos.z)/5),0,7)};
    for(let i=0;i<7;i++){
      const d=directions[i],r=pos.x*d.x+pos.z*d.z,l=Math.abs(pos.x*d.z-pos.z*d.x);
      if(r>10.65&&l<(r>23?9.6:3.3)) return {kind:r>=24?'room':'passage',n:i+1};
    }
    return {kind:'hub',n:0};
  }
  const project=new T.Vector3();
  const atmosphereTints=[0xccb5a2,0xafa099,0x9a7771,0xb3cdcb,0xd0aa9b,0x89b5b5,0xc9b999];
  const fogTarget=new T.Color(0xb9bbb8);
  let densityTarget=.009;
  const roomLight=new T.PointLight(0xffd8a5,0,16,2);scene.add(roomLight);
  function updateHud(force=false){
    const next=getZone(),oldNear=near;
    near=0;marker.hidden=true;
    let aim=null,label='';
    if(next.kind==='room'){
      const d=directions[next.n-1],dist=Math.hypot(pos.x-d.x*35,pos.z-d.z*35);
      near=dist<5.4?next.n:0;
      aim=project.set(d.x*35,2.45,d.z*35);
      label=callbacks.gestureName(next.n);
    } else if(next.kind==='hub'||next.kind==='passage'){
      let best=-1;const range=next.kind==='hub'?26:16;
      for(let i=0;i<7;i++){
        const d=directions[i];
        const dx=d.x*14.4-pos.x,dz=d.z*14.4-pos.z,dist=Math.hypot(dx,dz);
        const score=(dx*Math.sin(yaw)-dz*Math.cos(yaw))/Math.max(dist,.001);
        if(score>.76&&score>best&&dist<range){
          best=score;aim=project.set(d.x*14.4,3.35,d.z*14.4);label=callbacks.name(i+1);
        }
      }
    }
    if(aim){
      aim.project(camera);
      if(Math.abs(aim.x)<.90&&Math.abs(aim.y)<.79&&aim.z>0&&aim.z<1){
        marker.hidden=false;marker.style.left=(50+50*aim.x)+'%';marker.style.top=(50-50*aim.y)+'%';marker.textContent=label;
      }
    }
    compass.textContent=['N','NE','E','SE','S','SO','O','NO'][(Math.round(yaw/(Math.PI/4))%8+8)%8];
    canvas.dataset.position=[pos.x,pos.z,yaw,pitch].map(n=>n.toFixed(3)).join(',');
    if(force||zone.kind!==next.kind||zone.n!==next.n||oldNear!==near){zone=next;
      const inside=zone.kind==='room';
      fogTarget.set(inside?atmosphereTints[zone.n-1]:0xb9bbb8);
      densityTarget=inside?[.040,.047,.066,.024,.044,.064,.040][zone.n-1]:zone.kind==='shot'&&zone.n>=3?.038:.009;
      roomLight.intensity=inside?34:0;
      if(inside){const d=directions[zone.n-1];roomLight.position.set(d.x*35+d.z*3.3,3.45,d.z*35-d.x*3.3);}
      callbacks.zone(zone,near);}
  }
  function move(dx,dz){
    const pieces=Math.max(1,Math.ceil(Math.hypot(dx,dz)/.15));
    for(let i=0;i<pieces;i++){
      if(land.free(pos.x+dx/pieces,pos.z))pos.x+=dx/pieces;
      if(land.free(pos.x,pos.z+dz/pieces))pos.z+=dz/pieces;
    }
  }
  function resize(){
    const {width,height}=canvas.getBoundingClientRect();
    renderer.setSize(width,height,false);camera.aspect=width/Math.max(1,height);camera.updateProjectionMatrix();
  }
  new ResizeObserver(resize).observe(canvas);resize();
  function perform(n){
    anim=0;animN=n;
    if(!film.enabled)animateRelic(1.6);
  }
  function animateRelic(dt){
    if(!animN)return;
    const n=animN,obj=relics[n-1],origin=origins[n-1];
    if(!obj||!origin){animN=0;return;}
    anim+=dt;const u=Math.min(1,anim/1.6),wave=Math.sin(Math.PI*u);
    obj.position.copy(origin);obj.scale.set(1,1,1);
    if(n===1){
      const direction=directions[0];
      const smooth=u*u*(3-2*u);
      obj.position.x+=(direction.z*1.55-direction.x*.16)*smooth;
      obj.position.z+=(-direction.x*1.55-direction.z*.16)*smooth;
      obj.position.y+=.92*wave+.13*smooth;
    }
    if(n===2)obj.scale.x=1+.16*wave*Math.sin(u*30);
    if(n===3)obj.scale.setScalar(1+.55*wave);
    if(n===4)obj.scale.x=1+.65*wave;
    if(n===5)obj.scale.x=1+.8*wave;
    if(n===6)obj.position.y-=.76*wave;
    if(n===7)obj.scale.y=1+.45*wave;
    if(u===1){animN=0;renderer.shadowMap.needsUpdate=true;}
  }
  function frame(now){
    requestAnimationFrame(frame);
    if(document.hidden){lastFrame=0;return;}
    const dt=lastFrame?Math.min(.20,(now-lastFrame)/1000):0;
    lastFrame=now;elapsed+=dt;
    if(!paused){
      const v=input.read(dt);
      yaw+=v.yaw;pitch=clamp(pitch+v.pitch,-1.20,1.20);
      const wheel=Math.sign(scrollDistance)*Math.min(Math.abs(scrollDistance),dt*7);
      scrollDistance-=wheel;
      if(v.forward||v.strafe||wheel){steps=[];
        const dist=dt*(v.run?6:3.35),forward=v.forward*dist+wheel,side=v.strafe*dist;
        move(Math.sin(yaw)*forward+Math.cos(yaw)*side,-Math.cos(yaw)*forward+Math.sin(yaw)*side);
      }else if(steps.length){
        const point=steps[0],dx=point.x-pos.x,dz=point.z-pos.z,d=Math.hypot(dx,dz),travel=dt*4;
        if(d<travel+.025){pos.x=point.x;pos.z=point.z;steps.shift();}
        else move(travel*dx/d,travel*dz/d);
      }
    }
    film.update(dt);animateRelic(dt);
    camera.rotation.set(pitch,-yaw,0,'YXZ');camera.updateMatrixWorld();
    if(elapsed>=nextHud){updateHud();nextHud=elapsed+.09;}
    const fade=1-Math.exp(-dt*2);
    scene.fog.color.lerp(fogTarget,fade);
    scene.fog.density+=(densityTarget-scene.fog.density)*fade;
    const targetFov=macro?32:63;
    if(Math.abs(camera.fov-targetFov)>.015){
      camera.fov+=film.enabled?(targetFov-camera.fov)*(1-Math.exp(-dt*12)):targetFov-camera.fov;
      camera.updateProjectionMatrix();
    }
    renderer.render(scene,camera);
  }
  const ray=new T.Raycaster(),ground=new T.Plane(new T.Vector3(0,1,0),0),hit=new T.Vector3();
  let down=null;
  canvas.addEventListener('pointerdown',e=>{canvas.focus({preventScroll:true});down={x:e.clientX,y:e.clientY,id:e.pointerId};});
  canvas.addEventListener('pointercancel',()=>{down=null;});
  canvas.addEventListener('pointerup',e=>{
    if(!down||down.id!==e.pointerId||Math.hypot(down.x-e.clientX,down.y-e.clientY)>6||paused){down=null;return;}
    down=null;
    const box=canvas.getBoundingClientRect();
    ray.setFromCamera({x:(e.clientX-box.left)/box.width*2-1,y:1-(e.clientY-box.top)/box.height*2},camera);
    if(near&&relics[near-1]&&ray.intersectObject(relics[near-1],true).length){callbacks.interact(near);return;}
    if(ray.ray.intersectPlane(ground,hit)&&pos.distanceTo(hit)<45)steps=land.path(pos,hit);
  });
  canvas.addEventListener('wheel',e=>{e.preventDefault();if(!paused)scrollDistance=clamp(scrollDistance+clamp(e.deltaY*(e.deltaMode===1?14:1)*.014,-2,2),-4,4);},{passive:false});
  addEventListener('blur',()=>{steps=[];scrollDistance=0;});
  canvas.addEventListener('webglcontextlost',e=>{e.preventDefault();callbacks.lost();});
  place(0);requestAnimationFrame(frame);
  // Crochet de capture strictement opt-in (?debug-pose dans l'URL). Absent sinon.
  if(new URLSearchParams(location.search).has('debug-pose')){
    window.__novaDebug={
      pose({x=pos.x,y=1.62,z=pos.z,yaw:a=yaw,pitch:p=pitch}={}){pos.set(x,y,z);yaw=a;pitch=p;steps=[];scrollDistance=0;updateHud(true);return canvas.dataset.position;},
      info(){const {render,memory,programs}=renderer.info;return {calls:render.calls,triangles:render.triangles,geometries:memory.geometries,textures:memory.textures,programs:programs.length,pixelRatio:renderer.getPixelRatio(),fov:camera.fov};}
    };
  }
  return {place,perform,film,setMacro(enabled){macro=enabled;},get near(){return near;},get zone(){return zone;},pause(value){if(paused===value)return;paused=value;steps=[];scrollDistance=0;input.reset();}};
}
