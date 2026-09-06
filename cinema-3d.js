(() => {
  const body = document.body;
  body.classList.add('cinema');
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const hero = document.querySelector('.open');
  const video = hero.querySelector('video');
  const orbit = document.createElement('div');
  orbit.className = 'cinema-orbit'; orbit.setAttribute('aria-hidden', 'true'); hero.prepend(orbit);
  const progress = document.createElement('div'); progress.className = 'cinema-progress'; body.append(progress);
  const controls = document.createElement('div'); controls.className = 'cinema-controls';
  const toggle = document.createElement('button'); toggle.type = 'button';
  const original = document.createElement('a'); original.href = 'nova-yoga.html'; original.textContent = 'Version classique';
  controls.append(toggle, original); body.append(controls);
  let paused = reduced.matches;
  const updateMode = () => {
    body.classList.toggle('motion-off', paused);
    toggle.textContent = paused ? 'Activer le mouvement' : 'Pause du mouvement';
    toggle.setAttribute('aria-pressed', String(paused));
    if (video) { if(paused) video.pause(); else video.play().catch(() => {}); }
  };
  toggle.addEventListener('click', () => { paused = !paused; updateMode(); });
  reduced.addEventListener('change', e => { paused = e.matches; updateMode(); }); updateMode();
  hero.addEventListener('pointermove', event => {
    if(paused || event.pointerType !== 'mouse') return;
    const rect = hero.getBoundingClientRect();
    body.style.setProperty('--cinema-x', `${((event.clientX - rect.left) / rect.width - .5) * 7}deg`);
    body.style.setProperty('--cinema-y', `${-((event.clientY - rect.top) / rect.height - .5) * 5}deg`);
  }, {passive:true});
  hero.addEventListener('pointerleave', () => {body.style.setProperty('--cinema-x','0deg');body.style.setProperty('--cinema-y','0deg');});
  let frame = 0;
  addEventListener('scroll', () => {
    if(frame) return;
    frame = requestAnimationFrame(() => {
      frame = 0;
      body.style.setProperty('--cinema-progress', String(scrollY / Math.max(1,document.documentElement.scrollHeight-innerHeight)));
    });
  }, {passive:true});
  new IntersectionObserver(entries => {
    if(!video) return;
    if(entries[0].isIntersecting && !paused && !document.hidden) video.play().catch(()=>{}); else video.pause();
  }, {threshold:.05}).observe(hero);
  document.addEventListener('visibilitychange', () => {if(video && document.hidden) video.pause();});
})();
