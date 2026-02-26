/**
 * Search page — v1 match: card grid, "no Pepes here" when no results
 */
(function () {
  'use strict';

  var DATA_BASE = 'data';
  var ADDRESS_REGEX = /^([13]|bc1)[A-HJ-NP-Za-km-z1-9]{27,34}$/;

  function getQuery() {
    var p = new URLSearchParams(window.location.search);
    return (p.get('q') || '').trim();
  }
  function getQueryUpper() {
    return getQuery().toUpperCase();
  }

  function escapeHtml(s) {
    if (!s) return ''; var d = document.createElement('div'); d.textContent = s; return d.innerHTML;
  }

  function pepeImageUrl(name) {
    return (typeof window.pepeImageUrlFirst === 'function') ? window.pepeImageUrlFirst(name) : ('archive/pepes/' + (name || '').replace(/[^A-Za-z0-9._-]/g, '') + '.jpg');
  }

  function flattenSeries(seriesData) {
    var list = [];
    if (!seriesData || typeof seriesData !== 'object') return list;
    Object.keys(seriesData).forEach(function (num) {
      (seriesData[num] || []).forEach(function (name) {
        list.push({ name: name, series: parseInt(num, 10) || 0 });
      });
    });
    return list;
  }

  function getCapDisplay(supplyData, assetMetadata, assetName) {
    var entry = supplyData && supplyData[assetName];
    if (entry && entry.issued != null && entry.issued !== '' && !entry.note) {
      var n = Number(entry.issued);
      return isNaN(n) ? '—' : 'Cap: ' + n.toLocaleString(undefined, { maximumFractionDigits: 0 });
    }
    var meta = assetMetadata && assetMetadata[assetName];
    if (meta && meta.supply_cap != null && meta.supply_cap !== '') {
      var m = Number(meta.supply_cap);
      return isNaN(m) ? '—' : 'Cap: ' + m.toLocaleString(undefined, { maximumFractionDigits: 0 });
    }
    return '—';
  }

  function renderCard(asset, links, capStr) {
    var name = asset.name;
    var series = asset.series;
    var href = 'pepe.html?asset=' + encodeURIComponent(name);
    var imgUrl = pepeImageUrl(name);
    var line2 = (capStr != null && capStr !== '') ? capStr : '—';
    return (
      '<div class="col p-3">' +
        '<div class="text-center" id="card_pepe_name"><span class="font-weight-bold">' + escapeHtml(name) + '</span></div>' +
        '<div class="text-center" id="card-image">' +
          '<div class="pepe-card-slot">' +
            '<a href="' + href + '" class="link-undecorated"><img class="card-image rounded" data-asset="' + escapeHtml(name) + '" src="' + imgUrl + '" alt="' + escapeHtml(name) + '" onerror="tryNextPepeExt(this)"></a>' +
          '</div>' +
        '</div>' +
        '<div class="sub-data text-center">' +
          (series ? '<span id="card-line-1">Series ' + series + '</span>' : '') +
          ' | <span id="card-line-2">' + escapeHtml(line2) + '</span>' +
        '</div>' +
      '</div>'
    );
  }

  function init() {
    var qRaw = getQuery();
    var q = qRaw.toUpperCase();
    var searchInput = document.getElementById('search-input');
    if (searchInput) searchInput.value = qRaw;

    var heading = document.getElementById('card-list-heading');
    var row = document.getElementById('card-list-row');
    var noResults = document.getElementById('search-no-results');

    heading.textContent = qRaw ? ('Search: ' + escapeHtml(qRaw)) : 'Search';
    noResults.classList.add('d-none');

    if (!qRaw) {
      row.innerHTML = '<p class="col-12 text-muted">Enter a pepe name or address above.</p>';
      return;
    }

    if (ADDRESS_REGEX.test(qRaw)) {
      window.location.href = 'address.html?address=' + encodeURIComponent(qRaw);
      return;
    }

    fetch(DATA_BASE + '/RarePepeDirectory_Series_Data.json')
      .then(function (r) { return r.ok ? r.json() : {}; })
      .then(function (seriesData) {
        var all = flattenSeries(seriesData);
        var exact = all.find(function (a) { return a.name === q; });
        if (exact) {
          window.location.href = 'pepe.html?asset=' + encodeURIComponent(q);
          return;
        }
        var matches = all.filter(function (a) { return a.name.indexOf(q) !== -1; });
        if (matches.length === 0) {
          row.innerHTML = '';
          noResults.classList.remove('d-none');
          return;
        }
        noResults.classList.add('d-none');
        return Promise.all([
          fetch(DATA_BASE + '/RarePepeDirectory_Links.json').then(function (r) { return r.ok ? r.json() : {}; }).catch(function () { return {}; }),
          fetch(DATA_BASE + '/rarepepe-supply.json').then(function (r) { return r.ok ? r.json() : {}; }).catch(function () { return {}; }),
          fetch(DATA_BASE + '/asset_metadata.json').then(function (r) { return r.ok ? r.json() : {}; }).catch(function () { return {}; })
        ]).then(function (results) {
          var links = results[0];
          var supplyData = results[1] || {};
          var assetMetadata = results[2] || {};
          row.innerHTML = matches.map(function (asset) {
            var capStr = getCapDisplay(supplyData, assetMetadata, asset.name);
            return renderCard(asset, links, capStr);
          }).join('');
        });
      })
      .catch(function (err) {
        if (typeof window.rpwWarn === 'function') {
          window.rpwWarn('search.js: data fetch failed', { error: String(err && err.message || err) });
        }
        row.innerHTML = '<p class="col-12 text-muted">Could not load data.</p>';
      });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
