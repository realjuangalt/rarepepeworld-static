/**
 * Artist page — v1 match: grid of pepes issued by this address (from XChain issuances or asset list)
 * XChain has /api/issuances/{address},{asset},{block} - we can try asset empty or * for all
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

  function pepeImageUrl(name) {
    return (typeof window.pepeImageUrlFirst === 'function') ? window.pepeImageUrlFirst(name) : ('archive/pepes/' + (name || '').replace(/[^A-Za-z0-9._-]/g, '') + '.jpg');
  }

  function getCapDisplay(assetMetadata, assetName) {
    var meta = assetMetadata && assetMetadata[assetName];
    if (!meta) return '—';
    if (meta.issued != null && meta.issued !== '' && !meta.note) {
      var n = Number(meta.issued);
      return isNaN(n) ? '—' : 'Cap: ' + n.toLocaleString(undefined, { maximumFractionDigits: 0 });
    }
    if (meta.supply_cap != null && meta.supply_cap !== '') {
      var m = Number(meta.supply_cap);
      return isNaN(m) ? '—' : 'Cap: ' + m.toLocaleString(undefined, { maximumFractionDigits: 0 });
    }
    return '—';
  }

  function renderCard(asset, series, supplyStr, links) {
    var name = asset;
    var href = 'pepe.html?asset=' + encodeURIComponent(name);
    var imgUrl = pepeImageUrl(name);
    var line1 = series != null ? 'Series ' + series : '';
    var line2 = supplyStr || '—';
    return (
      '<div class="col p-3">' +
        '<div class="text-center" id="card_pepe_name"><span class="font-weight-bold"><a href="' + href + '" class="link-undecorated">' + escapeHtml(name) + '</a></span></div>' +
        '<div class="text-center" id="card-image">' +
          '<div class="pepe-card-slot">' +
            '<a href="' + href + '"><img class="card-image rounded" data-asset="' + escapeHtml(name) + '" src="' + imgUrl + '" alt="' + escapeHtml(name) + '" onerror="tryNextPepeExt(this)"></a>' +
          '</div>' +
        '</div>' +
        '<div class="sub-data text-center">' +
          '<button type="button" class="pepe-card-zoom-btn" aria-label="View full size" data-asset="' + escapeHtml(name) + '"><i class="fa fa-expand"></i></button>' +
          (line1 ? '<span id="card-line-1">' + escapeHtml(line1) + '</span>' : '') +
          (line2 ? ' | <span id="card-line-2">' + escapeHtml(line2) + '</span>' : '') +
        '</div>' +
      '</div>'
    );
  }

  function run() {
    var addr = getAddress();
    var heading = document.getElementById('card-list-heading');
    var row = document.getElementById('card-list-row');

    if (!addr) {
      heading.textContent = 'Artist';
      row.innerHTML = '<p class="col-12 text-muted">No address specified. Use ?address=ADDR</p>';
      return;
    }

    heading.textContent = 'Artist: ' + addr.slice(0, 8) + '…';

    fetch(API + '/issuances/' + encodeURIComponent(addr))
      .then(function (r) {
        if (!r.ok) throw new Error('Not found');
        return r.json();
      })
      .then(function (data) {
        var issuances = data.data || (Array.isArray(data) ? data : []);
        var assets = [];
        var seen = {};
        (issuances || []).forEach(function (i) {
          var rawName = i.asset || i.get_asset;
          var name = (rawName || '').toUpperCase();
          if (name && !seen[name]) { seen[name] = true; assets.push(name); }
        });
        if (!assets.length) {
          row.innerHTML = '<p class="col-12 text-muted">No issuances found.</p>';
          return;
        }
        return Promise.all([
          fetch(DATA_BASE + '/RarePepeDirectory_Series_Data.json').then(function (r) { return r.ok ? r.json() : {}; }).catch(function () { return {}; }),
          fetch(DATA_BASE + '/asset_metadata.json').then(function (r) { return r.ok ? r.json() : {}; }).catch(function () { return {}; })
        ]).then(function (results) {
          var seriesData = results[0];
          var assetMetadata = results[1] || {};
          var seriesMap = {};
          if (seriesData && typeof seriesData === 'object') {
            Object.keys(seriesData).forEach(function (num) {
              (seriesData[num] || []).forEach(function (n) { seriesMap[n] = num; });
            });
          }
          // Filter to assets that are actually Rare Pepes in our catalog.
          var rareAssets = assets.filter(function (name) { return !!assetMetadata[name]; });
          if (!rareAssets.length) {
            row.innerHTML = '<p class="col-12 text-muted">This address has no issued Rare Pepe assets.</p>';
            return;
          }
          var cards = rareAssets.map(function (name) {
            var meta = assetMetadata[name] || {};
            var series = meta.series != null && meta.series !== '' ? meta.series : (seriesMap[name] || '—');
            var capStr = getCapDisplay(assetMetadata, name);
            return renderCard(name, series, capStr !== '—' ? capStr : '—', {});
          });
          row.innerHTML = cards.join('');
          var slideshowBtn = document.getElementById('address-slideshow-btn');
          if (slideshowBtn && rareAssets.length) {
            slideshowBtn.classList.remove('d-none');
            var slideshowList = rareAssets.map(function (name) {
              return { name: name, imgUrl: pepeImageUrl(name) };
            });
            slideshowBtn.onclick = function () { window.startSlideshow(slideshowList); };
          }
        });
      })
      .catch(function (err) {
        if (typeof window.rpwWarn === 'function') {
          window.rpwWarn('artist.js: issuances fetch failed', { address: addr, error: String(err && err.message || err) });
        }
        row.innerHTML = '<p class="col-12 text-muted">Could not load artist. <a href="' + TOKENSCAN + '/address/' + encodeURIComponent(addr) + '">View on TokenScan</a></p>';
      });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', run);
  else run();
})();
