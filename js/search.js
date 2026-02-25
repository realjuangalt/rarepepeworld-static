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
    var safe = (name || '').replace(/[^A-Za-z0-9._-]/g, '');
    return safe ? 'archive/pepes/' + safe + '.jpg' : '';
  }

  function placeholderImg() {
    return 'data:image/svg+xml,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200" viewBox="0 0 200 200"><rect fill="#e9ecef" width="200" height="200"/><text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle" fill="#6c757d">Pepe</text></svg>');
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

  function renderCard(asset, links) {
    var name = asset.name;
    var series = asset.series;
    var href = 'pepe.html?asset=' + encodeURIComponent(name);
    var imgUrl = pepeImageUrl(name);
    return (
      '<div class="col p-3">' +
        '<div class="text-center" id="card_pepe_name"><span class="font-weight-bold">' + escapeHtml(name) + '</span></div>' +
        '<div class="text-center" id="card-image">' +
          '<a href="' + href + '" class="link-undecorated"><img class="card-image rounded" src="' + imgUrl + '" height="210" alt="' + escapeHtml(name) + '" onerror="this.src=\'' + placeholderImg() + '\'"></a>' +
        '</div>' +
        '<div class="sub-data text-center">' +
          (series ? '<span id="card-line-1">Series ' + series + '</span>' : '') +
          ' | <span id="card-line-2">Supply: —</span>' +
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
        return fetch(DATA_BASE + '/RarePepeDirectory_Links.json').then(function (r) { return r.ok ? r.json() : {}; }).then(function (links) {
          if (matches.length === 0) {
            row.innerHTML = '';
            noResults.classList.remove('d-none');
            return;
          }
          noResults.classList.add('d-none');
          row.innerHTML = matches.map(function (asset) { return renderCard(asset, links); }).join('');
        });
      })
      .catch(function () {
        row.innerHTML = '<p class="col-12 text-muted">Could not load data.</p>';
      });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
