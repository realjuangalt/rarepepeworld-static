/**
 * Shared pepe image loader: try .gif, .jpg, .png so GIFs and all archive assets load.
 * Remembers the working extension in localStorage so later pages skip failed probes.
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

  window.PEPE_IMAGE_EXTS = ['.jpg', '.png', '.gif'];
  var EXT_STORAGE_KEY = 'rpw-pepe-exts-v1';

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

  function loadExtMap() {
    try {
      var raw = localStorage.getItem(EXT_STORAGE_KEY);
      if (!raw) return {};
      var parsed = JSON.parse(raw);
      return parsed && typeof parsed === 'object' ? parsed : {};
    } catch (e) {
      return {};
    }
  }

  function normalizeExt(ext) {
    if (!ext) return '';
    var e = String(ext).toLowerCase();
    if (e.charAt(0) !== '.') e = '.' + e;
    if (e === '.jpeg') e = '.jpg';
    if (window.PEPE_IMAGE_EXTS.indexOf(e) === -1) return '';
    return e;
  }

  function rememberedExt(asset) {
    var safe = String(asset || '').toUpperCase();
    if (!safe) return '';
    return normalizeExt(loadExtMap()[safe]);
  }

  function rememberExt(asset, ext) {
    var safe = String(asset || '').toUpperCase();
    var e = normalizeExt(ext);
    if (!safe || !e) return;
    try {
      var map = loadExtMap();
      if (map[safe] === e) return;
      map[safe] = e;
      localStorage.setItem(EXT_STORAGE_KEY, JSON.stringify(map));
    } catch (err) { /* quota / private mode */ }
  }

  window.rememberPepeImageExt = function (imgEl) {
    if (!imgEl) return;
    var asset = imgEl.getAttribute('data-asset');
    var src = imgEl.currentSrc || imgEl.src || '';
    if (!asset || !src || src.indexOf('data:') === 0) return;
    var match = src.match(/\.(gif|jpg|jpeg|png)(\?.*)?$/i);
    if (!match) return;
    rememberExt(asset, '.' + match[1].toLowerCase());
  };

  /** Base path for archive/pepes (same folder as the current page so local assets are used). */
  window.pepeImageBase = function () {
    if (window.PEPE_IMAGE_ORIGIN) return window.PEPE_IMAGE_ORIGIN;
    var path = (typeof location !== 'undefined' && location.pathname) || '';
    var dir = path.replace(/\/[^/]*$/, '') || '/';
    return dir === '/' ? '' : dir;
  };

  window.pepeImageUrl = function (asset, ext) {
    var safe = (asset || '').replace(/[^A-Za-z0-9._-]/g, '');
    if (!safe) return window.pepeImagePlaceholder;
    var e = normalizeExt(ext) || window.PEPE_IMAGE_EXTS[0];
    var base = window.pepeImageBase();
    return base + (base ? '/' : '') + 'archive/pepes/' + safe + e;
  };

  window.pepeImageUrlFirst = function (asset) {
    var known = rememberedExt(asset);
    return window.pepeImageUrl(asset, known || window.PEPE_IMAGE_EXTS[0]);
  };

  window.tryNextPepeExt = function (imgEl) {
    var asset = imgEl.getAttribute('data-asset');
    if (!asset) {
      imgEl.src = window.pepeImagePlaceholder;
      return;
    }
    var src = imgEl.src || '';
    var match = src.match(/\.(gif|jpg|jpeg|png)(\?.*)?$/i);
    var currentExt = match ? normalizeExt('.' + match[1].toLowerCase()) : '';
    var known = rememberedExt(asset);
    var order = window.PEPE_IMAGE_EXTS.slice();
    /* Prefer remembered ext first in the probe order when starting fresh. */
    if (known) {
      order = [known].concat(order.filter(function (e) { return e !== known; }));
    }
    var idx = order.indexOf(currentExt);
    if (idx < 0) idx = 0;
    idx += 1;
    if (idx >= order.length) {
      imgEl.onerror = null;
      imgEl.src = window.pepeImagePlaceholder;
      if (typeof window.rpwWarn === 'function') {
        window.rpwWarn('Image missing, using placeholder', { asset: asset, failedUrl: src });
      }
      return;
    }
    imgEl.src = window.pepeImageUrl(asset, order[idx]);
  };

  /**
   * Re-kick pepe imgs that failed to decode (common after client nav / SW update).
   * Safe to call after injecting card HTML or on pageshow.
   */
  window.repairPepeImages = function (root) {
    var scope = root && root.querySelectorAll ? root : document;
    var list = scope.querySelectorAll('img[data-asset]');
    for (var i = 0; i < list.length; i++) {
      var img = list[i];
      var asset = img.getAttribute('data-asset');
      if (!asset) continue;
      var broken = !img.getAttribute('src') ||
        (img.complete && img.naturalWidth === 0 && String(img.src).indexOf('data:') !== 0);
      if (!broken) continue;
      img.onerror = function () {
        if (typeof window.tryNextPepeExt === 'function') window.tryNextPepeExt(this);
      };
      img.src = window.pepeImageUrlFirst(asset);
    }
  };

  /* Remember successful loads; ignore "loads" that did not decode as an image. */
  document.addEventListener('load', function (e) {
    var t = e.target;
    if (!t || t.tagName !== 'IMG') return;
    if (!t.getAttribute('data-asset')) return;
    if (t.naturalWidth === 0) {
      if (typeof window.tryNextPepeExt === 'function') window.tryNextPepeExt(t);
      return;
    }
    window.rememberPepeImageExt(t);
  }, true);

  window.addEventListener('pageshow', function () {
    window.repairPepeImages(document);
  });
})();
