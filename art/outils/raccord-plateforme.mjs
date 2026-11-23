// Raccord de matières entre la dernière image du survol Flow et la première vue jouable de la clairière.
// usage : node art/outils/raccord-plateforme.mjs [racine public] [préfixe avant|apres] [dossier sortie] [port] [--sans-parcours] [--etat-avant]
//   --etat-avant : sert atmosphere.js et photographic.js tels qu'ils étaient avant le raccord
//                  (art/outils/avant-raccord-plateforme/). À lancer AVANT de reconstruire le GLB pour un vrai « avant ».
//   1. sert la racine sur un port libre, ouvre nova-yoga-3d.html?film=vu#clairiere en 1280×720 (format de la vidéo),
//      masque toute l'interface (seul le canvas reste) et capture la première vue jouable ;
//   2. la compare à public/images/sous-la-peau/plateforme-libre.jpg : écart moyen global (0–255), par zone
//      (ciel, montagnes, brume, lac, arches, voile, sol centre, sol bord, anneau), écart de teinte en Lab
//      (ΔE76, Δclarté, Δchroma, Δangle de teinte) ;
//   3. écrit <préfixe>-planche.png : cible | jeu / superposition 50 % | écart ×4, et <préfixe>-rapport.json ;
//   4. joue nova-yoga.html#entrees-screen : laisse finir les deux films, clique « Explorer les sept entrées »,
//      avance puis pivote dans l'exploration (captures <préfixe>-parcours-*.png, positions relevées).
// Dépend de playwright-core (NOVA_PLAYWRIGHT) et de Google Chrome (NOVA_CHROME). Hors bac à sable.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {fileURLToPath} from 'node:url';
import {createRequire} from 'node:module';

const require=createRequire(import.meta.url);
const {chromium}=require(process.env.NOVA_PLAYWRIGHT||'playwright-core');
const depot=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
const args=process.argv.slice(2).filter(a=>!a.startsWith('--'));
const sansParcours=process.argv.includes('--sans-parcours');
const AVANT=path.join(depot,'art/outils/avant-raccord-plateforme');
const remplace=process.argv.includes('--etat-avant')?{'/experience/exploration/atmosphere.js':path.join(AVANT,'atmosphere.js'),'/experience/exploration/photographic.js':path.join(AVANT,'photographic.js')}:{};
const root=path.resolve(args[0]||path.join(depot,'public'));
const prefixe=args[1]||'apres';
const out=path.resolve(args[2]||path.join(os.homedir(),'Documents/corpus-rb/pxpipe/Nova-Yoga/plateforme-2026-11-23'));
const CIBLE=process.env.NOVA_CIBLE||path.join(depot,'public/images/sous-la-peau/plateforme-libre.jpg');
const L=1280,H=720;
fs.mkdirSync(out,{recursive:true});

// Zones relevées sur plateforme-libre.jpg (1280×720) : [y0,y1,x0,x1].
const ZONES={
  'ciel':[0,60,300,1000],'montagnes':[150,240,300,900],'brume de rive':[355,372,350,500],
  'ligne d’eau':[368,380,820,920],'lac':[374,382,820,930],
  'arche gauche':[180,200,150,190],'arche centrale':[215,235,585,610],'arche droite':[190,215,1030,1070],
  'voile central':[290,330,560,700],
  'sol lointain':[400,430,560,720],'sol milieu':[455,510,300,980],'sol centre':[590,690,400,900],
  'sol bord gauche':[600,700,20,200],'sol bord droit':[600,700,1080,1260],'anneau':[524,536,540,740],
};

const types={'.html':'text/html; charset=utf-8','.js':'text/javascript','.mjs':'text/javascript','.css':'text/css','.json':'application/json',
  '.glb':'model/gltf-binary','.mp4':'video/mp4','.png':'image/png','.jpg':'image/jpeg','.webp':'image/webp','.svg':'image/svg+xml','.woff2':'font/woff2'};
