import { getEntree, ENTREES } from '../data-map.js';
import { createExpedition } from './engine.js';

const $=id=>document.getElementById(id);
const canvas=$('view'),dialog=$('panel'),content=$('panelContent'),button=$('gesture');
const shots=['Au bord du lac','La paume','La goutte','Les lignes de peau','Le pli','La chambre intérieure','Le bol','Le palier'];
const cues=['Avance sur le lac en direction de la rive.','Regarde comment les lignes de la paume deviennent des reliefs.','Approche-toi de la goutte, puis regarde au-dessus de toi.','Longe les crêtes qui se dessinent dans la peau.','Suis la lumière à travers le pli.','Le passage s’ouvre sur la matière de la chambre.','Contourne le bol en suivant le chemin clair.','Sept entrées t’attendent au-delà du palier.'];
const actions=['Déposer le galet','Faire vibrer les cordes','Réveiller la braise','Déployer le voile','Étendre le pigment','Libérer la goutte','Relier les fils'];
const effects=['Le galet se dépose.','Les cordes vibrent.','La braise s’éclaire.','Le voile se déploie.','Le pigment s’étire.','La goutte descend.','Les fils se rejoignent.'];
let game=null,failed=false,busy=false,mode='',gestureTimer=0;
let visited={};
try{visited=JSON.parse(localStorage.getItem('nova.gestes.v1')||'{}')||{};}catch{}
function el(tag,text,cls){
  const node=document.createElement(tag);if(text)node.textContent=text;if(cls)node.className=cls;return node;
}
function action(text,fn,cls='action'){const b=el('button',text,cls);b.onclick=fn;return b;}
function zone(where,near){
  const {kind,n}=where;
  document.body.dataset.zone=kind+'-'+n;
  button.hidden=true;
  if(kind==='shot'){
    $('chapter').textContent='Sous la peau  /  Plan '+String(n+1).padStart(2,'0')+' sur 08';
    $('place').textContent=shots[n];$('hint').textContent=cues[n];
  }else if(kind==='hub'){
    $('chapter').textContent='Sous la peau  /  Les sept entrées';$('place').textContent='La clairière';
    $('hint').textContent='Tourne-toi vers une arche et traverse-la.';
  }else{
    const entry=getEntree(n);
    $('chapter').textContent='Entrée '+String(n).padStart(2,'0')+(kind==='passage'?'  /  Le seuil':'  /  Le monde intérieur');
    $('place').textContent=entry.name;
    $('hint').textContent=kind==='passage'?'Suis le passage pour découvrir ce monde.':near?entry.question:'Rejoins le centre pour '+actions[n-1].toLocaleLowerCase('fr')+'.';
    if(kind==='room'&&(near||visited[n])){
      button.hidden=false;button.textContent=visited[n]?'Retrouver les fragments':actions[n-1];
      button.onclick=()=>visited[n]?fragments(n):interact(n);
    }
  }
}
function show(kind,title){
  mode=kind;content.replaceChildren(el('h2',title));game?.pause(true);
  if(!dialog.open)dialog.showModal();
  dialog.scrollTop=0;
}
function finishClose(){
  if(dialog.open||!mode)return;
  game?.pause(false);canvas.focus({preventScroll:true});
  if(mode==='fragment'&&location.hash.includes('/fragment-'))history.replaceState(null,'',location.hash.split('/')[0]);
  mode='';
}
function close(){
  if(dialog.open){dialog.close();finishClose();}
}
dialog.addEventListener('close',finishClose);
$('close').onclick=close;
dialog.addEventListener('click',e=>{if(e.target===dialog&&!content.contains(e.target)){const r=dialog.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)close();}});
function navigate(n){
  if(!game){fragments(n);return;}
  magnify(false);
  close();history.pushState(null,'',n>0?'#entree-'+n:n===0?'#entrees':'#clairiere');
  game.place(n);canvas.focus({preventScroll:true});
}
function map(){
  show('map','Les sept entrées');
  const list=el('div',null,'choices');
  if(game){
    list.append(action('Reprendre au bord du lac',()=>navigate(0)),action('Rejoindre la clairière',()=>navigate(-1)));
  }
  for(const entry of ENTREES){
    const b=action(entry.name,()=>navigate(entry.n));
    b.prepend(el('b',String(entry.n).padStart(2,'0')));
    if(visited[entry.n]) b.append(el('small','· explorée'));
    list.append(b);
  }
  content.append(list);
}
function fragments(n){
  const entry=getEntree(n);
  show('fragments',entry.name);content.append(el('p',entry.question));
  const list=el('div',null,'choices');
  for(const f of entry.fragments)list.append(action(f.title||f.direction,()=>fragment(n,f.m,true)));
  content.append(list);
  if(game?.near===n&&visited[n])content.append(action('Refaire le geste',()=>{close();interact(n,true);}));
}
function fragment(n,m,push){
  const entry=getEntree(n),f=entry.fragments.find(item=>item.m===m);
  if(!f){fragments(n);return;}
  if(push)history.pushState(null,'','#entree-'+n+'/fragment-'+m);
  show('fragment',f.title||f.direction);
  const im=el('img',null,'fragment-art');im.src=f.image;im.alt=f.title||'Illustration de Jade';
  const a=el('a','Commencer ce parcours','action');a.href=f.href;
  content.append(im,el('p',f.text),a,action('Tous les fragments',()=>{history.replaceState(null,'','#entree-'+n);fragments(n);}));
}
function interact(n,replay=false){
  if(!game||busy||!n)return;
  if(visited[n]&&!replay){fragments(n);return;}
  busy=true;game.perform(n);button.hidden=true;$('hint').textContent=effects[n-1];
  visited[n]=true;try{localStorage.setItem('nova.gestes.v1',JSON.stringify(visited));}catch{}
  clearTimeout(gestureTimer);
  gestureTimer=setTimeout(()=>{
    busy=false;zone(game.zone,game.near);
    if(!dialog.open&&game.zone.kind==='room'&&game.zone.n===n)fragments(n);
  },game.film.enabled?1500:100);
}
function help(){
  show('help','Se déplacer');
  const ul=el('ul');
  for(const text of ['Avance et recule avec ↑ et ↓, Z et S, ou W et S.','Tourne avec ← et →. Glisse sur le paysage pour regarder en hauteur ou derrière toi.','La loupe ou la touche F permet d’observer la texture sous ton regard. Active-la à nouveau pour élargir la vue.','Décale-toi avec Q ou A, et D. Maintiens Maj pour marcher plus vite.','Clique sur le sol pour rejoindre un point. La molette avance ou recule dans la direction du regard.','Sur écran tactile, déplace le pouce sur la manette et regarde autour de toi avec l’autre main.','Près de l’objet au centre, utilise le bouton du geste ou la touche E.'])ul.append(el('li',text));
  content.append(ul);
  if(game){
    const toggle=action('',()=>{game.film.setEnabled(!game.film.enabled);update();});
    const update=()=>{toggle.textContent=game.film.enabled?'Figer les textures animées':'Animer les textures du film';};
    update();content.append(toggle);
  }
  const a=el('a','Ouvrir le parcours guidé','action');a.href='rituel-guide.html#entrees';content.append(a);
}
function route(){
  const hash=location.hash,m=/^#entree-([1-7])(?:\/fragment-([1-6]))?$/.exec(hash);
  close();
  if(m){game?.place(+m[1]);if(m[2])fragment(+m[1],+m[2],false);else if(failed)fragments(+m[1]);}
  else if(game)game.place(hash==='#clairiere'?-1:0);
}
function magnify(state){
  const active=state??($('macro').getAttribute('aria-pressed')!=='true');
  game?.setMacro(active);$('macro').setAttribute('aria-pressed',String(active));
}
$('macro').onclick=()=>{magnify();canvas.focus({preventScroll:true});};
$('mapButton').onclick=map;$('helpButton').onclick=help;$('walkHelp').onclick=help;
addEventListener('hashchange',route);
addEventListener('keydown',e=>{
  if(e.code==='KeyF'&&!dialog.open&&!e.repeat&&game&&!e.ctrlKey&&!e.metaKey){magnify();e.preventDefault();}
  if(e.code==='KeyE'&&!dialog.open&&!e.repeat&&game?.near){e.preventDefault();interact(game.near);}
});
function unavailable(){
  failed=true;game?.pause(true);game=null;$('macro').disabled=true;$('stick').hidden=true;$('walkHelp').hidden=true;
  $('chapter').textContent='Nova Yoga';$('place').textContent='Les sept entrées';
  $('hint').textContent='La scène 3D est indisponible sur cet appareil. Les 36 parcours de Jade sont accessibles ici.';
  button.hidden=false;button.textContent='Choisir une entrée';button.onclick=map;
}
try {
  game=await createExpedition(canvas,{zone,interact,lost:unavailable,name:n=>getEntree(n).name,gestureName:n=>actions[n-1]});
  $('macro').disabled=false;route();canvas.focus({preventScroll:true});
}catch(error){console.error('Exploration 3D',error);unavailable();route();}

