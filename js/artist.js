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
    var safe = (name || '').replace(/[^A-Za-z0-9._-]/g, '');
    return safe ? 'archive/pepes/' + safe + '.jpg' : '';
  }

  function placeholderImg() {
    return 'data:image/svg+xml,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200" viewBox="0 0 200 200"><rect fill="#e9ecef" width="200" height="200"/><text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle" fill="#6c757d">?</text></svg>');
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
          '<a href="' + href + '"><img class="card-image rounded" src="' + imgUrl + '" height="210" alt="' + escapeHtml(name) + '" onerror="this.src=\'' + placeholderImg() + '\'"></a>' +
        '</div>' +
        '<div class="sub-data text-center">' +
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
          var name = i.asset || i.get_asset;
          if (name && !seen[name]) { seen[name] = true; assets.push(name); }
        });
        if (!assets.length) {
          row.innerHTML = '<p class="col-12 text-muted">No issuances found.</p>';
          return;
        }
        return fetch(DATA_BASE + '/RarePepeDirectory_Series_Data.json').then(function (r) { return r.ok ? r.json() : {}; }).catch(function () { return {}; }).then(function (seriesData) {
          var seriesMap = {};
          if (seriesData && typeof seriesData === 'object') {
            Object.keys(seriesData).forEach(function (num) {
              (seriesData[num] || []).forEach(function (n) { seriesMap[n] = num; });
            });
          }
          var cards = assets.map(function (name) {
            return renderCard(name, seriesMap[name] || '—', 'Supply: —', {});
          });
          row.innerHTML = cards.join('');
        });
      })
      .catch(function () {
        row.innerHTML = '<p class="col-12 text-muted">Could not load artist. <a href="' + TOKENSCAN + '/address/' + encodeURIComponent(addr) + '">View on TokenScan</a></p>';
      });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', run);
  else run();
})();
