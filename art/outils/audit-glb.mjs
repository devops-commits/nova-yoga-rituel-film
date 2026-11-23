// Mesure, dans le GLB livré, la rupture de normale entre sommets confondus (coutures) par matériau.
// usage : node art/outils/audit-glb.mjs [public/worlds/sous-la-peau.glb] [matériau…]
import fs from 'node:fs';
import {MeshoptDecoder} from '../../public/vendor/meshoptimizer/meshopt_decoder.module.js';
const file=process.argv[2]||'public/worlds/sous-la-peau.glb',wanted=process.argv.slice(3);
const raw=fs.readFileSync(file),n=raw.readUInt32LE(12),doc=JSON.parse(raw.subarray(20,20+n).toString()),bin=raw.subarray(28+n);
await MeshoptDecoder.ready;
const TYPES={5120:Int8Array,5121:Uint8Array,5122:Int16Array,5123:Uint16Array,5125:Uint32Array,5126:Float32Array},SIZE={SCALAR:1,VEC2:2,VEC3:3,VEC4:4};
function read(index){
  const a=doc.accessors[index],view=doc.bufferViews[a.bufferView],ext=view.extensions?.EXT_meshopt_compression;
  let bytes;
  if(ext){bytes=new Uint8Array(ext.count*ext.byteStride);MeshoptDecoder.decodeGltfBuffer(bytes,ext.count,ext.byteStride,bin.subarray(ext.byteOffset||0,(ext.byteOffset||0)+ext.byteLength),ext.mode,ext.filter);}
  else bytes=new Uint8Array(bin.buffer,bin.byteOffset+(view.byteOffset||0),view.byteLength);
  const T=TYPES[a.componentType],size=SIZE[a.type],stride=(ext?.byteStride||view.byteStride||T.BYTES_PER_ELEMENT*size),out=new Float64Array(a.count*size);
  const dv=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength),get={5120:'getInt8',5121:'getUint8',5122:'getInt16',5123:'getUint16',5125:'getUint32',5126:'getFloat32'}[a.componentType];
  const scale=a.normalized?{5120:127,5121:255,5122:32767,5123:65535}[a.componentType]:1;
  for(let i=0;i<a.count;i++)for(let k=0;k<size;k++)out[i*size+k]=dv[get]((a.byteOffset||0)+i*stride+k*T.BYTES_PER_ELEMENT,true)/scale;
  return out;
}
const stats=new Map();
for(const mesh of doc.meshes)for(const prim of mesh.primitives){
  const name=doc.materials[prim.material].name;if(wanted.length&&!wanted.includes(name))continue;
  const p=read(prim.attributes.POSITION),nn=read(prim.attributes.NORMAL),seen=new Map();
  const s=stats.get(name)||{sommets:0,confondus:0,max:0,audela2:0};stats.set(name,s);s.sommets+=p.length/3;
  for(let i=0;i<p.length/3;i++){
    const key=[0,1,2].map(k=>Math.round(p[i*3+k]*2e4)).join(',');
    if(!seen.has(key)){seen.set(key,i);continue;}
    const j=seen.get(key);let dot=0,la=0,lb=0;
    for(let k=0;k<3;k++){dot+=nn[i*3+k]*nn[j*3+k];la+=nn[i*3+k]**2;lb+=nn[j*3+k]**2;}
    const angle=Math.acos(Math.max(-1,Math.min(1,dot/Math.sqrt(la*lb))))*180/Math.PI;
    s.confondus++;s.max=Math.max(s.max,angle);if(angle>2)s.audela2++;
  }
}
for(const [name,s] of stats)console.log(`${name}: ${s.sommets} sommets, ${s.confondus} doublons de position, ${s.audela2} avec normales divergentes de plus de 2°, max ${s.max.toFixed(1)}°`);
