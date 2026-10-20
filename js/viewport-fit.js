/** Ajusta altura real do iframe/viewport (--app-h) e classes de layout. */
const root = document.documentElement;

export function applyViewportFit() {
  const w = window.innerWidth;
  const h = window.innerHeight;
  const inIframe = window.self !== window.top;
  const portrait = h > w;
  const compact = h <= 560;
  const short = h <= 520;

  root.style.setProperty('--app-w', `${w}px`);
  root.style.setProperty('--app-h', `${h}px`);

  root.classList.toggle('layout-embedded', inIframe);
  root.classList.toggle('layout-portrait', portrait);
  root.classList.toggle('layout-compact', compact);
  root.classList.toggle('layout-short', short);

  const matchScale = matchUiScale(w, h);
  root.style.setProperty('--match-ui-scale', String(matchScale));
  root.classList.toggle('layout-match-zoom', matchScale < 0.99);

  fitStartScreen();
}

/** Desktop paisagem (iframe CG): reduz partida ao vivo e resultado para caber na tela. */
function matchUiScale(w, h) {
  if (h > w) return 1;
  if (h >= 720) return 1;
  if (h >= 640) return 0.94;
  if (h >= 580) return 0.88;
  if (h >= 520) return 0.82;
  return 0.76;
}

function fitStartScreen() {
  const screen = document.getElementById('screen-start');
  const btn = document.getElementById('btn-start');
  if (!screen?.classList.contains('active') || !btn) return;

  requestAnimationFrame(() => {
    const bottom = btn.getBoundingClientRect().bottom;
    const vh = window.innerHeight;
    if (bottom > vh - 6) {
      screen.scrollTop += bottom - vh + 12;
    }
  });
}

applyViewportFit();

window.addEventListener('resize', applyViewportFit, { passive: true });
window.addEventListener('orientationchange', () => {
  setTimeout(applyViewportFit, 120);
});

const loadingEl = document.getElementById('loading');
if (loadingEl) {
  const obs = new MutationObserver(() => {
    if (loadingEl.classList.contains('hidden')) fitStartScreen();
  });
  obs.observe(loadingEl, { attributes: true, attributeFilter: ['class'] });
}
