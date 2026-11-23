// Contrôle des raccords du survol des sept entrées (Chrome headless, hors bac à sable).
// usage : node art/outils/raccord-survol.mjs [racine public] [dossier sortie] [port]
//   1. capture la première vue jouable de nova-yoga-3d.html?film=vu#clairiere (1920×1080, champ vertical 63°)
//   2. la superpose à 50 % à la dernière image du survol, et Fin-du-film.jpg à la première image du survol ;
//      écrit raccord-*.png et l'écart moyen (0–255), plus le décalage qui minimise l'écart (saut de cadre)
//   3. joue le parcours de nova-yoga.html : film → survol → invitation → Entrée au clavier → iframe ;
//      mesure le temps de bascule, cherche une image noire pendant la bascule, relève les erreurs console ;
//      refait le parcours en portrait mobile et en mouvement réduit.
// Dépend de playwright-core (NOVA_PLAYWRIGHT), de Google Chrome (NOVA_CHROME) et de ffmpeg (NOVA_FFMPEG).
import http from 'node:http';import fs from 'node:fs';import os from 'node:os';import path from 'node:path';
import {execFileSync} from 'node:child_process';import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
const depot=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
const args=process.argv.slice(2);
const root=path.resolve(args[0]||path.join(depot,'public'));
const out=path.resolve(args[1]||path.join(os.homedir(),'Documents/corpus-rb/pxpipe/Nova-Yoga/survol-2026-11-23'));
const port=+(args[2]||8877);
const FIN_DU_FILM=process.env.NOVA_FIN_DU_FILM||path.join(os.homedir(),'Documents/corpus-rb/coaching/jade/2026-11-22/site-3d/Storyboard-v2/Travelling-et-matieres/Fin-du-film.jpg');
const ffmpeg=process.env.NOVA_FFMPEG||'ffmpeg';
const require=createRequire(import.meta.url);
const {chromium}=require(process.env.NOVA_PLAYWRIGHT||'playwright-core');
fs.mkdirSync(out,{recursive:true});
const types={'.html':'text/html; charset=utf-8','.js':'text/javascript','.css':'text/css','.json':'application/json','.glb':'model/gltf-binary','.mp4':'video/mp4','.png':'image/png','.jpg':'image/jpeg','.webp':'image/webp','.svg':'image/svg+xml'};
const server=http.createServer((req,res)=>{
  let p=decodeURIComponent(new URL(req.url,'http://x').pathname);if(p.endsWith('/'))p+='index.html';
  const file=path.join(root,p);
  if(!file.startsWith(root)||!fs.existsSync(file)||!fs.statSync(file).isFile()){res.writeHead(404);res.end('404');return;}
  const size=fs.statSync(file).size,h={'Content-Type':types[path.extname(file)]||'application/octet-stream','Accept-Ranges':'bytes','Cache-Control':'no-store'};
  const m=/^bytes=(\d*)-(\d*)$/.exec(req.headers.range||'');
  if(m){const s=m[1]?+m[1]:size-+m[2],e=m[1]&&m[2]?Math.min(+m[2],size-1):size-1;
    res.writeHead(206,{...h,'Content-Range':`bytes ${s}-${e}/${size}`,'Content-Length':e-s+1});fs.createReadStream(file,{start:s,end:e}).pipe(res);}
  else{res.writeHead(200,{...h,'Content-Length':size});fs.createReadStream(file).pipe(res);}
});
await new Promise(r=>server.listen(port,'127.0.0.1',r));
const base=`http://127.0.0.1:${port}/`;
const browser=await chromium.launch({executablePath:process.env.NOVA_CHROME||'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true,
  args:['--use-angle=metal','--enable-gpu','--ignore-gpu-blocklist','--hide-scrollbars','--autoplay-policy=no-user-gesture-required']});
const rapport={racine:root,sortie:out,raccords:{},parcours:[],console:[]};
const ecoute=(page,nom)=>{
  page.on('console',m=>{if(['error','warning'].includes(m.type()))rapport.console.push(`[${nom}] ${m.type()}: ${m.text()}`);});
  page.on('pageerror',e=>rapport.console.push(`[${nom}] pageerror: ${e.message}`));
  page.on('response',r=>{if(r.status()>=400)rapport.console.push(`[${nom}] http ${r.status()}: ${r.url()}`);});
};
const url64=(file)=>`data:${types[path.extname(file)]};base64,${fs.readFileSync(file).toString('base64')}`;

