/**
 * Full-screen slideshow for address and artist pages. Expects assetList items
 * with .name and optional .imgUrl. Exposes window.startSlideshow(assetList).
 */
(function () {
  'use strict';

  var SLIDESHOW_DURATION_MS = 21000;

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

  function startSlideshow(assetList) {
    if (!assetList || !assetList.length) return;
    if (window._addressSlideshowTimer) {
      clearInterval(window._addressSlideshowTimer);
      window._addressSlideshowTimer = null;
    }
    var overlay = document.getElementById('address-slideshow-overlay');
    if (!overlay) {
      overlay = document.createElement('div');
      overlay.id = 'address-slideshow-overlay';
      overlay.className = 'address-slideshow-overlay';
      overlay.innerHTML =
        '<button type="button" class="address-slideshow-exit" aria-label="Exit slideshow"><i class="fa fa-times"></i></button>' +
        '<div class="address-slideshow-img-wrap"><img class="address-slideshow-img" src="" alt=""></div>' +
        '<div class="address-slideshow-caption"></div>';
      document.body.appendChild(overlay);

      overlay.querySelector('.address-slideshow-exit').addEventListener('click', function (e) { e.stopPropagation(); if (overlay._stopSlideshow) overlay._stopSlideshow(); });
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
        if (e.key === 'Escape' && overlay.classList.contains('address-slideshow-active') && overlay._stopSlideshow) overlay._stopSlideshow();
      });
      document.addEventListener('fullscreenchange', onFullscreenChange);
      document.addEventListener('webkitfullscreenchange', onFullscreenChange);
    }

    var exitBtn = overlay.querySelector('.address-slideshow-exit');
    var img = overlay.querySelector('.address-slideshow-img');
    var caption = overlay.querySelector('.address-slideshow-caption');
    var index = 0;
    var fadeTimer = null;
    var FADE_DELAY_MS = 3000;

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
      if (assetList.length <= 1) return;
      window._addressSlideshowTimer = setInterval(function () {
        var nextIndex = (index + 1) % assetList.length;
        showSlide(nextIndex);
      }, SLIDESHOW_DURATION_MS);
    }

    function onFullscreenChange() {
      var inFs = !!(document.fullscreenElement || document.webkitFullscreenElement);
      if (!inFs && overlay.classList.contains('address-slideshow-active') && overlay._stopSlideshow) {
        overlay._stopSlideshow();
      }
    }

    function showSlide(i) {
      if (!assetList.length) return;
      if (i < 0 || i >= assetList.length) return;
      index = i;
      var a = assetList[index];
      if (!a) return;
      img.setAttribute('data-asset', a.name || '');
      img.src = a.imgUrl || (typeof window.pepeImageUrlFirst === 'function' ? window.pepeImageUrlFirst(a.name) : '') || (window.pepeImagePlaceholder || '');
      img.alt = a.name || '';
      caption.textContent = a.name || '';
      img.onerror = function () { (typeof window.tryNextPepeExt === 'function' ? window.tryNextPepeExt(img) : (img.src = window.pepeImagePlaceholder || '')); };
    }

    function goPrev() {
      if (index <= 0) return;
      showSlide(index - 1);
      startAutoAdvance();
    }

    function goNext() {
      if (index >= assetList.length - 1) return;
      showSlide(index + 1);
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
    }

    overlay._showExit = showExit;
    overlay._stopSlideshow = stopSlideshow;
    overlay._goPrev = goPrev;
    overlay._goNext = goNext;

    showSlide(0);
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

  window.startSlideshow = startSlideshow;

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
    var lbImg = lb.querySelector('#pepe-lightbox-img');
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
      lbImg.src = imgUrl || (typeof window.pepeImageUrlFirst === 'function' ? window.pepeImageUrlFirst(assetName) : '') || '';
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
    var imgUrl = (typeof window.pepeImageUrlFirst === 'function' && window.pepeImageUrlFirst(name)) ||
      ('archive/pepes/' + (name || '').replace(/[^A-Za-z0-9._-]/g, '') + '.jpg');
    openCardLightbox(name, imgUrl);
  });
})();
