import * as THREE from 'three';

// The baked light in these projections belongs to real surfaces in the Blender set.
const projectionNames=new Set(['lakeplate','lakereflection','chamberplate','palmplate','foldplate']);

// Hors du cadre photographié, la plaque n'a plus rien à montrer : au zénith de l'objectif toute
// projection caméra converge (étoile radiale si on borne v, pli miroir si on le replie).
// Le maillage laisse donc v sortir de 0..1 (photographic_sets.beyond_frame) et la plaque se fond,
// sur une bande large qui commence dans le cadre, vers une trame de lin posée en triplanaire dans
// l'espace du monde (densité constante, aucun pôle), teintée par les bandes haute et basse de la
// photo très floutées.
const beyondFrame=`
  // Rotate the yarn axes into the room. The sample frequency is in metres.
  vec3 cloth=vec3((vContact.x+vContact.z)*.7071,vContact.y,(vContact.x-vContact.z)*.7071);
  float plateV=1.-vEmissiveMapUv.y;
  float beyond=max(smoothstep(.80,1.02,plateV),1.-smoothstep(-.02,.20,plateV));
  vec3 roomN=inverseTransformDirection(normal,viewMatrix);
  vec3 lay=pow(abs(vec3((roomN.x+roomN.z)*.7071,roomN.y,(roomN.x-roomN.z)*.7071)),vec3(4.));
  lay/=max(.001,lay.x+lay.y+lay.z);
  vec2 relief=(texture2D(uMicroSurface,cloth.zy*.29).rg*lay.x
              +texture2D(uMicroSurface,cloth.xz*.29).rg*lay.y
              +texture2D(uMicroSurface,cloth.xy*.29).rg*lay.z)*2.-1.;
  // Pas de branche : les dérivées des lectures de texture doivent rester définies partout.
  float band=mix(.92,.09,step(.5,plateV));
  vec2 wander=vec2(.5+.34*sin(.23*cloth.x+.11*cloth.y+1.3)*cos(.17*cloth.z+.4),band+.05*sin(.19*cloth.z+.13*cloth.y));
  vec3 nearTone=texture2D(emissiveMap,clamp(vEmissiveMapUv,.03,.97),4.).rgb;
  vec3 farTone=texture2D(emissiveMap,wander,5.5).rgb;
  vec3 linen=emissive*mix(nearTone,farTone,beyond)*(1.+.20*dot(relief,vec2(.62,-.83)))*(.93+.07*roomN.y);
  outgoingLight=mix(outgoingLight,linen,beyond);
`;
// La peau était lue à plat (xz) : sur la paroi dressée de la paume, pores et crêtes s'étiraient
// en stries verticales régulières. Pores en triplanaire ; crêtes réservées aux faces tournées vers le haut.
const skinContact=`
  // Natural loops and forks follow the pad in world space, independently of the camera.
  vec2 pad=vContact.xz-vec2(3.72,38.45);
  vec2 skinUV=vec2(pad.x*.92+pad.y*.38, pad.y*.92-pad.x*.38);
  float rise=vContact.y-.656;
  vec3 skinN=inverseTransformDirection(normal,viewMatrix);
  vec3 lay=pow(abs(vec3(skinN.x*.92+skinN.z*.38,skinN.y,skinN.z*.92-skinN.x*.38)),vec3(4.));
  lay/=max(.001,lay.x+lay.y+lay.z);
  float phase=length(vec3((skinUV+vec2(.42,-.73))*vec2(.85,1.15),rise))*39.
             +.27*sin(4.*skinUV.x+2.*skinUV.y);
  float ridge=cos(6.2831853*phase)*(1.-smoothstep(.12,.33,fwidth(phase)))*lay.y;
  vec2 pores=(texture2D(uMicroSurface,skinUV*1.12+.138).rg*lay.y
             +texture2D(uMicroSurface,vec2(skinUV.x,rise)*1.12+.41).rg*lay.z
             +texture2D(uMicroSurface,vec2(rise,skinUV.y)*1.12+.77).rg*lay.x)*2.-1.;
  float close=1.-smoothstep(2.8,6.2,length(vViewPosition));
  float grazing=1.-abs(dot(normalize(vViewPosition),normal));
  outgoingLight*=1.+close*(dot(pores,vec2(.62,-.73))+.070*ridge);
  outgoingLight+=vec3(.032,.019,.013)*close*grazing*max(0.,ridge);
  vec2 d=(vContact.xz-vec2(3.72,38.45))/vec2(.94,.84);
  float r=length(d);float shadow=exp(-r*r*1.65);
  float caustic=exp(-pow((r-1.03)/.145,2.))*smoothstep(-.15,.85,d.x);
  outgoingLight=outgoingLight*(1.-.68*shadow)+vec3(.14,.086,.046)*caustic;
`;
export function finishPhotographicMaterials(root,clock,liveTexture,filmMix){
  const textured=new Set();
  root.traverse(o=>{if(o.isMesh)for(const m of [].concat(o.material))textured.add(m);});
  const projectionMaps=new Map();
  for(const m of textured)if(projectionNames.has(m.name))projectionMaps.set(m.name,m.map);
  const lensPoster=[...textured].find(mat=>mat.name==="film2")?.map;
  const environments=new Map();
  function environment(name){
    if(environments.has(name))return environments.get(name);
    const im=projectionMaps.get(name)?.image;
    if(!im)return null;
    const canvas=document.createElement('canvas');canvas.width=1024;canvas.height=512;
    const context=canvas.getContext('2d');
    for(let i=0;i<4;i++){
      context.save();context.translate(i*256+(i%2?256:0),0);context.scale(i%2?-1:1,1);
      context.drawImage(im,0,0,256,512);context.restore();
    }
    const map=new THREE.CanvasTexture(canvas);map.colorSpace=THREE.SRGBColorSpace;map.mapping=THREE.EquirectangularReflectionMapping;
    environments.set(name,map);return map;
  }
  for(const m of textured){
    if(m.name==='bronze'){
      // GLTFLoader inverse normalScale.y quand le maillage n'a pas de tangentes : garder ce signe,
      // sinon les creux du martelage s'éclairent à l'envers dans le sens vertical.
      m.envMap=environment('chamberplate');m.envMapIntensity=1.52;m.normalScale.set(.65,.65*Math.sign(m.normalScale.y||1));
      m.color.set('#b79771');m.roughness=1;m.metalness=1;
    }
    if(m.name==='skin'){
      m.roughness=.60;m.metalness=0;m.normalScale.set(.32,.32*Math.sign(m.normalScale.y||1));
    }
    if(m.name==='waterdrop'){
      m.map=null;m.normalMap=null;m.color.set('#fcffff');m.envMap=environment('lakeplate');
      m.envMapIntensity=.70;m.metalness=0;m.roughness=.042;
      if(m.isMeshPhysicalMaterial){m.ior=1.333;m.transmission=.91;m.thickness=1.14;m.clearcoat=.20;m.clearcoatRoughness=.045;}
    }
    if(m.name==='waterdrop'){
      m.onBeforeCompile=shader=>{
        shader.uniforms.uLakeShot={value:projectionMaps.get('lakeplate')};
        shader.uniforms.uOriginalLens={value:lensPoster};
        shader.uniforms.uShotAtlas={value:liveTexture};shader.uniforms.uLive=filmMix;
        shader.fragmentShader='uniform sampler2D uLakeShot,uOriginalLens,uShotAtlas;uniform float uLive;\n'+shader.fragmentShader.replace('#include <opaque_fragment>',`
          vec3 viewDir=normalize(vViewPosition);
          vec3 worldR=inverseTransformDirection(reflect(-viewDir,normal),viewMatrix);
          float nv=clamp(dot(viewDir,normal),.0001,1.);
          float fresnel=.0204+.9796*pow(1.-nv,5.);
          vec2 skyUv=vec2(.5+.32*worldR.x,.685-worldR.y*.45);
          vec3 sky=texture2D(uLakeShot,clamp(skyUv,.003,.997)).rgb;
          vec2 lensUv=vec2(.365+.125*normal.x,.585-.126*normal.y);
          vec3 poster=texture2D(uOriginalLens,lensUv).rgb;
          vec3 moving=texture2D(uShotAtlas,vec2(.5+.25*lensUv.x,.5*lensUv.y)).rgb;
          moving=sRGBTransferEOTF(vec4(moving,1.)).rgb;
          vec3 internal=mix(poster,moving,uLive);
          float softbox=1.-smoothstep(.24,1.,length((worldR-vec3(-.55,.46,.37))*vec3(2.7,4.5,2.2)));
          outgoingLight=mix(outgoingLight,internal*.80,.91*sqrt(nv))+fresnel*(sky*3.5+vec3(2.4,2.15,1.80)*softbox);
          #include <opaque_fragment>`);
      };
    }
    if(projectionNames.has(m.name)){
      // Keep captured highlights and shadows without a second application of sunlight.
      m.toneMapped=false;m.fog=false;m.emissiveMap=m.map;m.emissive.setRGB(1,1,1);m.emissiveIntensity=.988;
      if(m.name==='palmplate'){m.transparent=false;m.depthWrite=true;m.alphaTest=.30;m.alphaToCoverage=true;}
      m.color.setScalar(.008);m.metalness=0;m.roughness=1;m.envMapIntensity=0;
      if(m.name==='chamberplate'||m.name==='palmplate'||m.name==='foldplate'){
        const chamber=m.name==='chamberplate',palm=m.name==='palmplate';
        // Le fondu hors cadre compte sur une plaque qui s'arrête à son bord, sans se répéter.
        if(!palm&&m.map){m.map.wrapS=m.map.wrapT=THREE.ClampToEdgeWrapping;m.map.needsUpdate=true;}
        m.onBeforeCompile=shader=>{
          shader.vertexShader='varying vec3 vContact;\n'+shader.vertexShader.replace('#include <worldpos_vertex>','#include <worldpos_vertex>\n vContact=(modelMatrix*vec4(transformed,1.)).xyz;');
          const sample=[...textured].find(other=>other.name===(palm?'skin':'silk'))?.normalMap;
          shader.uniforms.uMicroSurface={value:sample};
          shader.fragmentShader='varying vec3 vContact;uniform sampler2D uMicroSurface;\n'+shader.fragmentShader.replace('#include <opaque_fragment>',(palm?skinContact:beyondFrame+(chamber?`
            vec3 plane=abs(normalize(cross(dFdx(cloth),dFdy(cloth))));
            vec3 weights=pow(plane,vec3(4.));weights/=max(.001,dot(weights,vec3(1.)));
            vec2 detail=(texture2D(uMicroSurface,cloth.zy*.93).rg*weights.x
                        +texture2D(uMicroSurface,cloth.xz*.93).rg*weights.y
                        +texture2D(uMicroSurface,cloth.xy*.93).rg*weights.z)*2.-1.;
            vec2 loom=cloth.xz*vec2(54.,62.);
            loom+=.16*sin(cloth.zx*3.1)+.08*sin(cloth.xz*8.);
            vec2 footprint=fwidth(loom);
            // Le fil s'efface avant trois pixels par période : au-delà il battait en moiré.
            vec2 yarn=cos(6.2831853*loom)*(1.-smoothstep(vec2(.11),vec2(.33),footprint));
            float crossover=sin(3.14159265*loom.x)*sin(3.14159265*loom.y);
            float interlace=mix(yarn.x,yarn.y,.5+.5*crossover);
            float grazing=1.-abs(dot(normalize(vViewPosition),normal));
            float close=1.-smoothstep(3.,10.,length(vViewPosition));
            float fibre=dot(detail,vec2(.62,-.83));
            outgoingLight*=1.+close*(1.15*fibre+weights.y*.22*interlace);
            outgoingLight+=vec3(.10,.081,.061)*close*grazing*max(0.,fibre);
            vec2 delta=vContact.xz-vec2(-24.74874,24.74874);
            float base=exp(-dot(delta,delta)/.79);
            vec2 shadow=delta-vec2(-.83,.02);
            float penumbra=exp(-dot(shadow*vec2(.69,1.72),shadow*vec2(.69,1.72)));
            outgoingLight*=1.-(1.-smoothstep(.15,.44,vContact.y))*clamp(.71*base+.45*penumbra,0.,.88);
          `:''))+'\n#include <opaque_fragment>');
        };
        m.customProgramCacheKey=()=>m.name+'-contact';
      }
      if(m.name==='lakereflection'){
        m.onBeforeCompile=shader=>{
          shader.uniforms.uWave=clock;
          shader.vertexShader='varying vec3 vWaterWorld;\n'+shader.vertexShader.replace('#include <worldpos_vertex>','#include <worldpos_vertex>\n vWaterWorld=(modelMatrix*vec4(transformed,1.)).xyz;');
          shader.fragmentShader='varying vec3 vWaterWorld;uniform float uWave;\n'+shader.fragmentShader.replace('#include <emissivemap_fragment>',`
            vec3 ray=vWaterWorld-vec3(0.,1.62,62.);
            float heading=atan(ray.x,-ray.z);
            float sector=floor((heading+.7853982)/1.5707963);
            float lateral=.5+.5*tan(heading-sector*1.5707963)*(mod(sector,2.)<.5?1.:-1.);
            float v=.688-ray.y/(1.18*max(.1,max(abs(ray.x),abs(ray.z))));
            if(v>1.)v=1.-.195*(1.-exp(-3.*(v-1.)));
            vec2 p=clamp(vec2(lateral,v),.001,.999);
            float band=smoothstep(.698,.78,p.y)*(1.-smoothstep(.955,1.,p.y));
            p.x+=band*(.00065*sin(p.y*137.+uWave*.53)+.00032*sin(p.y*221.-uWave*.72));
            p.y+=band*.00027*sin(p.x*45.+uWave*.38);
            totalEmissiveRadiance*=texture2D(emissiveMap,p).rgb;
          `);
        };
      }
    }
  }
  // At the lake the next set emerges with distance travelled. Walking back reverses it.
  // Install after film shader changes, preserving the existing material program key.
  function lakeReveal(mat){
    if(mat.name==='lakeplate'||mat.name==='lakereflection')return;
    const previous=mat.onBeforeCompile,previousKey=mat.customProgramCacheKey();
    mat.onBeforeCompile=function(shader,renderer){
      previous.call(this,shader,renderer);
      shader.fragmentShader=shader.fragmentShader.replace('#include <clipping_planes_fragment>',`#include <clipping_planes_fragment>
        float shoreReveal=1.-smoothstep(45.,59.,cameraPosition.z);
        float chapter=smoothstep(12.,24.,cameraPosition.z)*(1.-smoothstep(52.,59.,cameraPosition.z));
        shoreReveal*=1.-chapter*smoothstep(17.,25.,length(vViewPosition));
        ${mat.name==='foldplate'?'shoreReveal*=1.-smoothstep(36.8,40.3,cameraPosition.z);':''}
        if(abs(cameraPosition.x)<11. && shoreReveal<.999){
          float threshold=fract(52.9829189*fract(dot(floor(gl_FragCoord.xy),vec2(.06711056,.00583715))));
          if(shoreReveal<=threshold)discard;
        }`);
    };
    mat.customProgramCacheKey=()=>previousKey+'-shore-reveal';
    mat.needsUpdate=true;
  }
  for(const [name,slot,strength] of [['chamberplate',5,.21],['foldplate',4,.13],['palmplate',2,.10]]){
    const material=[...textured].find(m=>m.name===name);
    const reference=[...textured].find(m=>m.name==='film'+slot)?.map;
    if(!material||!reference)continue;
    const previous=material.onBeforeCompile;
    material.onBeforeCompile=function(shader,renderer){
      previous.call(this,shader,renderer);
      shader.uniforms.uFilmAtlas={value:liveTexture};shader.uniforms.uFilmStill={value:reference};shader.uniforms.uFilmMix=filmMix;
      shader.fragmentShader='uniform float uFilmMix;uniform sampler2D uFilmAtlas,uFilmStill;\n'+shader.fragmentShader.replace('#include <opaque_fragment>',`
        vec2 movieUV=clamp(vMapUv,.002,.998);
        vec2 tile=(movieUV+vec2(${slot%4}.0,${Math.floor(slot/4)}.0))/vec2(4.,2.);
        vec3 live=sRGBTransferEOTF(texture2D(uFilmAtlas,tile)).rgb;
        vec3 baseFrame=texture2D(uFilmStill,movieUV).rgb;
        float variation=clamp(dot(live-baseFrame,vec3(.2126,.7152,.0722)),-.18,.18);
        ${name==='palmplate'?'':'variation*=1.-beyond; // hors cadre, le film ne lirait que la rangée de bord'}
        outgoingLight*=1.+uFilmMix*${strength}*variation;
        #include <opaque_fragment>`);
    };
    material.customProgramCacheKey=()=>name+'-photographed-light';
  }
  for(const m of textured)lakeReveal(m);
  return lakeReveal;
}
