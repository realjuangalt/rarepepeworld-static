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
    var safe = (assetName || '').replace(/[^A-Za-z0-9._-]/g, '');
    return safe ? 'archive/pepes/' + safe + '.jpg' : placeholderImage();
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

  /** Featured: row of pepe images — slot is 400×560 (official Rare Pepe card size) so placeholder matches loaded card */
  function renderFeaturedCard(asset, links) {
    var name = asset.name || asset;
    var href = 'pepe.html?asset=' + encodeURIComponent(name);
    var imgUrl = pepeImageUrl(name);
    return (
      '<div class="col">' +
        '<a href="' + href + '" class="link-undecorated">' +
          '<div class="featured-pepe-slot">' +
            '<img class="pepe-image mb-3" src="' + imgUrl + '" alt="' + escapeHtml(name) + '" onerror="this.src=\'' + placeholderImage() + '\'">' +
          '</div>' +
        '</a>' +
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
          '<a class="link-undecorated" href="' + href + '">' +
            '<img class="card-image rounded" src="' + imgUrl + '" height="150" alt="' + escapeHtml(name) + '" onerror="this.src=\'' + placeholderImage() + '\'">' +
          '</a>' +
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
      get(DATA_BASE + '/RarePepeDirectory_Links.json').catch(function () { return {}; })
    ]).then(function (results) {
      var seriesData = results[0];
      var links = results[1];
      var all = flattenSeries(seriesData);
      if (all.length === 0) {
        document.getElementById('featured-section-row').innerHTML = '<p class="col-12 text-muted">Load data/ (run archive script).</p>';
        document.getElementById('latest-dispensers-section-row').innerHTML = '<p class="col-12 text-muted">No data yet.</p>';
        return;
      }
      var featured = randomSample(all, 3);
      var random = randomSample(all, 36);
      document.getElementById('featured-section-row').innerHTML = featured.map(function (a) { return renderFeaturedCard(a, links); }).join('');
      document.getElementById('latest-dispensers-section-row').innerHTML = random.map(function (a) {
        return renderGridCard(a, links, 'Supply: —', 'Series ' + (a.series || '—'));
      }).join('');
    }).catch(function (err) {
      console.error(err);
      document.getElementById('featured-section-row').innerHTML = '<p class="col-12 text-muted">Could not load pepe list.</p>';
      document.getElementById('latest-dispensers-section-row').innerHTML = '';
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
