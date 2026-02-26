/**
 * Shared pepe image loader: try .gif, .jpg, .png so GIFs and all archive assets load.
 * Use data-asset="ASSETNAME" on img and set initial src to pepeImageUrlFirst(asset); onerror="tryNextPepeExt(this)".
 * Placeholder and card slot use Rare Pepe card aspect ratio 400×560 (official spec) everywhere.
 */
(function () {
  'use strict';

  /* Debug: collect errors and optional printed summary. Filter console by [RarePepeWorld]. Call rpwPrintErrors() for a summary. */
  window.rpwErrors = window.rpwErrors || [];
  window.rpwWarn = function (msg, detail) {
    var entry = { msg: msg, detail: detail || {}, time: new Date().toISOString() };
    window.rpwErrors.push(entry);
    console.warn('[RarePepeWorld]', msg, detail);
  };
  window.rpwPrintErrors = function () {
    console.warn('[RarePepeWorld] --- Error summary (' + window.rpwErrors.length + ') ---');
    window.rpwErrors.forEach(function (e, i) {
      console.warn('[RarePepeWorld]', (i + 1) + '.', e.msg, e.detail);
    });
    return window.rpwErrors;
  };

  window.PEPE_IMAGE_EXTS = ['.gif', '.jpg', '.png'];
  /* Single shared filler: 400×560 = official Rare Pepe card aspect ratio (same across site) */
  window.pepeImagePlaceholder = 'data:image/svg+xml,' + encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" width="400" height="560" viewBox="0 0 400 560">' +
    '<rect fill="#e9ecef" width="400" height="560"/>' +
    '<text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle" fill="#6c757d" font-size="18">Pepe</text>' +
    '</svg>'
  );

  /**
   * Optional: set to the origin of your static server (e.g. 'http://127.0.0.1:5000')
   * when the page is opened from another origin so images load. If unset and page is on
   * port 3000 (e.g. Cursor preview), we use the same host on port 5000 so archive/pepes works.
   */
  (function () {
    if (typeof window.PEPE_IMAGE_ORIGIN !== 'undefined' && window.PEPE_IMAGE_ORIGIN !== '') return;
    try {
      var port = parseInt(location.port, 10);
      if (location.hostname && (port === 3000 || port === 3001)) {
        window.PEPE_IMAGE_ORIGIN = location.protocol + '//' + location.hostname + ':5000';
      }
    } catch (e) {}
  })();
  window.PEPE_IMAGE_ORIGIN = window.PEPE_IMAGE_ORIGIN || '';

  /** Base path for archive/pepes (same folder as the current page so local assets are used). */
  window.pepeImageBase = function () {
    if (window.PEPE_IMAGE_ORIGIN) return window.PEPE_IMAGE_ORIGIN;
    var path = (typeof location !== 'undefined' && location.pathname) || '';
    var dir = path.replace(/\/[^/]*$/, '') || '/';
    return dir === '/' ? '' : dir;
  };

  window.pepeImageUrlFirst = function (asset) {
    var safe = (asset || '').replace(/[^A-Za-z0-9._-]/g, '');
    if (!safe) return window.pepeImagePlaceholder;
    var base = window.pepeImageBase();
    return base + (base ? '/' : '') + 'archive/pepes/' + safe + window.PEPE_IMAGE_EXTS[0];
  };

  window.tryNextPepeExt = function (imgEl) {
    var asset = imgEl.getAttribute('data-asset');
    if (!asset) {
      imgEl.src = window.pepeImagePlaceholder;
      return;
    }
    var src = imgEl.src || '';
    var match = src.match(/\.(gif|jpg|jpeg|png)(\?.*)?$/i);
    var currentExt = match ? ('.' + match[1].toLowerCase()) : '';
    var idx = window.PEPE_IMAGE_EXTS.indexOf(currentExt);
    if (idx < 0) idx = 0;
    idx += 1;
    if (idx >= window.PEPE_IMAGE_EXTS.length) {
      imgEl.onerror = null;
      imgEl.src = window.pepeImagePlaceholder;
      if (typeof window.rpwWarn === 'function') {
        window.rpwWarn('Image missing, using placeholder', { asset: asset, failedUrl: src });
      }
      return;
    }
    var base = src.replace(/\.(gif|jpg|jpeg|png)(\?.*)?$/i, '');
    imgEl.src = base + window.PEPE_IMAGE_EXTS[idx];
  };
})();
