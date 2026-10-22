// Guarda cuánto se ha leído de la página (posición de scroll) para poder
// compararlo aunque la pestaña esté dormida.
(() => {
  if (window.__tabTwinsScroll) return;
  window.__tabTwinsScroll = true;

  let timer = null;

  const report = () => {
    clearTimeout(timer);
    timer = null;
    const el = document.scrollingElement || document.documentElement;
    const max = el.scrollHeight - window.innerHeight;
    const pct = max > 0 ? Math.min(100, Math.round((window.scrollY / max) * 100)) : 0;
    try {
      chrome.runtime.sendMessage({ type: 'scroll', url: location.href, pct, y: Math.round(window.scrollY) }).catch(() => {});
    } catch {
      // La extensión se recargó o desinstaló: este script ya no tiene contexto.
    }
  };

  window.addEventListener('scroll', () => {
    if (!timer) timer = setTimeout(report, 1500);
  }, { passive: true });
  window.addEventListener('pagehide', report);
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) report();
  });
})();
