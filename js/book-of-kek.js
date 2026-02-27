/**
 * Book of Kek viewer — loads SUMMARY.md from book-of-kek/ (cloned from thepepeinc/book-of-kek),
 * builds sidebar nav, and renders selected .md pages with marked.
 */
(function () {
  'use strict';

  var BOK_BASE = 'book-of-kek';
  var SUMMARY_PATH = BOK_BASE + '/SUMMARY.md';

  /**
   * Parse GitBook SUMMARY.md into list of { title, path, indent }.
   * Lines: * [Title](path) or  * [Title](path) (leading space = child).
   */
  function parseSummary(text) {
    var lines = (text || '').split(/\r?\n/);
    var items = [];
    var re = /^\s*\*\s*\[([^\]]*)\]\(([^)]+)\)/;
    for (var i = 0; i < lines.length; i++) {
      var m = lines[i].match(re);
      if (!m) continue;
      var indent = lines[i].match(/^\s*/)[0].length;
      items.push({
        title: m[1].trim(),
        path: m[2].trim(),
        indent: indent > 2 ? 1 : 0
      });
    }
    return items;
  }

  /**
   * Strip GitBook-style blocks so marked doesn't show raw tags.
   * e.g. {% embed url="..." %}, {% content-ref %}, {% hint %}
   */
  function stripGitBookBlocks(md) {
    if (!md) return '';
    return md
      .replace(/\{%\s*embed\s+url="[^"]*"\s*%\}[\s\S]*?{%\s*endembed\s*%}/gi, function (block) {
        var m = block.match(/url="([^"]*)"/i);
        return m ? '\n\n*[Embedded media: ' + m[1] + ']\n\n' : '';
      })
      .replace(/\{%\s*content-ref[^%]*%\}[\s\S]*?{%\s*endcontent-ref\s*%}/gi, '')
      .replace(/\{%\s*hint[^%]*%\}[\s\S]*?{%\s*endhint\s*%}/gi, '')
      .replace(/\{%[^%]*%}/g, '');
  }

  function escapeHtml(s) {
    if (!s) return '';
    var d = document.createElement('div');
    d.textContent = s;
    return d.innerHTML;
  }

  function buildNav(items, defaultPath) {
    var nav = document.getElementById('bok-nav');
    var loading = document.getElementById('bok-nav-loading');
    var missing = document.getElementById('bok-nav-missing');
    if (!nav || !items.length) {
      if (loading) loading.classList.add('d-none');
      if (missing) missing.classList.remove('d-none');
      return;
    }
    if (loading) loading.classList.add('d-none');
    if (missing) missing.classList.add('d-none');
    nav.classList.remove('d-none');
    nav.innerHTML = '';
    defaultPath = defaultPath || (items[0] && items[0].path);
    items.forEach(function (item) {
      var a = document.createElement('a');
      a.href = '#' + encodeURIComponent(item.path);
      a.className = 'list-group-item list-group-item-action' + (item.indent ? ' indent-1' : '');
      a.textContent = item.title;
      a.dataset.path = item.path;
      nav.appendChild(a);
    });
    return defaultPath;
  }

  function loadPage(path, navItems) {
    var body = document.getElementById('bok-content-body');
    var loading = document.getElementById('bok-content-loading');
    var error = document.getElementById('bok-content-error');
    if (body) body.classList.add('d-none');
    if (error) error.classList.add('d-none');
    if (loading) loading.classList.remove('d-none');

    var url = BOK_BASE + '/' + path.replace(/^\//, '');
    fetch(url)
      .then(function (r) {
        if (!r.ok) throw new Error('Not found');
        return r.text();
      })
      .then(function (md) {
        if (loading) loading.classList.add('d-none');
        var cleaned = stripGitBookBlocks(md);
        if (typeof marked !== 'undefined') {
          body.innerHTML = marked.parse(cleaned || '');
        } else {
          body.innerHTML = '<pre>' + escapeHtml(md) + '</pre>';
        }
        body.classList.remove('d-none');
        if (history && history.replaceState) {
          history.replaceState(null, '', '#' + encodeURIComponent(path));
        }
        document.title = (navItems && navItems.find(function (i) { return i.path === path; }))?.title + ' — Book of Kek — RARE PEPE WORLD' || 'Book of Kek — RARE PEPE WORLD';
      })
      .catch(function (e) {
        if (typeof window.rpwWarn === 'function') {
          window.rpwWarn('book-of-kek.js: page fetch failed', { path: path, error: String(e && e.message || e) });
        }
        if (loading) loading.classList.add('d-none');
        if (error) {
          error.classList.remove('d-none');
          var p = error.querySelector('p');
          if (p) p.textContent = 'Could not load: ' + path;
        }
      });
  }

  function init() {
    var contentLoading = document.getElementById('bok-content-loading');
    fetch(SUMMARY_PATH)
      .then(function (r) {
        if (!r.ok) throw new Error('Summary not found');
        return r.text();
      })
      .then(function (text) {
        var items = parseSummary(text);
        var hash = (window.location.hash || '').replace(/^#/, '');
        var decodedHash = hash ? decodeURIComponent(hash) : '';
        var defaultPath = buildNav(items, decodedHash || (items[0] && items[0].path));

        if (decodedHash && items.some(function (i) { return i.path === decodedHash; })) {
          loadPage(decodedHash, items);
        } else if (defaultPath) {
          loadPage(defaultPath, items);
        }
        if (contentLoading) contentLoading.classList.add('d-none');

        document.getElementById('bok-nav').addEventListener('click', function (e) {
          var a = e.target.closest('a[data-path]');
          if (!a) return;
          e.preventDefault();
          loadPage(a.dataset.path, items);
        });
      })
      .catch(function (err) {
        if (typeof window.rpwWarn === 'function') {
          window.rpwWarn('book-of-kek.js: summary fetch failed', { error: String(err && err.message || err) });
        }
        var navLoading = document.getElementById('bok-nav-loading');
        var navMissing = document.getElementById('bok-nav-missing');
        var contentLoading = document.getElementById('bok-content-loading');
        if (navLoading) navLoading.classList.add('d-none');
        if (navMissing) navMissing.classList.remove('d-none');
        if (contentLoading) contentLoading.classList.add('d-none');
      });

    window.addEventListener('hashchange', function () {
      var hash = (window.location.hash || '').replace(/^#/, '');
      if (hash) loadPage(decodeURIComponent(hash));
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