// Atelier d'images : une page blanche compare, superpose et mesure (aucune dépendance côté Node).
const atelier=await (await browser.newContext()).newPage();
async function comparer(a,b,nom,largeur=960,hauteur=540){
  const r=await atelier.evaluate(async({a,b,largeur,hauteur})=>{
    const charge=src=>new Promise((ok,ko)=>{const im=new Image();im.onload=()=>ok(im);im.onerror=ko;im.src=src;});
    const lire=async(src,w,h)=>{const im=await charge(src);const c=new OffscreenCanvas(w,h);const x=c.getContext('2d',{willReadFrequently:true});
      const s=Math.max(w/im.width,h/im.height);x.drawImage(im,(w-im.width*s)/2,(h-im.height*s)/2,im.width*s,im.height*s);return x.getImageData(0,0,w,h);};
    const A=await lire(a,largeur,hauteur),B=await lire(b,largeur,hauteur);
    let somme=0,lum=0;const n=largeur*hauteur;
    for(let i=0;i<n*4;i+=4){const d=[0,1,2].map(k=>A.data[i+k]-B.data[i+k]);somme+=Math.abs(d[0])+Math.abs(d[1])+Math.abs(d[2]);lum+=Math.abs(.2126*d[0]+.7152*d[1]+.0722*d[2]);}
    // Décalage qui minimise l'écart de luminance, au quart de la définition : un saut de cadre se lit ici.
    const w=largeur>>2,h=hauteur>>2,ga=await lire(a,w,h),gb=await lire(b,w,h);
    const L=d=>{const o=new Float32Array(w*h);for(let i=0;i<w*h;i++)o[i]=.2126*d.data[i*4]+.7152*d.data[i*4+1]+.0722*d.data[i*4+2];return o;};
    const la=L(ga),lb=L(gb);let meilleur={dx:0,dy:0,ecart:Infinity};
    for(let dy=-10;dy<=10;dy++)for(let dx=-10;dx<=10;dx++){let s=0,c=0;
      for(let y=12;y<h-12;y+=2)for(let x=12;x<w-12;x+=2){s+=Math.abs(la[y*w+x]-lb[(y+dy)*w+x+dx]);c++;}
      if(s/c<meilleur.ecart)meilleur={dx:dx*4,dy:dy*4,ecart:s/c};}
    const c=new OffscreenCanvas(largeur*2,hauteur*2),x=c.getContext('2d');
    x.putImageData(A,0,0);x.putImageData(B,largeur,0);                      // haut : A | B
    const m=new ImageData(largeur,hauteur),d=new ImageData(largeur,hauteur);
    for(let i=0;i<n*4;i+=4){for(let k=0;k<3;k++){m.data[i+k]=(A.data[i+k]+B.data[i+k])/2;d.data[i+k]=Math.min(255,Math.abs(A.data[i+k]-B.data[i+k])*4);}m.data[i+3]=d.data[i+3]=255;}
    x.putImageData(m,0,hauteur);x.putImageData(d,largeur,hauteur);          // bas : superposition 50 % | écart ×4
    const blob=await c.convertToBlob({type:'image/png'});
    const octets=new Uint8Array(await blob.arrayBuffer());let texte='';for(let i=0;i<octets.length;i+=32768)texte+=String.fromCharCode(...octets.subarray(i,i+32768));
    return {ecartMoyen:+(somme/n/3).toFixed(2),ecartLuminance:+(lum/n).toFixed(2),decalage:{dx:meilleur.dx,dy:meilleur.dy,ecart:+meilleur.ecart.toFixed(2)},png:btoa(texte)};
  },{a:url64(a),b:url64(b),largeur,hauteur});
  fs.writeFileSync(path.join(out,nom),Buffer.from(r.png,'base64'));delete r.png;
  return {...r,fichier:nom,lecture:'haut : A | B · bas : superposition 50 % | écart ×4'};
}
const luminance=buffer=>atelier.evaluate(async src=>{const im=new Image();await new Promise(r=>{im.onload=r;im.src=src;});
  const c=new OffscreenCanvas(64,36),x=c.getContext('2d');x.drawImage(im,im.width*.2,im.height*.2,im.width*.6,im.height*.6,0,0,64,36);
  const d=x.getImageData(0,0,64,36).data;let s=0;for(let i=0;i<d.length;i+=4)s+=.2126*d[i]+.7152*d[i+1]+.0722*d[i+2];return +(s/(64*36)).toFixed(1);},
  `data:image/png;base64,${buffer.toString('base64')}`);

