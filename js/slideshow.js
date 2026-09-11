/**
 * Full-screen slideshow for address/artist collections and full-catalog random mode.
 * startSlideshow(assetList, options?)
 *   options.durationMs — default 21000 (sequence) or 10000 (random)
 *   options.mode — 'sequence' | 'random'
 *   options.preload — how many slides to warm ahead (random default 3)
 *   options.catalog — name[] for random mode (or load via RandomPepeCore)
 * startRandomSlideshow() — full Rare Pepe catalog, 10s, preload 3
 */
(function () {
  'use strict';

  var DEFAULT_SEQUENCE_MS = 21000;
  var DEFAULT_RANDOM_MS = 10000;
  var DEFAULT_RANDOM_PRELOAD = 3;

  /** Visible pepe area inside an object-fit:contain image box. */
  function getContainedImageRect(img) {
    var br = img.getBoundingClientRect();
    var nw = img.naturalWidth || 0;
    var nh = img.naturalHeight || 0;
    if (!nw || !nh || !br.width || !br.height) {
      return { left: br.left, top: br.top, right: br.right, bottom: br.bottom, width: br.width, height: br.height };
    }
    var scale = Math.min(br.width / nw, br.height / nh);
    var w = nw * scale;
    var h = nh * scale;
    var left = br.left + (br.width - w) / 2;
    var top = br.top + (br.height - h) / 2;
    return { left: left, top: top, width: w, height: h, right: left + w, bottom: top + h };
  }

  function imageUrlFor(name) {
    if (window.RandomPepeCore && window.RandomPepeCore.imageUrlFor) {
      return window.RandomPepeCore.imageUrlFor(name);
    }
    if (typeof window.pepeImageUrlFirst === 'function') {
      return window.pepeImageUrlFirst(name);
    }
    var safe = (name || '').replace(/[^A-Za-z0-9._-]/g, '');
    return safe ? 'archive/pepes/' + safe + '.gif' : '';
  }

  function pickRandomName(catalog, excludeList) {
    if (window.RandomPepeCore && window.RandomPepeCore.pickRandomAsset) {
      return window.RandomPepeCore.pickRandomAsset(catalog, excludeList);
    }
    if (!catalog || !catalog.length) return null;
    return catalog[Math.floor(Math.random() * catalog.length)];
  }

  function makeSlideItem(name, imgUrl) {
    var url = imgUrl || imageUrlFor(name);
    var item = { name: name, imgUrl: url, ready: false, img: null };
    if (url && typeof Image !== 'undefined') {
      item.img = new Image();
      item.img.onload = function () { item.ready = true; };
      item.img.onerror = function () { item.ready = true; };
      item.img.setAttribute('data-asset', name || '');
      item.img.src = url;
    } else {
      item.ready = true;
    }
    return item;
  }

  function onFullscreenChange() {
    var overlay = document.getElementById('address-slideshow-overlay');
    var inFs = !!(document.fullscreenElement || document.webkitFullscreenElement);
    if (!inFs && overlay && overlay.classList.contains('address-slideshow-active') && overlay._stopSlideshow) {
      overlay._stopSlideshow();
    }
  }

  function ensureOverlay() {
    var overlay = document.getElementById('address-slideshow-overlay');
    if (overlay) return overlay;
    overlay = document.createElement('div');
    overlay.id = 'address-slideshow-overlay';
    overlay.className = 'address-slideshow-overlay';
    overlay.innerHTML =
      '<button type="button" class="address-slideshow-exit" aria-label="Exit slideshow"><i class="fa fa-times"></i></button>' +
      '<div class="address-slideshow-img-wrap"><img class="address-slideshow-img" src="" alt=""></div>' +
      '<div class="address-slideshow-caption"></div>';
    document.body.appendChild(overlay);

    overlay.querySelector('.address-slideshow-exit').addEventListener('click', function (e) {
      e.stopPropagation();
      if (overlay._stopSlideshow) overlay._stopSlideshow();
    });
    overlay.addEventListener('click', function (e) {
      if (!overlay.classList.contains('address-slideshow-active')) return;
      if (e.target.closest('.address-slideshow-exit')) return;
      var cardImg = overlay.querySelector('.address-slideshow-img');
      if (cardImg && (e.target === cardImg || cardImg.contains(e.target))) {
        var cardRect = getContainedImageRect(cardImg);
        if (
          cardRect.width > 0 &&
          e.clientX >= cardRect.left &&
          e.clientX <= cardRect.right &&
          e.clientY >= cardRect.top &&
          e.clientY <= cardRect.bottom
        ) {
          var mid = cardRect.left + cardRect.width / 2;
          if (e.clientX < mid) {
            if (overlay._goPrev) overlay._goPrev();
          } else {
            if (overlay._goNext) overlay._goNext();
          }
        }
      }
      if (overlay._showExit) overlay._showExit();
    });
    overlay.addEventListener('dblclick', function (e) {
      if (!overlay.classList.contains('address-slideshow-active')) return;
      e.preventDefault();
      if (overlay._stopSlideshow) overlay._stopSlideshow();
    });
    document.addEventListener('keydown', function onKey(e) {
      if (e.key === 'Escape' && overlay.classList.contains('address-slideshow-active') && overlay._stopSlideshow) {
        overlay._stopSlideshow();
      }
    });
    document.addEventListener('fullscreenchange', onFullscreenChange);
    document.addEventListener('webkitfullscreenchange', onFullscreenChange);
    return overlay;
  }

  /**
   * @param {Array<{name:string,imgUrl?:string}>|string[]} assetList
   * @param {{durationMs?:number, mode?:string, preload?:number, catalog?:string[]}} [options]
   */
  function startSlideshow(assetList, options) {
    options = options || {};
    var mode = options.mode === 'random' ? 'random' : 'sequence';
    var durationMs = options.durationMs != null
      ? options.durationMs
      : (mode === 'random' ? DEFAULT_RANDOM_MS : DEFAULT_SEQUENCE_MS);
    var preloadCount = options.preload != null
      ? options.preload
      : (mode === 'random' ? DEFAULT_RANDOM_PRELOAD : 1);

    var sequence = (assetList || []).map(function (a) {
      if (typeof a === 'string') return { name: a, imgUrl: imageUrlFor(a) };
      return { name: a.name, imgUrl: a.imgUrl || imageUrlFor(a.name) };
    }).filter(function (a) { return a && a.name; });

    var catalog = (options.catalog || []).map(function (n) { return String(n).toUpperCase(); });
    if (mode === 'random' && !catalog.length && sequence.length) {
      catalog = sequence.map(function (a) { return String(a.name).toUpperCase(); });
    }
    if (mode === 'sequence' && !sequence.length) return;
    if (mode === 'random' && !catalog.length && !sequence.length) return;

    if (window._addressSlideshowTimer) {
      clearInterval(window._addressSlideshowTimer);
      window._addressSlideshowTimer = null;
    }

    var overlay = ensureOverlay();
    var exitBtn = overlay.querySelector('.address-slideshow-exit');
    var img = overlay.querySelector('.address-slideshow-img');
    var caption = overlay.querySelector('.address-slideshow-caption');
    var index = 0;
    var fadeTimer = null;
    var FADE_DELAY_MS = 3000;

    /* Random mode: past stack + current + future queue */
    var past = [];
    var current = null;
    var future = [];

    function scheduleFadeExit() {
      if (fadeTimer) clearTimeout(fadeTimer);
      fadeTimer = setTimeout(function () {
        fadeTimer = null;
        exitBtn.classList.add('address-slideshow-exit-faded');
      }, FADE_DELAY_MS);
    }
    function showExit() {
      exitBtn.classList.remove('address-slideshow-exit-faded');
      scheduleFadeExit();
    }
    function clearFadeTimer() {
      if (fadeTimer) clearTimeout(fadeTimer);
      fadeTimer = null;
      exitBtn.classList.remove('address-slideshow-exit-faded');
    }

    function clearAutoAdvance() {
      if (window._addressSlideshowTimer) {
        clearInterval(window._addressSlideshowTimer);
        window._addressSlideshowTimer = null;
      }
    }

    function startAutoAdvance() {
      clearAutoAdvance();
      if (mode === 'sequence' && sequence.length <= 1) return;
      if (mode === 'random' && catalog.length <= 1) return;
      window._addressSlideshowTimer = setInterval(function () {
        if (mode === 'random') {
          goNext();
        } else {
          showSequenceSlide((index + 1) % sequence.length);
        }
      }, durationMs);
    }

    function recentNames() {
      var names = [];
      if (current && current.name) names.push(current.name);
      past.forEach(function (p) { if (p && p.name) names.push(p.name); });
      future.forEach(function (f) { if (f && f.name) names.push(f.name); });
      return names;
    }

    function fillFuture() {
      if (mode !== 'random') return;
      while (future.length < preloadCount && catalog.length) {
        var name = pickRandomName(catalog, recentNames());
        if (!name) break;
        future.push(makeSlideItem(name));
      }
    }

    function paintSlide(item) {
      if (!item) return;
      current = item;
      img.setAttribute('data-asset', item.name || '');
      img.src = (item.img && item.img.src) || item.imgUrl || imageUrlFor(item.name) || (window.pepeImagePlaceholder || '');
      img.alt = item.name || '';
      caption.textContent = item.name || '';
      img.onerror = function () {
        if (typeof window.tryNextPepeExt === 'function') {
          window.tryNextPepeExt(img);
        } else {
          img.src = window.pepeImagePlaceholder || '';
        }
      };
    }

    function showSequenceSlide(i) {
      if (!sequence.length) return;
      if (i < 0 || i >= sequence.length) return;
      index = i;
      var a = sequence[index];
      paintSlide(makeSlideItem(a.name, a.imgUrl));
      /* warm next in sequence */
      if (preloadCount > 0 && index + 1 < sequence.length) {
        makeSlideItem(sequence[index + 1].name, sequence[index + 1].imgUrl);
      }
    }

    function goPrev() {
      if (mode === 'random') {
        if (!past.length) return;
        if (current) future.unshift(current);
        paintSlide(past.pop());
        fillFuture();
        startAutoAdvance();
        return;
      }
      if (index <= 0) return;
      showSequenceSlide(index - 1);
      startAutoAdvance();
    }

    function goNext() {
      if (mode === 'random') {
        fillFuture();
        if (!future.length) {
          var name = pickRandomName(catalog, recentNames());
          if (!name) return;
          future.push(makeSlideItem(name));
        }
        if (current) past.push(current);
        if (past.length > 50) past.shift();
        paintSlide(future.shift());
        fillFuture();
        startAutoAdvance();
        return;
      }
      if (index >= sequence.length - 1) return;
      showSequenceSlide(index + 1);
      startAutoAdvance();
    }

    function stopSlideshow() {
      clearFadeTimer();
      var doc = document;
      if (doc.fullscreenElement || doc.webkitFullscreenElement) {
        (doc.exitFullscreen || doc.webkitExitFullscreen).call(doc).catch(function () {});
      }
      overlay.classList.remove('address-slideshow-active');
      clearAutoAdvance();
      past = [];
      future = [];
      current = null;
    }

    overlay._showExit = showExit;
    overlay._stopSlideshow = stopSlideshow;
    overlay._goPrev = goPrev;
    overlay._goNext = goNext;

    if (mode === 'random') {
      var firstName = sequence.length
        ? sequence[0].name
        : pickRandomName(catalog, []);
      if (!firstName) return;
      paintSlide(makeSlideItem(firstName, sequence.length ? sequence[0].imgUrl : null));
      fillFuture();
    } else {
      showSequenceSlide(0);
    }

    overlay.classList.add('address-slideshow-active');
    clearFadeTimer();
    scheduleFadeExit();
    startAutoAdvance();
    if (overlay.requestFullscreen) {
      overlay.requestFullscreen().catch(function () {});
    } else if (overlay.webkitRequestFullscreen) {
      overlay.webkitRequestFullscreen();
    }
  }

  function startRandomSlideshow() {
    var core = window.RandomPepeCore;
    var start = function (names) {
      if (!names || !names.length) {
        if (typeof window.rpwWarn === 'function') {
          window.rpwWarn('slideshow: random catalog empty', { url: window.location.href });
        }
        return;
      }
      startSlideshow([], {
        mode: 'random',
        durationMs: DEFAULT_RANDOM_MS,
        preload: DEFAULT_RANDOM_PRELOAD,
        catalog: names
      });
    };
    if (core && core.loadCatalog) {
      core.loadCatalog().then(start);
    } else {
      fetch('data/RarePepeDirectory_Series_Data.json')
        .then(function (r) { return r.ok ? r.json() : {}; })
        .then(function (data) {
          var names = [];
          Object.keys(data || {}).forEach(function (k) {
            if (k === '_meta' || !Array.isArray(data[k])) return;
            data[k].forEach(function (n) { if (n) names.push(String(n).toUpperCase()); });
          });
          start(names);
        })
        .catch(function () { start([]); });
    }
  }

  window.startSlideshow = startSlideshow;
  window.startRandomSlideshow = startRandomSlideshow;

  function ensureCardLightbox() {
    var lb = document.getElementById('pepe-lightbox');
    if (lb) return lb;
    lb = document.createElement('div');
    lb.id = 'pepe-lightbox';
    lb.className = 'pepe-lightbox';
    lb.setAttribute('aria-hidden', 'true');
    lb.innerHTML =
      '<div class="pepe-lightbox-backdrop"></div>' +
      '<button type="button" class="pepe-lightbox-close" aria-label="Close">&times;</button>' +
      '<div class="pepe-lightbox-wrap">' +
        '<img id="pepe-lightbox-img" class="pepe-lightbox-img" src="" alt="">' +
        '<a id="pepe-lightbox-open-tab" href="#" target="_blank" rel="noopener" class="pepe-lightbox-open-tab link-undecorated small">Open in new tab</a>' +
      '</div>';
    document.body.appendChild(lb);
    var backdrop = lb.querySelector('.pepe-lightbox-backdrop');
    var closeBtn = lb.querySelector('.pepe-lightbox-close');
    function closeLightbox() {
      lb.classList.remove('pepe-lightbox-open');
      lb.setAttribute('aria-hidden', 'true');
    }
    if (backdrop) backdrop.addEventListener('click', closeLightbox);
    if (closeBtn) closeBtn.addEventListener('click', closeLightbox);
    document.addEventListener('keydown', function onKey(e) {
      if (e.key === 'Escape' && lb.classList.contains('pepe-lightbox-open')) closeLightbox();
    });
    return lb;
  }

  function openCardLightbox(assetName, imgUrl) {
    var lb = ensureCardLightbox();
    var lbImg = document.getElementById('pepe-lightbox-img');
    var lbOpenTab = document.getElementById('pepe-lightbox-open-tab');
    if (lbImg) {
      lbImg.setAttribute('data-asset', assetName || '');
      lbImg.src = imgUrl || imageUrlFor(assetName) || '';
      lbImg.alt = assetName || '';
      lbImg.onerror = function () {
        if (typeof window.tryNextPepeExt === 'function') {
          window.tryNextPepeExt(lbImg);
        } else {
          lbImg.src = window.pepeImagePlaceholder || '';
        }
      };
    }
    if (lbOpenTab) {
      lbOpenTab.href = 'pepe.html?asset=' + encodeURIComponent(assetName || '');
      lbOpenTab.textContent = 'Open card page';
    }
    lb.setAttribute('aria-hidden', 'false');
    lb.classList.add('pepe-lightbox-open');
  }

  window.openCardLightbox = openCardLightbox;

  document.addEventListener('click', function (e) {
    var btn = e.target.closest('.pepe-card-zoom-btn');
    if (!btn) return;
    e.preventDefault();
    e.stopPropagation();
    var name = btn.getAttribute('data-asset');
    if (!name) return;
    var imgUrl = imageUrlFor(name) ||
      ('archive/pepes/' + (name || '').replace(/[^A-Za-z0-9._-]/g, '') + '.jpg');
    openCardLightbox(name, imgUrl);
  });
})();
