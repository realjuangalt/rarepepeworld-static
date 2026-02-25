/**
 * Address page — holdings from API (Owns X of Y); Y = minted supply from data/rarepepe-supply.json.
 * Only "legible" Rare Pepe assets (named, not numeric IDs) are shown in the grid.
 */
(function () {
  'use strict';

  var API = 'https://tokenscan.io/api';
  var TOKENSCAN = 'https://tokenscan.io';
  var DATA_BASE = 'data';

  function getAddress() {
    var p = new URLSearchParams(window.location.search);
    return (p.get('address') || '').trim();
  }

  function escapeHtml(s) {
    if (!s) return ''; var d = document.createElement('div'); d.textContent = s; return d.innerHTML;
  }

  /** Official Rare Pepes have legible names; numeric IDs like A14439212225401773150 are not. */
  function isLegibleRarePepe(name) {
    if (!name || typeof name !== 'string') return false;
    var n = name.trim();
    if (n.length < 2) return false;
    if (/^A\d{10,}$/.test(n)) return false;
    if (/^\d+$/.test(n)) return false;
    return true;
  }

  function pepeImageUrl(name) {
    var safe = (name || '').replace(/[^A-Za-z0-9._-]/g, '');
    return safe ? 'archive/pepes/' + safe + '.jpg' : '';
  }

  function placeholderImg() {
    return 'data:image/svg+xml,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200" viewBox="0 0 200 200"><rect fill="#e9ecef" width="200" height="200"/><text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle" fill="#6c757d">?</text></svg>');
  }

  function formatSupply(supplyStr) {
    if (!supplyStr) return '—';
    var n = parseFloat(supplyStr);
    if (isNaN(n)) return supplyStr;
    return n >= 1e9 ? n.toLocaleString(undefined, { maximumFractionDigits: 0 }) : n.toLocaleString(undefined, { maximumFractionDigits: 4 });
  }

  /** Support both legacy { ASSET: "100" } and new { ASSET: { circulating, issued } } format. */
  function getSupplyDisplay(supplyMap, assetName) {
    var v = supplyMap[assetName];
    if (v == null) return null;
    if (typeof v === 'string') return v;
    if (v && typeof v === 'object') {
      if (v.circulating != null && v.circulating !== '') return String(v.circulating);
      if (v.issued != null && v.issued !== '') return String(v.issued);
    }
    return null;
  }

  function renderCard(asset, qtyStr, supplyStr, links) {
    var name = asset;
    var href = 'pepe.html?asset=' + encodeURIComponent(name);
    var imgUrl = pepeImageUrl(name);
    var supplyDisplay = formatSupply(supplyStr);
    var line1 = 'Owns ' + qtyStr + ' of ' + supplyDisplay;
    return (
      '<div class="col p-3">' +
        '<div class="text-center" id="card_pepe_name"><span class="font-weight-bold">' + escapeHtml(name) + '</span></div>' +
        '<div class="text-center" id="card-image">' +
          '<a href="' + href + '" class="link-undecorated"><img class="card-image rounded" src="' + imgUrl + '" height="210" alt="' + escapeHtml(name) + '" onerror="this.src=\'' + placeholderImg() + '\'"></a>' +
        '</div>' +
        '<div class="sub-data text-center"><span id="card-line-1">' + escapeHtml(line1) + '</span></div>' +
      '</div>'
    );
  }

  var SLIDESHOW_DURATION_MS = 21000; // 21 seconds per asset

  function startSlideshow(assetList) {
    if (!assetList || !assetList.length) return;
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

      overlay.querySelector('.address-slideshow-exit').addEventListener('click', function () { stopSlideshow(); });
      document.addEventListener('keydown', function onKey(e) {
        if (e.key === 'Escape' && overlay.classList.contains('address-slideshow-active')) stopSlideshow();
      });
    }

    var img = overlay.querySelector('.address-slideshow-img');
    var caption = overlay.querySelector('.address-slideshow-caption');
    var index = 0;

    function showSlide(i) {
      index = (i + assetList.length) % assetList.length;
      var a = assetList[index];
      img.src = a.imgUrl || placeholderImg();
      img.alt = a.name;
      caption.textContent = a.name;
      img.onerror = function () { this.src = placeholderImg(); };
    }

    function stopSlideshow() {
      overlay.classList.remove('address-slideshow-active');
      if (window._addressSlideshowTimer) {
        clearInterval(window._addressSlideshowTimer);
        window._addressSlideshowTimer = null;
      }
    }

    showSlide(0);
    overlay.classList.add('address-slideshow-active');
    window._addressSlideshowTimer = setInterval(function () {
      showSlide(index + 1);
    }, SLIDESHOW_DURATION_MS);
  }

  function run() {
    var addr = getAddress();
    var heading = document.getElementById('card-list-heading');
    var row = document.getElementById('card-list-row');
    var slideshowBtn = document.getElementById('address-slideshow-btn');

    if (!addr) {
      heading.textContent = 'Address';
      row.innerHTML = '<p class="col-12 text-muted">No address specified. Use ?address=ADDR</p>';
      return;
    }

    heading.textContent = addr.slice(0, 10) + '…' + addr.slice(-8);
    row.innerHTML = '<p class="col-12 text-muted">Loading holdings from TokenScan…</p>';

    fetch(API + '/balances/' + encodeURIComponent(addr))
      .then(function (r) {
        if (!r.ok) throw new Error('API ' + r.status);
        return r.json();
      })
      .then(function (data) {
        var assets = data.data || data.assets || (Array.isArray(data) ? data : []);
        if (!Array.isArray(assets) || !assets.length) {
          row.innerHTML = '<p class="col-12 text-muted">No balances for this address.</p>';
          return;
        }
        var supplyPromise = fetch(DATA_BASE + '/rarepepe-supply.json').then(function (r) { return r.ok ? r.json() : {}; }).catch(function () { return {}; });
        var linksPromise = fetch(DATA_BASE + '/RarePepeDirectory_Links.json').then(function (r) { return r.ok ? r.json() : {}; }).catch(function () { return {}; });
        return Promise.all([supplyPromise, linksPromise]).then(function (results) {
          var supplyMap = results[0] || {};
          var links = results[1] || {};
          var legible = [];
          var otherCount = 0;
          assets.forEach(function (a) {
            var name = a.asset || a.name || '—';
            if (!isLegibleRarePepe(name)) {
              otherCount++;
              return;
            }
            var qty = a.quantity != null ? a.quantity : '0';
            var div = a.divisible;
            if (div) qty = (parseFloat(qty) * 1e8).toFixed(0);
            var qtyStr = Number(qty).toLocaleString();
            var supplyStr = getSupplyDisplay(supplyMap, name);
            legible.push({ name: name, qtyStr: qtyStr, supplyStr: supplyStr, imgUrl: pepeImageUrl(name) });
          });
          var cards = legible.map(function (a) {
            return renderCard(a.name, a.qtyStr, a.supplyStr, links);
          });
          row.innerHTML = cards.join('');
          if (otherCount > 0) {
            row.innerHTML +=
              '<div class="col-12 mt-2 mb-2">' +
              '<p class="text-muted small mb-0">Also holds ' + otherCount + ' other asset' + (otherCount !== 1 ? 's' : '') + ' (numeric or non–Rare Pepe). ' +
              '<a href="' + TOKENSCAN + '/address/' + encodeURIComponent(addr) + '" target="_blank" rel="noopener">View all on TokenScan <i class="fa fa-external-link"></i></a></p>' +
              '</div>';
          }
          if (slideshowBtn && legible.length) {
            slideshowBtn.classList.remove('d-none');
            slideshowBtn.onclick = function () { startSlideshow(legible); };
          }
        });
      })
      .catch(function (err) {
        row.innerHTML =
          '<p class="col-12 text-muted">Could not load holdings from the API. ' +
          '<a href="' + TOKENSCAN + '/address/' + encodeURIComponent(addr) + '">View this address on TokenScan</a> to see balances.</p>' +
          '<p class="col-12 small text-muted">If you opened this page from file:// or another origin, the API may block the request (CORS). Try serving the site from a local server or the same domain as the API.</p>';
      });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', run);
  else run();
})();