// 1. Première vue jouable de la clairière, sans l'habillage.
{
  const ctx=await browser.newContext({viewport:{width:1920,height:1080},deviceScaleFactor:1});
  const page=await ctx.newPage();ecoute(page,'clairiere');
  await page.goto(base+'nova-yoga-3d.html?film=vu&debug-pose#clairiere');
  await page.waitForFunction(()=>window.__novaDebug&&!document.getElementById('macro').disabled,null,{timeout:60000});
  await page.addStyleTag({content:'#expedition>:not(canvas){visibility:hidden!important}'});
  await page.waitForTimeout(400);
  rapport.pose={position:await page.locator('#view').getAttribute('data-position'),...(await page.evaluate(()=>window.__novaDebug.info()))};
  await page.locator('#view').screenshot({path:path.join(out,'raccord-premiere-vue-jouable.png')});
  await ctx.close();
}
// 2. Superpositions.
const video=path.join(root,'videos/survol-sept-entrees.mp4'),arrivee=path.join(root,'images/sous-la-peau/survol.jpg');
const premiere=path.join(out,'raccord-survol-premiere-image.png'),derniere=path.join(out,'raccord-survol-derniere-image.png');
try{
  execFileSync(ffmpeg,['-loglevel','error','-y','-i',video,'-frames:v','1',premiere]);
  execFileSync(ffmpeg,['-loglevel','error','-y','-sseof','-0.2','-i',video,'-update','1','-frames:v','4',derniere]);
  rapport.video=execFileSync(ffmpeg.replace(/ffmpeg$/,'ffprobe'),['-v','error','-select_streams','v:0','-count_frames','-show_entries','stream=width,height,r_frame_rate,nb_read_frames,pix_fmt,codec_name','-of','csv=p=0',video]).toString().trim()+` · ${(fs.statSync(video).size/1e6).toFixed(2)} Mo`;
  rapport.raccords.survolVsJeu=await comparer(arrivee,path.join(out,'raccord-premiere-vue-jouable.png'),'raccord-fin-du-survol-vs-jeu.png');
  rapport.raccords.videoVsImage=await comparer(derniere,arrivee,'raccord-derniere-image-video-vs-survol-jpg.png');
  if(fs.existsSync(FIN_DU_FILM))rapport.raccords.filmVsSurvol=await comparer(FIN_DU_FILM,premiere,'raccord-fin-du-film-vs-debut-du-survol.png');
  else rapport.raccords.filmVsSurvol={erreur:'Fin-du-film.jpg introuvable : '+FIN_DU_FILM};
}catch(e){rapport.raccords.erreur=String(e.message||e).slice(0,400);}

