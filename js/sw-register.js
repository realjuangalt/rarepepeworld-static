/**
 * Register the Rare Pepe World service worker (GitHub Pages / custom domain).
 */
(function () {
  'use strict';
  if (!('serviceWorker' in navigator)) return;

  function register() {
    var base = location.href.replace(/[^/]*$/, '');
    var swHref = new URL('sw.js', base).href;
    navigator.serviceWorker.register(swHref).catch(function (err) {
      if (typeof window.rpwWarn === 'function') {
        window.rpwWarn('SW register failed', { error: String(err && err.message || err), sw: swHref });
      }
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', register);
  } else {
    register();
  }
})();
