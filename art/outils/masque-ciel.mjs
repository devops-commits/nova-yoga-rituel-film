// Masque « ciel » de la photo du lac (art/blender/surfaces/lake.jpg), lu par photographic.js (matériau lakeplate).
// usage : node art/outils/masque-ciel.mjs [photo] [sortie.png] [--controle dossier]
//   Rouge : 1 là où la photo est du ciel, 0 sur le relief ; transition douce (≈ 3 px) qui suit le profil réel des crêtes.
//   Vert  : profondeur sous la crête (0 sur la crête → 1 à PROFONDEUR px dessous) : perspective aérienne des crêtes.
// La crête est cherchée colonne par colonne dans la photo elle-même : première marche franche et durable de
// clarté en descendant depuis le haut, suivie de relief bleuté (les nuages, rosés, doux ou minces, sont ignorés). Dépend de ffmpeg. À relancer si lake.jpg change.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
const depot=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
const args=process.argv.slice(2),ic=args.indexOf('--controle'),controle=ic<0?null:args.splice(ic,2)[1];
const photo=path.resolve(args[0]||path.join(depot,'art/blender/surfaces/lake.jpg'));
const sortie=path.resolve(args[1]||path.join(depot,'public/images/sous-la-peau/lac-ciel.png'));
const MARCHE=9,DUREE=10,BLEU=.64,RIVE=.69,BIAIS=1,FONDU=1.5,PROFONDEUR=96;
const ff=(a,o={})=>execFileSync('ffmpeg',['-v','error','-y',...a],{maxBuffer:1<<28,...o});
const taille=execFileSync('ffprobe',['-v','error','-select_streams','v:0','-show_entries','stream=width,height','-of','csv=p=0',photo]).toString().trim().split(',').map(Number);
const [W,H]=taille,rgb=ff(['-i',photo,'-f','rawvideo','-pix_fmt','rgb24','-']);
// Clarté pesée vers le rouge (le ciel rosé s'y détache le mieux du relief bleu), lissée sur 3 colonnes.
const brut=new Float32Array(W*H),L=new Float32Array(W*H);
for(let i=0;i<W*H;i++)brut[i]=.6*rgb[i*3]+.4*rgb[i*3+1];
for(let y=0;y<H;y++)for(let x=0;x<W;x++){const a=Math.max(0,x-1),b=Math.min(W-1,x+1);L[y*W+x]=(brut[y*W+a]+brut[y*W+x]+brut[y*W+b])/3;}
const moy=(x,y0,y1)=>{let s=0;for(let y=y0;y<=y1;y++)s+=L[y*W+x];return s/(y1-y0+1);};
const bas=Math.round(H*RIVE),crete=new Float32Array(W).fill(NaN);
for(let x=0;x<W;x++){
  for(let y=10;y<bas-30;y++){
    if(L[(y-2)*W+x]-L[(y+2)*W+x]<MARCHE)continue;
    const dessus=moy(x,y-9,y-3);
    if(dessus-moy(x,y+4,y+28)<DUREE||dessus-moy(x,y+4,y+9)<DUREE*.6)continue;
    // Sous une vraie crête le relief est bleu (rouge/bleu < BLEU), neige comprise ; sous un bord de nuage le ciel reste rosé.
    let rouge=0,bleu=0,rPres=0,bPres=0;
    for(let k=y+3;k<=y+24;k++){const i=(k*W+x)*3;rouge+=rgb[i];bleu+=rgb[i+2];if(k<=y+9){rPres+=rgb[i];bPres+=rgb[i+2];}}
    if(rouge>BLEU*bleu||rPres>(BLEU+.08)*bPres)continue;
    // Affine : rangée de plus forte pente de la marche (un nuage posé sur la crête fond doucement, la crête tranche),
    // puis position au demi-pixel par le barycentre des pentes voisines.
    let yy=y,pente=0;
    for(let k=y-3;k<=y+10;k++){const p=L[(k-1)*W+x]-L[(k+1)*W+x];if(p>pente){pente=p;yy=k;}}
    let somme=0,poids=0;
    for(let k=yy-1;k<=yy+1;k++){const p=Math.max(0,L[(k-1)*W+x]-L[(k+1)*W+x]);somme+=p*k;poids+=p;}
    crete[x]=somme/poids;break;
  }
}
// Colonnes aberrantes ou sans marche : médiane des voisines (profil réel conservé ailleurs).
const lisse=Float32Array.from(crete);let corrigees=0;
for(let x=0;x<W;x++){
  const v=[];for(let k=-6;k<=6;k++){const c=crete[Math.min(W-1,Math.max(0,x+k))];if(!Number.isNaN(c))v.push(c);}
  v.sort((a,b)=>a-b);const med=v.length?v[v.length>>1]:NaN;
  if(Number.isNaN(crete[x])||Math.abs(crete[x]-med)>7){lisse[x]=med;corrigees++;}
}
for(let x=1;x<W;x++)if(Number.isNaN(lisse[x]))lisse[x]=lisse[x-1];
for(let x=W-2;x>=0;x--)if(Number.isNaN(lisse[x]))lisse[x]=lisse[x+1];
const masque=Buffer.alloc(W*H*3);
for(let y=0;y<H;y++)for(let x=0;x<W;x++){
  const d=y+.5-(lisse[x]+BIAIS),t=Math.min(1,Math.max(0,(d+FONDU)/(2*FONDU))),i=(y*W+x)*3;
  masque[i]=Math.round(255*(1-t*t*(3-2*t)));masque[i+1]=Math.round(255*Math.min(1,Math.max(0,d/PROFONDEUR)));
}
ff(['-f','rawvideo','-pix_fmt','rgb24','-s',`${W}x${H}`,'-i','-','-frames:v','1','-compression_level','9',sortie],{input:masque});
let mn=1e9,mx=0;for(const c of lisse){mn=Math.min(mn,c);mx=Math.max(mx,c);}
console.log(`${path.relative(depot,sortie)} : ${W}×${H}, ${fs.statSync(sortie).size} octets, crête de ${mn.toFixed(1)} à ${mx.toFixed(1)} px, ${corrigees} colonnes corrigées`);
if(controle){
  // Contrôle visuel : photo avec le ciel détecté remplacé par un rose clair.
  fs.mkdirSync(controle,{recursive:true});const vue=Buffer.from(rgb);
  for(let i=0;i<W*H;i++){const a=masque[i*3]/255;for(let k=0;k<3;k++)vue[i*3+k]=Math.round(vue[i*3+k]*(1-a)+[209,192,198][k]*a);}
  ff(['-f','rawvideo','-pix_fmt','rgb24','-s',`${W}x${H}`,'-i','-','-frames:v','1',path.join(controle,'masque-ciel-controle.png')],{input:vue});
  fs.writeFileSync(path.join(controle,'masque-ciel-crete.json'),JSON.stringify(Array.from(lisse,c=>+c.toFixed(2))));
}
