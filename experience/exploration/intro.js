export function playIntro(expedition, canvas) {
  const preference = matchMedia('(prefers-reduced-motion: reduce)');
  const focusScene = () => {
    if (window.self === window.top && !expedition.querySelector('dialog[open]')) canvas.focus({ preventScroll: true });
  };
  const filmSeen = new URLSearchParams(location.search).get('film') === 'vu';
  if (preference.matches || filmSeen || (location.hash && location.hash !== '#entrees')) {
    return { sceneReady: focusScene };
  }

  const intro = document.getElementById('film-intro');
  const video = intro.querySelector('video');
  const playButton = document.getElementById('film-intro-play');
  const skipButton = document.getElementById('film-intro-skip');
  const status = document.getElementById('film-intro-status');
  let ready = false;
  let ended = false;
  let dismissed = false;

  function dismiss() {
    if (dismissed) return;
    dismissed = true;
    video.pause();
    video.removeAttribute('src');
    video.load();
    intro.hidden = true;
    expedition.inert = false;
    preference.removeEventListener('change', motionChanged);
    focusScene();
  }

  function motionChanged(event) {
    if (event.matches) dismiss();
  }

  async function play() {
    try {
      await video.play();
      if (document.activeElement === playButton) skipButton.focus();
      playButton.hidden = true;
    } catch {
      if (!dismissed) playButton.hidden = false;
    }
  }

  video.addEventListener('ended', () => {
    ended = true;
    if (ready) dismiss();
    else {
      status.textContent = 'Préparation de l’exploration…';
      skipButton.textContent = 'Entrer dans l’exploration';
    }
  }, { once: true });
  video.addEventListener('error', dismiss, { once: true });
  playButton.addEventListener('click', play);
  skipButton.addEventListener('click', dismiss);
  preference.addEventListener('change', motionChanged);

  expedition.inert = true;
  intro.hidden = false;
  video.poster = 'images/sous-la-peau/lac.webp';
  video.muted = true;
  video.src = 'videos/sous-la-peau-web.mp4';
  play();

  return {
    sceneReady() {
      ready = true;
      if (ended) dismiss();
    },
  };
}
