/**
 * Rare Pepe World v2 — Index: Featured Pepes + Random Pepes (match v1 layout)
 */
(function () {
  'use strict';

  const DATA_BASE = 'data';
  const API_BASE = 'https://tokenscan.io/api';

  function get(url) {
    return fetch(url).then(function (res) {
      if (!res.ok) throw new Error(res.statusText);
      return res.json();
    });
  }

  function pepeImageUrl(assetName) {
    return (typeof window.pepeImageUrlFirst === 'function') ? window.pepeImageUrlFirst(assetName) : ('archive/pepes/' + (assetName || '').replace(/[^A-Za-z0-9._-]/g, '') + '.jpg');
  }

  function placeholderImage() {
    return 'data:image/svg+xml,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200" viewBox="0 0 200 200"><rect fill="#e9ecef" width="200" height="200"/><text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle" fill="#6c757d" font-size="14">Pepe</text></svg>');
  }

  function escapeHtml(s) {
    if (!s) return '';
    var div = document.createElement('div');
    div.textContent = s;
    return div.innerHTML;
  }

  function flattenSeries(seriesData) {
    var list = [];
    if (!seriesData || typeof seriesData !== 'object') return list;
    Object.keys(seriesData).forEach(function (seriesNum) {
      var names = seriesData[seriesNum];
      if (Array.isArray(names)) {
        names.forEach(function (name) {
          list.push({ name: name, series: parseInt(seriesNum, 10) || 0 });
        });
      }
    });
    return list;
  }

  function randomSample(arr, n) {
    var copy = arr.slice();
    for (var i = copy.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var t = copy[i]; copy[i] = copy[j]; copy[j] = t;
    }
    return copy.slice(0, n);
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

  /** Featured: same image slot/card structure as Random so images load identically (400×560 card ratio) */
  function renderFeaturedCard(asset, links) {
    var name = asset.name || asset;
    var href = 'pepe.html?asset=' + encodeURIComponent(name);
    var imgUrl = pepeImageUrl(name);
    return (
      '<div class="col">' +
        '<div class="featured-pepe-slot">' +
          '<div class="pepe-card-slot">' +
            '<a href="' + href + '" class="link-undecorated">' +
              '<img class="card-image rounded" data-asset="' + escapeHtml(name) + '" src="' + imgUrl + '" alt="' + escapeHtml(name) + '" onerror="tryNextPepeExt(this)">' +
            '</a>' +
          '</div>' +
        '</div>' +
      '</div>'
    );
  }

  /** Random Pepes grid: col-md-2, name, image 150, sub-data pay | stock/supply — v1 style */
  function renderGridCard(asset, links, supplyStr, payStr) {
    var name = asset.name || asset;
    var series = asset.series != null ? asset.series : '';
    var href = 'pepe.html?asset=' + encodeURIComponent(name);
    var imgUrl = pepeImageUrl(name);
    var line1 = payStr != null ? payStr : ('Series ' + series);
    var line2 = supplyStr != null ? supplyStr : (series ? 'Series ' + series : '—');
    return (
      '<div class="col col-md-2">' +
        '<div class="text-center" id="card_pepe_name">' +
          '<span class="font-weight-bold"><a class="link-undecorated" href="' + href + '">' + escapeHtml(name) + '</a></span>' +
        '</div>' +
        '<div class="text-center" id="card-image">' +
          '<div class="pepe-card-slot">' +
            '<a class="link-undecorated" href="' + href + '">' +
              '<img class="card-image rounded" data-asset="' + escapeHtml(name) + '" src="' + imgUrl + '" alt="' + escapeHtml(name) + '" onerror="tryNextPepeExt(this)">' +
            '</a>' +
          '</div>' +
        '</div>' +
        '<div class="sub-data text-center">' +
          '<span id="card-line-1"><a class="link-undecorated" href="' + href + '">' + escapeHtml(line1) + '</a></span>' +
          ' | <span id="card-line-2"><a class="link-undecorated" href="' + href + '">' + escapeHtml(line2) + '</a></span>' +
        '</div>' +
        '<p></p>' +
      '</div>'
    );
  }

  function init() {
    Promise.all([
      get(DATA_BASE + '/RarePepeDirectory_Series_Data.json').catch(function () { return {}; }),
      get(DATA_BASE + '/RarePepeDirectory_Links.json').catch(function () { return {}; }),
      get(DATA_BASE + '/rarepepe-supply.json').catch(function () { return {}; }),
      get(DATA_BASE + '/asset_metadata.json').catch(function () { return {}; })
    ]).then(function (results) {
      var seriesData = results[0];
      var links = results[1];
      var supplyData = results[2] || {};
      var assetMetadata = results[3] || {};
      var all = flattenSeries(seriesData);
      if (all.length === 0) {
        document.getElementById('featured-section-row').innerHTML = '<p class="col-12 text-muted">Load data/ (run archive script).</p>';
        document.getElementById('latest-dispensers-section-row').innerHTML = '<p class="col-12 text-muted">No data yet.</p>';
        return;
      }
      var featured = randomSample(all, 3);
      var random = randomSample(all, 6);
      var featuredRow = document.getElementById('featured-section-row');
      var randomRow = document.getElementById('latest-dispensers-section-row');
      if (typeof window.rpwWarn === 'function') {
        window.rpwWarn('Index: rendering sections', { featuredCount: featured.length, randomCount: random.length, hasFeaturedRow: !!featuredRow, hasRandomRow: !!randomRow });
      }
      if (featuredRow && featured.length) {
        featuredRow.innerHTML = featured.map(function (a) { return renderFeaturedCard(a, links); }).join('');
      }
      if (randomRow && random.length) {
        randomRow.innerHTML = random.map(function (a) {
          var name = a.name || a;
          var capStr = getCapDisplay(supplyData, assetMetadata, name);
          return renderGridCard(a, links, capStr, 'Series ' + (a.series || '—'));
        }).join('');
      }
    }).catch(function (err) {
      if (typeof window.rpwWarn === 'function') {
        window.rpwWarn('Index: failed to load data', { error: String(err && err.message || err), url: window.location.href });
      }
      console.error('[RarePepeWorld]', err);
      var fr = document.getElementById('featured-section-row');
      var rr = document.getElementById('latest-dispensers-section-row');
      if (fr) fr.innerHTML = '<p class="col-12 text-muted">Could not load pepe list.</p>';
      if (rr) rr.innerHTML = '';
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