const server=http.createServer((req,res)=>{
  let p=decodeURIComponent(new URL(req.url,'http://x').pathname);if(p.endsWith('/'))p+='index.html';
  const file=remplace[p]||path.join(root,p);
  if(!(remplace[p]||file.startsWith(root))||!fs.existsSync(file)||!fs.statSync(file).isFile()){res.writeHead(404);res.end('404');return;}
  const size=fs.statSync(file).size,type=types[path.extname(file)]||'application/octet-stream';
  const m=/bytes=(\d*)-(\d*)/.exec(req.headers.range||'');
  if(m){
    const s=m[1]?+m[1]:size-+m[2],e=m[1]&&m[2]?Math.min(+m[2],size-1):size-1;
    res.writeHead(206,{'Content-Type':type,'Accept-Ranges':'bytes','Content-Range':`bytes ${s}-${e}/${size}`,'Content-Length':e-s+1,'Cache-Control':'no-store'});
    fs.createReadStream(file,{start:s,end:e}).pipe(res);
  }else{
    res.writeHead(200,{'Content-Type':type,'Accept-Ranges':'bytes','Content-Length':size,'Cache-Control':'no-store'});
    fs.createReadStream(file).pipe(res);
  }
});
await new Promise(r=>server.listen(+(args[3]||0),'127.0.0.1',r));   // 0 = port libre
const base=`http://127.0.0.1:${server.address().port}/`;
const browser=await chromium.launch({
  executablePath:process.env.NOVA_CHROME||'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true,
  args:['--use-angle=metal','--enable-gpu','--ignore-gpu-blocklist','--hide-scrollbars','--autoplay-policy=no-user-gesture-required'],
});
const rapport={racine:root,etatAvant:Object.keys(remplace).length>0,cible:CIBLE,format:[L,H],console:[]};
const ecouter=(page,nom)=>{
  page.on('console',m=>{if(['error','warning'].includes(m.type()))rapport.console.push(`[${nom}] ${m.type()}: ${m.text()}`.slice(0,300));});
  page.on('pageerror',e=>rapport.console.push(`[${nom}] pageerror: ${e.message}`.slice(0,300)));
};
const SANS_UI='body>*:not(#expedition),#expedition>*:not(canvas){visibility:hidden!important}';

