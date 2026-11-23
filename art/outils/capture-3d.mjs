// Capture reproductible de l'exploration 3D « Sous la peau » (Chrome headless).
// usage : node art/outils/capture-3d.mjs <racine public> <préfixe> <dossier sortie> [port] [--verif] [--injecter-crochet]
//   --verif             : en plus des angles, vérifie la loupe (F), les sept entrées, le geste (E) et l'absence du crochet par défaut
//   --injecter-crochet  : pour une version antérieure sans crochet (sauvegarde), greffe à la volée le crochet ?debug-pose
//                         lu dans engine.js du dépôt ; le reste du fichier servi n'est pas modifié
// Dépend de playwright-core (NOVA_PLAYWRIGHT=chemin du module) et de Google Chrome.
import http from 'node:http';import fs from 'node:fs';import path from 'node:path';import {createRequire} from 'node:module';
const [root0,prefix,out,port0]=process.argv.slice(2);const verif=process.argv.includes('--verif');
const root=path.resolve(root0),port=+(port0&&!port0.startsWith('--')?port0:8876);
const require=createRequire(import.meta.url);
const {chromium}=require(process.env.NOVA_PLAYWRIGHT||'playwright-core');
const types={'.html':'text/html; charset=utf-8','.js':'text/javascript','.css':'text/css','.json':'application/json','.glb':'model/gltf-binary','.mp4':'video/mp4','.png':'image/png','.jpg':'image/jpeg','.svg':'image/svg+xml'};
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
// Repères (three.js : x, y haut, z) : bol de l'entrée 1 et goutte du plan 3.
const BOL=[-24.749,.40,24.749],GOUTTE=[3.72,.80,38.45];
const vers=(de,cible,extra={})=>{const [dx,dy,dz]=cible.map((v,i)=>v-de[i]);return {x:de[0],y:de[1],z:de[2],yaw:Math.atan2(dx,-dz),pitch:Math.atan2(dy,Math.hypot(dx,dz)),...extra};};
const ANGLES=[
  ['face bol entree-1',vers([-21.75,1.62,21.75],BOL)],
  ['oblique bol',vers([-22.95,.95,25.75],BOL)],
  ['rasante sol lin',vers([-22.6,.22,22.1],[-24.749,.05,24.749])],
  ['paume/goutte',vers([1.55,1.05,36.35],GOUTTE)],
  ['lointaine en rotation',{x:-8.4,y:1.62,z:8.4,yaw:-2.356+.31,pitch:.06}],
  ['lointaine en rotation +0,35°',{x:-8.4,y:1.62,z:8.4,yaw:-2.356+.31+.0061,pitch:.06},'5b'],
];
const browser=await chromium.launch({executablePath:process.env.NOVA_CHROME||'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true,
  args:['--use-angle=metal','--enable-gpu','--ignore-gpu-blocklist','--hide-scrollbars','--autoplay-policy=no-user-gesture-required']});
