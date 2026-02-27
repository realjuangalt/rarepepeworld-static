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

  /** assetMetadata is the single source (asset_metadata.json). Has issued, note, supply_cap per asset. */
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

  function init() {
    Promise.all([
      get(DATA_BASE + '/RarePepeDirectory_Series_Data.json').catch(function () { return {}; }),
      get(DATA_BASE + '/RarePepeDirectory_Links.json').catch(function () { return {}; }),
      get(DATA_BASE + '/asset_metadata.json').catch(function () { return {}; })
    ]).then(function (results) {
      var seriesData = results[0];
      var links = results[1];
      var assetMetadata = results[2] || {};
      var all = flattenSeries(seriesData);
      if (all.length === 0) {
        document.getElementById('featured-section-row').innerHTML = '<p class="col-12 text-muted">Load data/ (run archive script).</p>';
        document.getElementById('latest-dispensers-section-row').innerHTML = '<p class="col-12 text-muted">No data yet.</p>';
        return;
      }
      var featured = randomSample(all, 3);
      var featuredRow = document.getElementById('featured-section-row');
      var randomRow = document.getElementById('latest-dispensers-section-row');
      var shuffleHeading = document.getElementById('latest-dispensers-section-heading');
      var deps = {
        get: get,
        flattenSeries: flattenSeries,
        randomSample: randomSample,
        getCapDisplay: getCapDisplay,
        pepeImageUrl: pepeImageUrl,
        escapeHtml: escapeHtml,
        DATA_BASE: DATA_BASE
      };
      if (window.RandomPepeCards) {
        window.RandomPepeCards.init(randomRow, shuffleHeading, deps);
        if (randomRow) randomRow.innerHTML = window.RandomPepeCards.renderInitialRow(seriesData, assetMetadata, links);
      }
      if (typeof window.rpwWarn === 'function') {
        window.rpwWarn('Index: rendering sections', { featuredCount: featured.length, hasFeaturedRow: !!featuredRow, hasRandomRow: !!randomRow });
      }
      if (featuredRow && featured.length) {
        featuredRow.innerHTML = featured.map(function (a) { return renderFeaturedCard(a, links); }).join('');
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