try{
  // 1. Première vue jouable, sans interface.
  const contexte=await browser.newContext({viewport:{width:L,height:H},deviceScaleFactor:1});
  const page=await contexte.newPage();ecouter(page,'clairière');
  await page.goto(base+'nova-yoga-3d.html?film=vu#clairiere',{waitUntil:'load'});
  await page.waitForFunction(()=>document.querySelector('#view')?.dataset.position,null,{timeout:120000});
  await page.addStyleTag({content:SANS_UI});
  await page.waitForTimeout(+(process.env.NOVA_ATTENTE||4500));     // textures, ombres, film des massifs
  rapport.position=await page.evaluate(()=>document.querySelector('#view').dataset.position);
  rapport.lieu=await page.evaluate(()=>document.querySelector('#place')?.textContent);
  const jeu=await page.screenshot({type:'png'});
  fs.writeFileSync(path.join(out,`${prefixe}-jeu.png`),jeu);

  // 2 et 3. Mesures et planche, dans une page blanche (aucune dépendance npm).
  const atelier=await contexte.newPage();
  const url=(buf,mime)=>`data:${mime};base64,${buf.toString('base64')}`;
  const mesure=await atelier.evaluate(async({a,b,L,H,ZONES})=>{
    const charge=src=>new Promise((ok,ko)=>{const im=new Image();im.onload=()=>ok(im);im.onerror=ko;im.src=src;});
    const lire=async src=>{const im=await charge(src),c=new OffscreenCanvas(L,H),x=c.getContext('2d',{willReadFrequently:true});x.drawImage(im,0,0,L,H);return x.getImageData(0,0,L,H);};
    const A=await lire(a),B=await lire(b);
    const lin=v=>{v/=255;return v<=.04045?v/12.92:((v+.055)/1.055)**2.4;};
    const lab=([r,g,bl])=>{
      const R=lin(r),G=lin(g),Bl=lin(bl);
      const f=t=>t>.008856?Math.cbrt(t):7.787*t+16/116;
      const X=f((.4124*R+.3576*G+.1805*Bl)/.95047),Y=f(.2126*R+.7152*G+.0722*Bl),Z=f((.0193*R+.1192*G+.9505*Bl)/1.08883);
      return [116*Y-16,500*(X-Y),200*(Y-Z)];
    };
    const moyenne=(d,[y0,y1,x0,x1])=>{const s=[0,0,0];let n=0;for(let y=y0;y<y1;y++)for(let x=x0;x<x1;x++){const i=(y*L+x)*4;s[0]+=d.data[i];s[1]+=d.data[i+1];s[2]+=d.data[i+2];n++;}return s.map(v=>v/n);};
    const ecart=([y0,y1,x0,x1])=>{let s=0,n=0;for(let y=y0;y<y1;y++)for(let x=x0;x<x1;x++){const i=(y*L+x)*4;s+=Math.abs(A.data[i]-B.data[i])+Math.abs(A.data[i+1]-B.data[i+1])+Math.abs(A.data[i+2]-B.data[i+2]);n+=3;}return s/n;};
    const compare=zone=>{
      const ca=moyenne(A,zone),cb=moyenne(B,zone),la=lab(ca),lb=lab(cb);
      const chroma=l=>Math.hypot(l[1],l[2]),teinte=l=>Math.atan2(l[2],l[1])*180/Math.PI;
      let dh=teinte(lb)-teinte(la);dh=((dh+540)%360)-180;
      return {cible:ca.map(Math.round),jeu:cb.map(Math.round),ecartMoyen:+ecart(zone).toFixed(1),
        deltaE:+Math.hypot(la[0]-lb[0],la[1]-lb[1],la[2]-lb[2]).toFixed(1),deltaClarte:+(lb[0]-la[0]).toFixed(1),
        deltaChroma:+(chroma(lb)-chroma(la)).toFixed(1),deltaTeinteDeg:+dh.toFixed(0)};
    };
    const zones={};for(const [nom,z] of Object.entries(ZONES))zones[nom]=compare(z);
    const global=compare([0,H,0,L]);
    // Planche : cible | jeu / superposition 50 % | écart ×4.
    const c=new OffscreenCanvas(L*2,H*2),x=c.getContext('2d');
    x.putImageData(A,0,0);x.putImageData(B,L,0);
    const M=new ImageData(L,H),D=new ImageData(L,H);
    for(let i=0;i<A.data.length;i+=4){
      for(let k=0;k<3;k++){M.data[i+k]=(A.data[i+k]+B.data[i+k])/2;D.data[i+k]=Math.min(255,Math.abs(A.data[i+k]-B.data[i+k])*4);}
      M.data[i+3]=D.data[i+3]=255;
    }
    x.putImageData(M,0,H);x.putImageData(D,L,H);
    x.font='600 22px sans-serif';x.textBaseline='top';
    [['CIBLE · dernière image du film',0,0],['JEU · première vue jouable',L,0],['SUPERPOSITION 50 %',0,H],['ÉCART ×4',L,H]].forEach(([t,px,py])=>{
      x.fillStyle='rgba(0,0,0,.55)';x.fillRect(px+12,py+12,x.measureText(t).width+20,34);x.fillStyle='#fff';x.fillText(t,px+22,py+18);});
    x.strokeStyle='rgba(255,255,255,.55)';x.lineWidth=1;
    for(const [y0,y1,x0,x1] of Object.values(ZONES))x.strokeRect(L+x0+.5,H+y0+.5,x1-x0,y1-y0);
    const blob=await c.convertToBlob({type:'image/png'}),octets=new Uint8Array(await blob.arrayBuffer());
    let texte='';for(let i=0;i<octets.length;i+=32768)texte+=String.fromCharCode(...octets.subarray(i,i+32768));
    return {global,zones,png:btoa(texte)};
  },{a:url(fs.readFileSync(CIBLE),'image/jpeg'),b:url(jeu,'image/png'),L,H,ZONES});
  fs.writeFileSync(path.join(out,`${prefixe}-planche.png`),Buffer.from(mesure.png,'base64'));
  rapport.global=mesure.global;rapport.zones=mesure.zones;
  await contexte.close();

  // 4. Parcours réel depuis la section des entrées.
  if(!sansParcours){
    const parcours={};rapport.parcours=parcours;
    const ctx=await browser.newContext({viewport:{width:L,height:H},deviceScaleFactor:1});
    const p=await ctx.newPage();ecouter(p,'parcours');
    const photo=async nom=>{await p.screenshot({path:path.join(out,`${prefixe}-parcours-${nom}.png`)});};
    try{
      await p.goto(base+'nova-yoga.html#entrees-screen',{waitUntil:'load'});
      const ecran=p.locator('#entrees-screen');
      await ecran.scrollIntoViewIfNeeded();
      const debut=Date.now();
      // Les deux films se terminent d'eux-mêmes ; l'invitation n'apparaît qu'ensuite.
      await p.waitForFunction(()=>document.getElementById('entrees-screen')?.dataset.etape==='invitation'
        &&document.getElementById('entrees-screen').classList.contains('awaits-explorer'),null,{timeout:+(process.env.NOVA_FILMS_MS||150000)});
      parcours.filmsMs=Date.now()-debut;
      await photo('1-invitation');
      await p.getByText('Explorer les sept entrées',{exact:true}).click();
      await p.waitForFunction(()=>document.getElementById('entrees-screen').dataset.etape==='exploration',null,{timeout:120000});
      parcours.basculeMs=+(await ecran.getAttribute('data-bascule'));
      parcours.scene=await ecran.getAttribute('data-scene');
      await p.waitForTimeout(2500);
      const cadre=p.frames().find(f=>/nova-yoga-3d\.html/.test(f.url()));
      if(!cadre)throw new Error('iframe de l’exploration introuvable');
      const position=()=>cadre.evaluate(()=>document.querySelector('#view').dataset.position);
      parcours.cadre=cadre.url().replace(base,'');
      parcours.depart=await position();
      await photo('2-premiere-vue');
      await cadre.locator('#view').focus();
      await p.keyboard.down('ArrowUp');await p.waitForTimeout(1800);await p.keyboard.up('ArrowUp');await p.waitForTimeout(500);
      parcours.apresAvance=await position();await photo('3-avance');
      await p.keyboard.down('ArrowLeft');await p.waitForTimeout(900);await p.keyboard.up('ArrowLeft');await p.waitForTimeout(500);
      parcours.apresPivot=await position();await photo('4-pivot');
      const [d,a,v]=[parcours.depart,parcours.apresAvance,parcours.apresPivot].map(s=>s.split(',').map(Number));
      parcours.avanceM=+Math.hypot(a[0]-d[0],a[1]-d[1]).toFixed(2);
      parcours.pivotRad=+(v[2]-a[2]).toFixed(2);
      parcours.ok=parcours.avanceM>.5&&Math.abs(parcours.pivotRad)>.1;
    }catch(e){parcours.erreur=String(e.message||e).slice(0,400);parcours.ok=false;await photo('echec').catch(()=>{});}
    await ctx.close();
  }
}finally{
  await browser.close();server.close();
}
fs.writeFileSync(path.join(out,`${prefixe}-rapport.json`),JSON.stringify(rapport,null,1));
const ligne=(nom,z)=>`${nom.padEnd(16)} cible ${String(z.cible).padEnd(13)} jeu ${String(z.jeu).padEnd(13)} écart ${String(z.ecartMoyen).padStart(5)}  ΔE ${String(z.deltaE).padStart(5)}  ΔL ${String(z.deltaClarte).padStart(6)}  ΔC ${String(z.deltaChroma).padStart(6)}  Δh ${String(z.deltaTeinteDeg).padStart(4)}°`;
console.log(`RACCORD ${prefixe} · position ${rapport.position} · ${rapport.lieu}`);
console.log(ligne('GLOBAL',rapport.global));
for(const [nom,z] of Object.entries(rapport.zones))console.log(ligne(nom,z));
if(rapport.parcours)console.log('PARCOURS',JSON.stringify(rapport.parcours));
if(rapport.console.length)console.log('CONSOLE',rapport.console.slice(0,8).join('\n'));
console.log(`→ ${path.join(out,prefixe+'-planche.png')}`);
