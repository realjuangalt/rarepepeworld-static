/**
 * Random Pepes section: card markup, 3D spin, and shuffle-with-delayed-content-update.
 * All logic for this effect lives here so changes elsewhere don’t break it.
 * Deps (get, getCapDisplay, etc.) are passed at init from app.js.
 */
(function () {
  'use strict';

  var deps = null;

  // Three-phase spin (see css/random-pepe-cards.css).
  // Phase A: 0deg → 90deg  (old front rotates out)
  // Phase B: 90deg → 270deg (back visible)
  // Phase C: 270deg → 360deg (new front rotates in; we swap here).
  var PHASE_A_MS = 750;
  var PHASE_B_MS = 1500;
  var PHASE_C_MS = 750;

  function renderGridCard(asset, links, supplyStr, payStr) {
    if (!deps) return '';
    var name = asset.name || asset;
    var series = asset.series != null ? asset.series : '';
    var href = 'pepe.html?asset=' + encodeURIComponent(name);
    var imgUrl = deps.pepeImageUrl(name);
    var line1 = payStr != null ? payStr : ('Series ' + series);
    var line2 = (supplyStr != null && supplyStr !== '—') ? supplyStr : '—';
    return (
      '<div class="col col-md-2 random-pepe-card">' +
        '<div class="text-center" id="card_pepe_name">' +
          '<span class="font-weight-bold"><a class="link-undecorated" href="' + href + '">' + deps.escapeHtml(name) + '</a></span>' +
        '</div>' +
        '<div class="text-center" id="card-image">' +
          '<div class="pepe-card-slot">' +
            '<div class="pepe-card-inner">' +
              '<div class="pepe-card-face pepe-card-front">' +
                '<a class="link-undecorated" href="' + href + '">' +
                  '<img class="card-image rounded" data-asset="' + deps.escapeHtml(name) + '" src="' + imgUrl + '" alt="' + deps.escapeHtml(name) + '" onerror="tryNextPepeExt(this)">' +
                '</a>' +
              '</div>' +
              '<div class="pepe-card-face pepe-card-back">' +
                '<img class="card-image rounded" src="images/PUMPURPEPE.png" alt="PUMPURPEPE">' +
              '</div>' +
            '</div>' +
          '</div>' +
        '</div>' +
        '<div class="sub-data text-center">' +
          '<span id="card-line-1"><a class="link-undecorated" href="' + href + '">' + deps.escapeHtml(line1) + '</a></span>' +
          ' | <span id="card-line-2"><a class="link-undecorated" href="' + href + '">' + deps.escapeHtml(line2) + '</a></span>' +
        '</div>' +
        '<p></p>' +
      '</div>'
    );
  }

  function updateOneCardContent(cardEl, asset, capStr) {
    if (!deps) return;
    var name = asset.name || asset;
    var series = asset.series != null ? asset.series : '—';
    var href = 'pepe.html?asset=' + encodeURIComponent(name);
    var imgUrl = deps.pepeImageUrl(name);
    var line1 = 'Series ' + series;
    var line2 = (capStr != null && capStr !== '—') ? capStr : '—';
    var nameLink = cardEl.querySelector('.font-weight-bold a');
    if (nameLink) {
      nameLink.textContent = name;
      nameLink.href = href;
    }
    var frontImg = cardEl.querySelector('.pepe-card-front img.card-image');
    if (frontImg) {
      frontImg.src = imgUrl;
      frontImg.dataset.asset = name;
      frontImg.alt = name;
    }
    var frontLink = cardEl.querySelector('.pepe-card-front a');
    if (frontLink) frontLink.href = href;
    var subData = cardEl.querySelector('.sub-data');
    if (subData) {
      var linkEls = subData.querySelectorAll('a');
      if (linkEls[0]) { linkEls[0].href = href; linkEls[0].textContent = line1; }
      if (linkEls[1]) { linkEls[1].href = href; linkEls[1].textContent = line2; }
    }
  }

  function preloadImagesForAssets(cardData, done) {
    if (!cardData || !cardData.length) {
      done();
      return;
    }
    var remaining = cardData.length;
    var called = false;
    function finish() {
      if (called) return;
      called = true;
      done();
    }
    cardData.forEach(function (item) {
      var name = item.name || (item.asset && (item.asset.name || item.asset)) || '';
      var url = deps.pepeImageUrl(name);
      var img = new Image();
      img.onload = img.onerror = function () {
        remaining -= 1;
        if (remaining <= 0) finish();
      };
      img.src = url;
    });
    // Safety timeout in case some onload/onerror never fires
    setTimeout(finish, PHASE_A_MS + PHASE_B_MS + 200);
  }

  function shuffleRandomPepes(randomRowEl, animate) {
    if (!deps || !randomRowEl) return;
    var cards = randomRowEl.querySelectorAll('.random-pepe-card');
    if (cards.length === 0) return;

    var dataBase = deps.DATA_BASE || 'data';
    Promise.all([
      deps.get(dataBase + '/RarePepeDirectory_Series_Data.json').catch(function () { return {}; }),
      deps.get(dataBase + '/asset_metadata.json').catch(function () { return {}; })
    ]).then(function (results) {
      var seriesData = results[0];
      var assetMetadata = results[1] || {};
      var all = deps.flattenSeries(seriesData);
      if (!all.length) return;
      var random = deps.randomSample(all, 6);

      var cardData = [];
      for (var i = 0; i < random.length; i++) {
        var asset = random[i];
        var name = asset.name || asset;
        var capStr = deps.getCapDisplay(assetMetadata, name);
        cardData.push({ asset: asset, name: name, capStr: capStr });
      }

      function applyInstant() {
        for (var i = 0; i < cards.length && i < cardData.length; i++) {
          updateOneCardContent(cards[i], cardData[i].asset, cardData[i].capStr);
        }
      }

      if (!animate) {
        applyInstant();
        return;
      }

      preloadImagesForAssets(cardData, function () {
        for (var i = 0; i < cards.length && i < cardData.length; i++) {
          (function (cardEl, data) {
            var inner = cardEl.querySelector('.pepe-card-inner');
            if (!inner) return;

            // Phase A: 0deg → 90deg (old front rotates out)
            inner.classList.add('random-pepe-spin-a');
            var onAEnd = function () {
              inner.removeEventListener('animationend', onAEnd);
              inner.classList.remove('random-pepe-spin-a');

              // Phase B: 90deg → 270deg (back visible)
              inner.classList.add('random-pepe-spin-b');
              var onBEnd = function () {
                inner.removeEventListener('animationend', onBEnd);
                inner.classList.remove('random-pepe-spin-b');

                // At 270deg (edge-on again): swap to new content while invisible.
                updateOneCardContent(cardEl, data.asset, data.capStr);

                // Phase C: 270deg → 360deg (new front rotates in)
                inner.classList.add('random-pepe-spin-c');
                var onCEnd = function () {
                  inner.removeEventListener('animationend', onCEnd);
                  inner.classList.remove('random-pepe-spin-c');
                };
                inner.addEventListener('animationend', onCEnd);
              };
              inner.addEventListener('animationend', onBEnd);
            };
            inner.addEventListener('animationend', onAEnd);
          })(cards[i], cardData[i]);
        }
      });
    }).catch(function (err) {
      if (typeof window.rpwWarn === 'function') {
        window.rpwWarn('Index: shuffle failed', { error: String(err && err.message || err), url: window.location.href });
      }
      console.error('[RandomPepeCards]', err);
    });
  }

  /**
   * Returns HTML for the initial 6 random cards. Call from app after data is loaded.
   */
  function renderInitialRow(seriesData, assetMetadata, links) {
    if (!deps) return '';
    var all = deps.flattenSeries(seriesData);
    if (!all.length) return '';
    var random = deps.randomSample(all, 6);
    return random.map(function (a) {
      var name = a.name || a;
      var capStr = deps.getCapDisplay(assetMetadata, name);
      return renderGridCard(a, links || {}, capStr, 'Series ' + (a.series || '—'));
    }).join('');
  }

  /**
   * Wire the shuffle button and store deps. Call once from app.js after DOM ready.
   * @param {HTMLElement} randomRowEl - #latest-dispensers-section-row
   * @param {HTMLElement} shuffleHeadingEl - #latest-dispensers-section-heading
   * @param {Object} dependencies - { get, flattenSeries, randomSample, getCapDisplay, pepeImageUrl, escapeHtml, DATA_BASE }
   */
  function init(randomRowEl, shuffleHeadingEl, dependencies) {
    deps = dependencies;
    if (!shuffleHeadingEl) return;
    shuffleHeadingEl.classList.add('random-shuffle-heading');
    shuffleHeadingEl.textContent = '🎲 Random Pepes';
    shuffleHeadingEl.setAttribute('role', 'button');
    shuffleHeadingEl.setAttribute('tabindex', '0');
    var trigger = function (e) {
      if (e && e.type === 'keydown' && e.key !== 'Enter' && e.key !== ' ') return;
      if (e) e.preventDefault();
      shuffleRandomPepes(randomRowEl, true);
    };
    shuffleHeadingEl.addEventListener('click', trigger);
    shuffleHeadingEl.addEventListener('keydown', trigger);
  }

  window.RandomPepeCards = {
    init: init,
    renderInitialRow: renderInitialRow,
    renderGridCard: renderGridCard,
    shuffle: shuffleRandomPepes,
    RANDOM_SPIN_DURATION_MS: PHASE_A_MS + PHASE_B_MS + PHASE_C_MS,
    RANDOM_CONTENT_UPDATE_DELAY_MS: PHASE_A_MS + PHASE_B_MS
  };
})();