// 3. Parcours de nova-yoga.html.
async function parcours(nom,{viewport,reduced=false,mobile=false}){
  const ctx=await browser.newContext({viewport,deviceScaleFactor:1,hasTouch:mobile,isMobile:mobile,reducedMotion:reduced?'reduce':'no-preference'});
  const page=await ctx.newPage();ecoute(page,nom);
  const r={nom,viewport,etapes:[]};const t0=Date.now();
  const etape=async(attendue,delai)=>{await page.waitForFunction(e=>document.getElementById('entrees-screen').dataset.etape===e,attendue,{timeout:delai});r.etapes.push([attendue,Date.now()-t0]);};
  const ecran=page.locator('#entrees-screen');
  try{
    await page.goto(base+'nova-yoga.html');
    await ecran.scrollIntoViewIfNeeded();
    await page.evaluate(()=>document.getElementById('entrees-screen').scrollIntoView({block:'center'}));
    if(reduced){
      await etape('invitation',8000);
      r.videoSansSource=await page.evaluate(()=>{const v=document.getElementById('entrees-film');return !v.currentSrc&&v.paused;});
    }else{
      await page.waitForFunction(()=>{const v=document.getElementById('entrees-film');return !v.paused&&v.currentTime>.3;},null,{timeout:20000});
      r.dureeFilm=await page.evaluate(()=>{const v=document.getElementById('entrees-film');const d=v.duration;v.currentTime=Math.max(0,d-1.2);return d;});   // film de Jade abrégé pour le test
      await etape('survol',30000);
      await page.waitForFunction(()=>document.getElementById('entrees-film').currentTime>=2.3,null,{timeout:20000});
      await ecran.screenshot({path:path.join(out,`parcours-${nom}-plan-d-ensemble.png`)});       // cadrage des sept entrées
      await etape('invitation',30000);
    }
    await page.waitForFunction(()=>document.getElementById('entrees-explore').textContent.includes('Explorer les sept entrées'),null,{timeout:8000});
    r.imageArrivee=await page.evaluate(()=>{const i=document.getElementById('entrees-raccord');return {visible:!i.hidden,source:i.getAttribute('src'),largeur:i.naturalWidth};});
    await page.waitForTimeout(300);
    await ecran.screenshot({path:path.join(out,`parcours-${nom}-invitation.png`)});
    if(mobile)await page.locator('#entrees-explore').tap();
    else{await page.locator('#entrees-explore').focus();await page.keyboard.press('Enter');}                 // accès clavier
    const clic=Date.now();const vues=[];
    while(Date.now()-clic<25000){
      vues.push([Date.now()-clic,await ecran.screenshot()]);
      if(await page.evaluate(()=>document.getElementById('entrees-screen').dataset.etape==='exploration'))break;
    }
    for(let i=0;i<8;i++){await page.waitForTimeout(90);vues.push([Date.now()-clic,await ecran.screenshot()]);}  // pendant le fondu
    r.bascule={ms:+(await ecran.getAttribute('data-bascule')),scene:await ecran.getAttribute('data-scene')};
    const lums=[];for(const [t,b] of vues)lums.push([t,await luminance(b)]);
    r.luminanceMin=Math.min(...lums.map(l=>l[1]));r.luminanceDepart=lums[0][1];
    r.imageNoire=lums.some(l=>l[1]<Math.max(10,lums[0][1]*.35));r.luminances=lums.filter((_,i)=>i%Math.ceil(lums.length/12)===0);
    await page.waitForTimeout(900);
    await ecran.screenshot({path:path.join(out,`parcours-${nom}-exploration.png`)});
    r.apres=await page.evaluate(()=>({lien:document.getElementById('entrees-explore').textContent,iframe:document.querySelector('#entrees-screen iframe')?.src,
      video:!!document.getElementById('entrees-film'),focus:document.activeElement?.tagName}));
    const cadre=page.frames().find(f=>f.url().includes('nova-yoga-3d.html'));
    r.poseJeu=cadre?await cadre.locator('#view').getAttribute('data-position'):null;
  }catch(e){r.erreur=String(e.message||e).slice(0,300);await ecran.screenshot({path:path.join(out,`parcours-${nom}-erreur.png`)}).catch(()=>{});}
  rapport.parcours.push(r);await ctx.close();
}
await parcours('bureau',{viewport:{width:1440,height:900}});
await parcours('mobile-portrait',{viewport:{width:390,height:844},mobile:true});
await parcours('mouvement-reduit',{viewport:{width:1440,height:900},reduced:true});
await browser.close();server.close();
fs.writeFileSync(path.join(out,'raccord-rapport.json'),JSON.stringify(rapport,null,1));
const resume={pose:rapport.pose,video:rapport.video,raccords:rapport.raccords,
  parcours:rapport.parcours.map(p=>({nom:p.nom,etapes:p.etapes,bascule:p.bascule,imageNoire:p.imageNoire,luminanceMin:p.luminanceMin,luminanceDepart:p.luminanceDepart,poseJeu:p.poseJeu,erreur:p.erreur})),
  console:rapport.console.slice(0,8),nconsole:rapport.console.length};
console.log(JSON.stringify(resume,null,1));
const echec=rapport.parcours.some(p=>p.erreur||p.imageNoire)||rapport.raccords.erreur;
process.exit(echec?1:0);