const report={root,angles:[],console:[],entrees:[]};
async function ouvrir(hash,reduced=true){
  const ctx=await browser.newContext({viewport:{width:1280,height:720},deviceScaleFactor:1,reducedMotion:reduced?'reduce':'no-preference'});
  const page=await ctx.newPage();
  if(process.argv.includes('--injecter-crochet')){
    const actuel=fs.readFileSync(new URL('../../public/experience/exploration/engine.js',import.meta.url),'utf8'),fin='  return {place,perform';
    const crochet=actuel.slice(actuel.indexOf('  // Crochet de capture'),actuel.indexOf(fin));
    await page.route('**/experience/exploration/engine.js',async route=>{
      const reponse=await route.fetch(),corps=await reponse.text();
      await route.fulfill({response:reponse,body:corps.includes('__novaDebug')?corps:corps.replace(fin,crochet+fin)});
    });
  }
  page.on('console',m=>{if(['error','warning'].includes(m.type()))report.console.push(`[${hash}] ${m.type()}: ${m.text()}`);});
  page.on('pageerror',e=>report.console.push(`[${hash}] pageerror: ${e.message}`));
  page.on('requestfailed',r=>{if(!/\.mp4/.test(r.url()))report.console.push(`[${hash}] requestfailed: ${r.url()}`);});
  page.on('response',r=>{if(r.status()>=400)report.console.push(`[${hash}] http ${r.status()}: ${r.url()}`);});
  await page.goto(`http://127.0.0.1:${port}/nova-yoga-3d.html?debug-pose${hash}`);
  await page.waitForFunction(()=>window.__novaDebug&&!document.getElementById('macro').disabled,null,{timeout:60000});
  return {ctx,page};
}
fs.mkdirSync(out,{recursive:true});
{ // Cinq angles fixes, textures figées (mouvement réduit) pour un rendu déterministe.
  const {ctx,page}=await ouvrir('#entree-1');
  report.gpu=await page.evaluate(()=>{const g=document.createElement('canvas').getContext('webgl2');const e=g.getExtension('WEBGL_debug_renderer_info');return e?g.getParameter(e.UNMASKED_RENDERER_WEBGL):'?';});
  for(const [i,[nom,pose,id]] of ANGLES.entries()){
    await page.evaluate(p=>window.__novaDebug.pose(p),pose);
    await page.waitForTimeout(3200);
    const file=path.join(out,`${prefix}-${id||i+1}.png`);
    await page.locator('#view').screenshot({path:file});
    report.angles.push({n:id||i+1,nom,file,...await page.evaluate(()=>window.__novaDebug.info())});
  }
  if(verif){ // Loupe (F) sur le sol de lin, à l'angle 3.
    await page.evaluate(p=>window.__novaDebug.pose(p),ANGLES[2][1]);
    await page.locator('#view').focus();await page.keyboard.press('KeyF');await page.waitForTimeout(2500);
    const info=await page.evaluate(()=>({...window.__novaDebug.info(),pressed:document.getElementById('macro').getAttribute('aria-pressed')}));
    await page.locator('#view').screenshot({path:path.join(out,`${prefix}-loupe.png`)});
    await page.keyboard.press('KeyF');await page.waitForTimeout(600);
    report.loupe={fovLoupe:info.fov,pressed:info.pressed,fovRetour:(await page.evaluate(()=>window.__novaDebug.info())).fov};
  }
  await ctx.close();
}
if(verif){
  for(let n=1;n<=7;n++){ // Sept entrées : chargement, geste (E), fragments.
    const {ctx,page}=await ouvrir('#entree-'+n,false);
    await page.evaluate(()=>localStorage.removeItem('nova.gestes.v1'));
    await page.waitForFunction(()=>document.getElementById('gesture').hidden===false,null,{timeout:8000}).catch(()=>{});
    const avant=await page.evaluate(()=>({zone:document.body.dataset.zone,chapitre:document.getElementById('chapter').textContent,geste:document.getElementById('gesture').hidden?null:document.getElementById('gesture').textContent}));
    await page.locator('#view').focus();await page.keyboard.press('KeyE');
    await page.waitForFunction(()=>document.getElementById('panel').open,null,{timeout:6000}).catch(()=>{});
    const apres=await page.evaluate(()=>({effet:document.getElementById('hint').textContent,dialogue:document.getElementById('panel').open,fragments:document.querySelectorAll('#panelContent .choices button').length,visite:localStorage.getItem('nova.gestes.v1')}));
    report.entrees.push({n,...avant,...apres});
    await ctx.close();
  }
  { const {ctx,page}=await ouvrir('#entrees',false);
    await page.waitForTimeout(2500);
    report.entreesHash=await page.evaluate(()=>({zone:document.body.dataset.zone,position:document.getElementById('view').dataset.position,video:(()=>{const i=window.__novaDebug.info();return i;})()}));
    await ctx.close(); }
  { // Sans le paramètre, le crochet doit être absent.
    const ctx=await browser.newContext();const page=await ctx.newPage();
    await page.goto(`http://127.0.0.1:${port}/nova-yoga-3d.html#entree-1`);
    await page.waitForFunction(()=>!document.getElementById('macro').disabled,null,{timeout:60000});
    report.crochetAbsentParDefaut=await page.evaluate(()=>window.__novaDebug===undefined);
    await ctx.close(); }
}
await browser.close();server.close();
fs.writeFileSync(path.join(out,`${prefix}-rapport.json`),JSON.stringify(report,null,1));
console.log(JSON.stringify({gpu:report.gpu,angles:report.angles.map(a=>[a.n,a.calls,a.triangles,a.textures,a.programs,a.pixelRatio]),console:report.console.slice(0,6),nconsole:report.console.length,loupe:report.loupe,entrees:report.entrees.map(e=>[e.n,e.zone,e.geste,e.dialogue,e.fragments]),crochetAbsent:report.crochetAbsentParDefaut}));
