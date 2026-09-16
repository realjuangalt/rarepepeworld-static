/**
 * Full-screen slideshow for address/artist collections and full-catalog random mode.
 * startSlideshow(assetList, options?)
 *   options.durationMs — default 21000 (sequence) or 15000 (random)
 *   options.mode — 'sequence' | 'random'
 *   options.preload — how many slides to warm ahead (random default 3)
 *   options.history — how many prior slides to keep ready for back (random default 3)
 *   options.catalog — name[] for random mode (or load via RandomPepeCore)
 * startRandomSlideshow() — full Rare Pepe catalog, 15s, 3 ahead + 3 behind
 *
 * Auto-advance uses wall-clock setTimeout (not setInterval). Mobile Safari often
 * freezes intervals until a touch after idle/background; we also resume on
 * visibility/pageshow and hold a screen wake lock when available.
 */
(function () {
  'use strict';

  var DEFAULT_SEQUENCE_MS = 21000;
  var DEFAULT_RANDOM_MS = 15000;
  /** Keep ahead/behind queues small — full GIF pepe frames OOM phones if we warm too many. */
  var DEFAULT_RANDOM_PRELOAD = 3;
  var DEFAULT_RANDOM_HISTORY = 3;
  var READY_WAIT_MS = 5000;
  var READY_POLL_MS = 200;

  var screenWakeLock = null;

  function releaseWakeLock() {
    if (!screenWakeLock) return;
    var lock = screenWakeLock;
    screenWakeLock = null;
    try {
      lock.release();
    } catch (e) { /* ignore */ }
  }

  function requestWakeLock() {
    releaseWakeLock();
    if (!navigator.wakeLock || typeof navigator.wakeLock.request !== 'function') return;
    navigator.wakeLock.request('screen').then(function (lock) {
      screenWakeLock = lock;
      lock.addEventListener('release', function () {
        if (screenWakeLock === lock) screenWakeLock = null;
      });
    }).catch(function () { /* unsupported / denied */ });
  }

  /* Session memory: working image URLs so back/forward does not re-probe. Not the full ~1GB set. */
  var sessionUrlCache = Object.create(null);

  function cacheUrl(name, url) {
    if (!name || !url || String(url).indexOf('data:') === 0) return;
    sessionUrlCache[String(name).toUpperCase()] = url;
  }

  function cachedUrl(name) {
    if (!name) return '';
    return sessionUrlCache[String(name).toUpperCase()] || '';
  }

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
    var hit = cachedUrl(name);
    if (hit) return hit;
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

  /** Preload one pepe; probes extensions and marks ready when a file loads or all fail. */
  function makeSlideItem(name, imgUrl, onReady) {
    var url = imgUrl || cachedUrl(name) || imageUrlFor(name);
    var item = { name: name, imgUrl: url, ready: false, img: null };
    function markReady() {
      if (item.ready) return;
      item.ready = true;
      if (item.img && item.img.src && String(item.img.src).indexOf('data:') !== 0) {
        item.imgUrl = item.img.src;
        cacheUrl(name, item.imgUrl);
      }
      if (typeof window.rememberPepeImageExt === 'function' && item.img) {
        window.rememberPepeImageExt(item.img);
      }
      if (typeof onReady === 'function') onReady(item);
      if (typeof item.onReady === 'function') item.onReady(item);
    }
    if (url && typeof Image !== 'undefined') {
      item.img = new Image();
      item.img.setAttribute('data-asset', name || '');
      item.img.onload = markReady;
      item.img.onerror = function () {
        if (typeof window.tryNextPepeExt === 'function') {
          var before = item.img.src;
          window.tryNextPepeExt(item.img);
          if (!item.img.src || item.img.src === before || String(item.img.src).indexOf('data:') === 0) {
            markReady();
          }
          return;
        }
        markReady();
      };
      item.img.src = url;
    } else {
      markReady();
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
    var historyCount = options.history != null
      ? options.history
      : (mode === 'random' ? DEFAULT_RANDOM_HISTORY : 0);

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
      clearTimeout(window._addressSlideshowTimer);
      clearInterval(window._addressSlideshowTimer);
      window._addressSlideshowTimer = null;
    }
    if (window._addressSlideshowReadyWait) {
      clearInterval(window._addressSlideshowReadyWait);
      window._addressSlideshowReadyWait = null;
    }

    var overlay = ensureOverlay();
    var exitBtn = overlay.querySelector('.address-slideshow-exit');
    var img = overlay.querySelector('.address-slideshow-img');
    var caption = overlay.querySelector('.address-slideshow-caption');
    var index = 0;
    var fadeTimer = null;
    var readyWaitTimer = null;
    var nextAdvanceAt = 0;
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

    function clearReadyWait() {
      if (readyWaitTimer) {
        clearTimeout(readyWaitTimer);
        clearInterval(readyWaitTimer);
        readyWaitTimer = null;
      }
    }

    function clearAutoAdvance() {
      clearReadyWait();
      if (window._addressSlideshowTimer) {
        clearTimeout(window._addressSlideshowTimer);
        clearInterval(window._addressSlideshowTimer);
        window._addressSlideshowTimer = null;
      }
      nextAdvanceAt = 0;
    }

    function recentNames() {
      var names = [];
      if (current && current.name) names.push(current.name);
      past.forEach(function (p) { if (p && p.name) names.push(p.name); });
      future.forEach(function (f) { if (f && f.name) names.push(f.name); });
      return names;
    }

    function onPreloadReady() {
      fillFuture();
    }

    function fillFuture() {
      if (mode !== 'random') return;
      while (future.length < preloadCount && catalog.length) {
        var name = pickRandomName(catalog, recentNames());
        if (!name) break;
        future.push(makeSlideItem(name, null, onPreloadReady));
      }
    }

    /** Auto-advance: for random, wait briefly if the next image is still downloading. */
    function tickAdvance() {
      window._addressSlideshowTimer = null;
      nextAdvanceAt = 0;
      if (!overlay.classList.contains('address-slideshow-active')) return;
      if (mode !== 'random') {
        showSequenceSlide((index + 1) % sequence.length);
        startAutoAdvance();
        return;
      }
      fillFuture();
      if (future[0] && future[0].ready) {
        goNext();
        return;
      }
      clearReadyWait();
      var waitStarted = Date.now();
      function pollReady() {
        readyWaitTimer = null;
        if (!overlay.classList.contains('address-slideshow-active')) return;
        fillFuture();
        if ((future[0] && future[0].ready) || (Date.now() - waitStarted) >= READY_WAIT_MS) {
          goNext();
          return;
        }
        readyWaitTimer = setTimeout(pollReady, READY_POLL_MS);
      }
      readyWaitTimer = setTimeout(pollReady, READY_POLL_MS);
    }

    function startAutoAdvance() {
      clearAutoAdvance();
      if (!overlay.classList.contains('address-slideshow-active')) return;
      if (mode === 'sequence' && sequence.length <= 1) return;
      if (mode === 'random' && catalog.length <= 1) return;
      nextAdvanceAt = Date.now() + durationMs;
      window._addressSlideshowTimer = setTimeout(tickAdvance, durationMs);
    }

    /**
     * Safari/iOS often freezes timers until a touch after idle or background.
     * Wall-clock catch-up: if overdue, advance now; else re-arm the remaining delay.
     */
    function resumeAutoAdvance() {
      if (!overlay.classList.contains('address-slideshow-active')) return;
      if (mode === 'sequence' && sequence.length <= 1) return;
      if (mode === 'random' && catalog.length <= 1) return;
      requestWakeLock();
      /* Frozen ready-wait poll: finish the advance instead of sitting forever. */
      if (readyWaitTimer) {
        clearReadyWait();
        goNext();
        return;
      }
      if (!nextAdvanceAt) {
        startAutoAdvance();
        return;
      }
      var remaining = nextAdvanceAt - Date.now();
      if (remaining <= 50) {
        if (window._addressSlideshowTimer) {
          clearTimeout(window._addressSlideshowTimer);
          clearInterval(window._addressSlideshowTimer);
          window._addressSlideshowTimer = null;
        }
        tickAdvance();
        return;
      }
      if (window._addressSlideshowTimer) {
        clearTimeout(window._addressSlideshowTimer);
        clearInterval(window._addressSlideshowTimer);
      }
      window._addressSlideshowTimer = setTimeout(tickAdvance, remaining);
    }

    function trimFuture() {
      while (future.length > preloadCount) future.pop();
    }

    function trimPast() {
      while (past.length > historyCount) past.shift();
    }

    function syncItemFromDisplay(item) {
      if (!item) return;
      var src = img.currentSrc || img.src || '';
      if (!src || String(src).indexOf('data:') === 0) return;
      item.imgUrl = src;
      item.ready = true;
      if (item.img) item.img.src = src;
      cacheUrl(item.name, src);
      if (typeof window.rememberPepeImageExt === 'function') {
        window.rememberPepeImageExt(img);
      }
    }

    function paintSlide(item) {
      if (!item) return;
      current = item;
      var src = item.imgUrl || (item.img && item.img.src) || cachedUrl(item.name) || imageUrlFor(item.name) || (window.pepeImagePlaceholder || '');
      img.setAttribute('data-asset', item.name || '');
      img.alt = item.name || '';
      caption.textContent = item.name || '';
      img.onload = function () {
        syncItemFromDisplay(item);
      };
      img.onerror = function () {
        if (typeof window.tryNextPepeExt === 'function') {
          window.tryNextPepeExt(img);
        } else {
          img.src = window.pepeImagePlaceholder || '';
        }
      };
      /* Reuse known URL — browser/SW cache should hit; keep Image() refs in past/future. */
      if (img.src !== src) {
        img.src = src;
      } else {
        syncItemFromDisplay(item);
      }
      fillFuture();
    }

    function showSequenceSlide(i) {
      if (!sequence.length) return;
      if (i < 0 || i >= sequence.length) return;
      index = i;
      var a = sequence[index];
      paintSlide(makeSlideItem(a.name, a.imgUrl || cachedUrl(a.name)));
      if (preloadCount > 0 && index + 1 < sequence.length) {
        makeSlideItem(sequence[index + 1].name, sequence[index + 1].imgUrl);
      }
    }

    function goPrev() {
      if (mode === 'random') {
        if (!past.length) return;
        if (current) {
          future.unshift(current);
          trimFuture();
        }
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
          if (!name) {
            /* Never leave the show without a reschedule — empty pick is transient. */
            startAutoAdvance();
            return;
          }
          future.push(makeSlideItem(name, cachedUrl(name) || null, onPreloadReady));
        }
        if (current) {
          past.push(current);
          trimPast();
        }
        paintSlide(future.shift());
        fillFuture();
        startAutoAdvance();
        return;
      }
      if (index >= sequence.length - 1) {
        startAutoAdvance();
        return;
      }
      showSequenceSlide(index + 1);
      startAutoAdvance();
    }

    function stopSlideshow() {
      clearFadeTimer();
      clearAutoAdvance();
      releaseWakeLock();
      if (overlay._onVisResume) {
        document.removeEventListener('visibilitychange', overlay._onVisResume);
        window.removeEventListener('pageshow', overlay._onVisResume);
        window.removeEventListener('focus', overlay._onVisResume);
        overlay._onVisResume = null;
      }
      var doc = document;
      if (doc.fullscreenElement || doc.webkitFullscreenElement) {
        (doc.exitFullscreen || doc.webkitExitFullscreen).call(doc).catch(function () {});
      }
      overlay.classList.remove('address-slideshow-active');
      past = [];
      future = [];
      current = null;
    }

    function onVis() {
      if (document.visibilityState && document.visibilityState !== 'visible') return;
      resumeAutoAdvance();
    }

    /* Drop prior resume hooks if slideshow restarted without a clean stop. */
    if (overlay._onVisResume) {
      document.removeEventListener('visibilitychange', overlay._onVisResume);
      window.removeEventListener('pageshow', overlay._onVisResume);
      window.removeEventListener('focus', overlay._onVisResume);
    }
    overlay._onVisResume = onVis;

    overlay._showExit = showExit;
    overlay._stopSlideshow = stopSlideshow;
    overlay._goPrev = goPrev;
    overlay._goNext = goNext;
    overlay._resumeAutoAdvance = resumeAutoAdvance;

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
    document.addEventListener('visibilitychange', onVis);
    window.addEventListener('pageshow', onVis);
    window.addEventListener('focus', onVis);
    requestWakeLock();
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
