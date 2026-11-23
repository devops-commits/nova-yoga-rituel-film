const screen = document.getElementById('entrees-screen');
const film = document.getElementById('entrees-film');
const still = document.getElementById('entrees-raccord');
const explore = document.getElementById('entrees-explore');
const motion = matchMedia('(prefers-reduced-motion: reduce)');
const SURVOL = { video: 'videos/survol-plateforme-libre-11s.mp4', image: 'images/sous-la-peau/plateforme-libre.jpg' };
const PATIENCE = 20000;

let stage = 'film'; // film → survol → invitation → chargement → exploration
let stillReady = null;

function setStage(next) {
  stage = next;
  screen.dataset.etape = next;
}

function loadStill() {
  if (!stillReady) {
    still.src = SURVOL.image;
    stillReady = still.decode ? still.decode().catch(() => {}) : Promise.resolve();
  }
  return stillReady;
}

async function holdStill() {
  await loadStill();
  still.hidden = false;
  film.pause();
}

async function invite() {
  if (stage === 'chargement' || stage === 'exploration') return;
  setStage('invitation');
  observer.disconnect();
  await holdStill();
  if (stage !== 'invitation') return;
  screen.classList.add('awaits-explorer');
  explore.textContent = 'Explorer les sept entrées';
}

function nextFilm() {
  if (stage !== 'film') {
    if (stage === 'survol') invite();
    return;
  }
  if (motion.matches) {
    invite();
    return;
  }
  setStage('survol');
  loadStill();
  film.poster = 'images/sous-la-peau/plateforme-bol.jpg';
  film.src = SURVOL.video;
  film.play().catch(() => invite());
}

function reveal(frame, clickedAt) {
  if (stage !== 'chargement') return;
  setStage('exploration');
  screen.dataset.bascule = Math.round(performance.now() - clickedAt);
  screen.classList.remove('awaits-explorer');
  screen.classList.add('is-exploring');
  explore.removeAttribute('aria-busy');
  explore.textContent = 'Ouvrir l’exploration en plein écran';
  const clear = () => {
    film.remove();
    still.remove();
  };
  if (motion.matches) clear();
  else setTimeout(clear, 950);
  frame.focus({ preventScroll: true });
}

async function showExploration() {
  const clickedAt = performance.now();
  setStage('chargement');
  observer.disconnect();
  explore.setAttribute('aria-busy', 'true');
  explore.textContent = 'Préparation de l’exploration…';
  await holdStill();
  const frame = document.createElement('iframe');
  frame.title = 'Sous la peau, exploration 3D';
  frame.allow = 'fullscreen';
  const done = () => {
    removeEventListener('message', listen);
    clearTimeout(timer);
    reveal(frame, clickedAt);
  };
  function listen(event) {
    if (event.source !== frame.contentWindow || event.data?.type !== 'nova-yoga:premiere-image') return;
    screen.dataset.scene = event.data.ready ? 'prete' : 'secours';
    done();
  }
  addEventListener('message', listen);
  const timer = setTimeout(() => {
    // Garder la dernière image de Flow pendant un chargement lent.
    explore.textContent = 'Ouvrir directement l’exploration 3D';
    explore.removeAttribute('aria-busy');
  }, PATIENCE);
  frame.src = explore.href;
  screen.append(frame);
}

const observer = new IntersectionObserver(([entry]) => {
  if (motion.matches || stage !== 'film' || entry.intersectionRatio < 0.55 || !film.paused) return;
  observer.disconnect();
  film.play().catch(() => invite());
}, { threshold: 0.55 });

film.addEventListener('play', () => observer.disconnect(), { once: true });
film.addEventListener('ended', nextFilm);
film.addEventListener('error', nextFilm);
motion.addEventListener('change', (event) => {
  if (event.matches && (stage === 'film' || stage === 'survol')) invite();
});
explore.addEventListener('click', (event) => {
  // Après la bascule, ou avec une touche de modification, le lien ouvre la page 3D elle-même.
  if (stage === 'exploration' || (stage === 'chargement' && !explore.hasAttribute('aria-busy')) || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
  event.preventDefault();
  if (stage !== 'chargement') showExploration();
});

setStage('film');
if (motion.matches) {
  // Mouvement réduit : aucune vidéo, l'invitation directe sur l'image d'arrivée.
  film.removeAttribute('src');
  film.poster = SURVOL.image;
  film.load();
  invite();
} else observer.observe(film);
