/**
 * Rare Pepe Wiki — per-card Markdown pages. Each card: wiki/ASSETNAME.md (artists can PR).
 */
(function () {
  'use strict';

  var DATA_BASE = 'data';
  var WIKI_BASE = 'wiki';

  function getAssetFromQuery() {
    var p = new URLSearchParams(window.location.search);
    return (p.get('asset') || '').trim().toUpperCase();
  }

  function escapeHtml(s) {
    if (!s) return ''; var d = document.createElement('div'); d.textContent = s; return d.innerHTML;
  }

  function flattenSeries(seriesData) {
    var list = [];
    if (!seriesData || typeof seriesData !== 'object') return list;
    Object.keys(seriesData).forEach(function (num) {
      (seriesData[num] || []).forEach(function (name) {
        list.push({ name: name, series: parseInt(num, 10) || 0 });
      });
    });
    return list.sort(function (a, b) {
      if (a.series !== b.series) return a.series - b.series;
      return (a.name || '').localeCompare(b.name || '');
    });
  }

  function init() {
    var asset = getAssetFromQuery();
    var main = document.getElementById('wiki-main');
    var loading = document.getElementById('wiki-loading');
    var content = document.getElementById('wiki-content');
    var empty = document.getElementById('wiki-empty');
    var index = document.getElementById('wiki-index');
    var indexList = document.getElementById('wiki-index-list');

    if (asset) {
      document.title = asset + ' — Wiki — RARE PEPE WORLD';
      loading.classList.remove('d-none');
      content.classList.add('d-none');
      empty.classList.add('d-none');
      index.classList.add('d-none');

      fetch(WIKI_BASE + '/' + encodeURIComponent(asset) + '.md')
        .then(function (r) {
          if (!r.ok) throw new Error('Not found');
          return r.text();
        })
        .then(function (md) {
          loading.classList.add('d-none');
          if (typeof marked !== 'undefined') {
            content.innerHTML = marked.parse(md || '');
            content.classList.remove('d-none');
          } else {
            content.innerHTML = '<pre>' + escapeHtml(md) + '</pre>';
            content.classList.remove('d-none');
          }
        })
        .catch(function () {
          loading.classList.add('d-none');
          document.getElementById('wiki-empty-asset').textContent = asset;
          empty.classList.remove('d-none');
        });
      return;
    }

    loading.classList.remove('d-none');
    content.classList.add('d-none');
    empty.classList.add('d-none');
    index.classList.add('d-none');

    fetch(DATA_BASE + '/RarePepeDirectory_Series_Data.json')
      .then(function (r) { return r.ok ? r.json() : {}; })
      .then(function (seriesData) {
        loading.classList.add('d-none');
        var all = flattenSeries(seriesData);
        var bySeries = {};
        all.forEach(function (a) {
          var s = a.series || 0;
          if (!bySeries[s]) bySeries[s] = [];
          bySeries[s].push(a.name);
        });
        var html = '';
        Object.keys(bySeries).sort(function (a, b) { return parseInt(a, 10) - parseInt(b, 10); }).forEach(function (seriesNum) {
          html += '<div class="col-12 col-md-6 col-lg-4 mb-3"><h4 class="h6">Series ' + escapeHtml(seriesNum) + '</h4><ul class="list-unstyled small">';
          (bySeries[seriesNum] || []).forEach(function (name) {
            html += '<li><a class="link-undecorated" href="wiki.html?asset=' + encodeURIComponent(name) + '">' + escapeHtml(name) + '</a></li>';
          });
          html += '</ul></div>';
        });
        indexList.innerHTML = html;
        index.classList.remove('d-none');
      })
      .catch(function () {
        loading.classList.add('d-none');
        indexList.innerHTML = '<p class="col-12 text-muted">Load data/RarePepeDirectory_Series_Data.json to list cards.</p>';
        index.classList.remove('d-none');
      });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
