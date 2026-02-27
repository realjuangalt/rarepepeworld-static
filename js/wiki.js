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

  function simpleMarkdownToHtml(md, escapeFn) {
    if (!escapeFn) escapeFn = function (s) { return s; };
    return md
      .replace(/^### (.+)$/gm, function (_, c) { return '<h3>' + escapeFn(c) + '</h3>'; })
      .replace(/^## (.+)$/gm, function (_, c) { return '<h2>' + escapeFn(c) + '</h2>'; })
      .replace(/^# (.+)$/gm, function (_, c) { return '<h1>' + escapeFn(c) + '</h1>'; })
      .replace(/\*\*(.+?)\*\*/g, function (_, c) { return '<strong>' + escapeFn(c) + '</strong>'; })
      .replace(/\*(.+?)\*/g, function (_, c) { return '<em>' + escapeFn(c) + '</em>'; })
      .replace(/\[([^\]]+)\]\(([^)]+)\)/g, function (_, label, url) { return '<a href="' + escapeHtml(url) + '" target="_blank" rel="noopener noreferrer">' + escapeFn(label) + '</a>'; })
      .replace(/\n/g, '<br>\n');
  }

  function renderMarkdownToHtml(md, escapeFn) {
    if (!md || typeof md !== 'string') return '';
    var m = typeof window !== 'undefined' && window.marked;
    if (m && m.default) m = m.default;
    try {
      if (m && typeof m.parse === 'function') return m.parse(md);
      if (m && typeof m === 'function') return m(md);
    } catch (e) { /* fall through to fallback */ }
    return '<div class="wiki-content">' + simpleMarkdownToHtml(md, escapeFn) + '</div>';
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
      var dataBar = document.getElementById('wiki-data-bar');
      if (dataBar) dataBar.classList.add('d-none');

      Promise.all([
        fetch(WIKI_BASE + '/' + encodeURIComponent(asset) + '.md').then(function (r) {
          if (!r.ok) throw new Error('Not found');
          return r.text();
        }),
        fetch(DATA_BASE + '/asset_metadata.json').then(function (r) { return r.ok ? r.json() : {}; }).catch(function () { return {}; }),
        fetch(DATA_BASE + '/RarePepeDirectory_Series_Data.json').then(function (r) { return r.ok ? r.json() : {}; }).catch(function () { return {}; })
      ]).then(function (results) {
        var md = results[0];
        var assetMetadata = results[1] || {};
        var seriesData = results[2] || {};
        loading.classList.add('d-none');
        content.innerHTML = renderMarkdownToHtml(md || '', escapeHtml);
        content.classList.remove('d-none');
        var seriesNum = (assetMetadata[asset] && assetMetadata[asset].series) ? assetMetadata[asset].series : null;
        if (seriesNum === null) {
          Object.keys(seriesData).forEach(function (k) {
            if ((seriesData[k] || []).indexOf(asset) !== -1) seriesNum = k;
          });
        }
        var supplyEntry = assetMetadata[asset] || {};
        if (!supplyEntry.issued && assetMetadata._meta) supplyEntry = {};
        var issued = supplyEntry.issued;
        var circulating = supplyEntry.circulating;
        var divisible = supplyEntry.divisible;
        var destroyed = supplyEntry.destroyed != null ? String(supplyEntry.destroyed) : '';
        var parts = [];
        if (seriesNum !== null && seriesNum !== undefined) parts.push('Series ' + escapeHtml(String(seriesNum)));
        if (issued != null && issued !== '') {
          if (divisible) {
            parts.push('Supply: divisible (circulating ' + escapeHtml(String(circulating != null ? circulating : issued)) + ')');
          } else {
            var circ = circulating != null ? circulating : issued;
            var supplyStr = 'Supply: ' + escapeHtml(String(circ)) + ' / ' + escapeHtml(String(issued));
            if (destroyed && parseInt(destroyed, 10) > 0) supplyStr += ' (' + escapeHtml(destroyed) + ' destroyed)';
            parts.push(supplyStr);
          }
        }
        if (parts.length && dataBar) {
          dataBar.innerHTML = parts.join(' · ');
          dataBar.classList.remove('d-none');
        }
      }).catch(function (e) {
        if (typeof window.rpwWarn === 'function') {
          window.rpwWarn('wiki.js: asset wiki fetch failed', { asset: asset, error: String(e && e.message || e) });
        }
        loading.classList.add('d-none');
        var emptyAssetEl = document.getElementById('wiki-empty-asset');
        if (emptyAssetEl) emptyAssetEl.textContent = asset;
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
      .catch(function (err) {
        if (typeof window.rpwWarn === 'function') {
          window.rpwWarn('wiki.js: series data fetch failed', { error: String(err && err.message || err) });
        }
        loading.classList.add('d-none');
        indexList.innerHTML = '<p class="col-12 text-muted">Load data/RarePepeDirectory_Series_Data.json to list cards.</p>';
        index.classList.remove('d-none');
      });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
