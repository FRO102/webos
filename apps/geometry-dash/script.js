// Integracao minima com o WebOS: sem armazenamento nem notificacoes.
// - Remove o thumbnail inicial com polling seguro.
// - Tecla F alterna o fullscreen atraves do shell (com fallback).
// - Aplica as traducoes do SDK.

(function () {
  const removeThumb = () => {
    const thumb = document.getElementById('thumbnail');
    if (thumb) { try { thumb.remove(); } catch (e) {} return true; }
    return false;
  };
  // Poll compativel com CDNs bloqueados: evita TypeError quando o elemento nao existe ainda.
  let tries = 0;
  const interval = setInterval(() => { if (removeThumb() || ++tries >= 80) clearInterval(interval); }, 200);
  setTimeout(removeThumb, 8000);
  setTimeout(removeThumb, 12000);

  document.addEventListener('keydown', (event) => {
    if (!event || (event.key !== 'f' && event.key !== 'F')) return;
    const os = (typeof window !== 'undefined' ? window.os : null);
    if (os && os.shell && typeof os.shell.toggleFullscreen === 'function') {
      try { os.shell.toggleFullscreen().catch(function () {}); } catch (e) {}
    } else if (typeof document !== 'undefined' && document.documentElement && document.documentElement.requestFullscreen) {
      try { document.documentElement.requestFullscreen(); } catch (e) {}
    }
  });

  try {
    if (window.os && window.os.i18n && typeof window.os.i18n.apply === 'function') window.os.i18n.apply();
  } catch (e) { /* noop */ }
})();

