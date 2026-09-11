/**
 * Book of Kek viewer — loads SUMMARY.md from book-of-kek/ (cloned from thepepeinc/book-of-kek),
 * builds sidebar nav, and renders selected .md pages with marked.
 */
(function () {
  'use strict';

  var BOK_BASE = 'book-of-kek';
  var SUMMARY_PATH = BOK_BASE + '/SUMMARY.md';
  var ASSET_FALLBACK_BASE =
    'https://raw.githubusercontent.com/thepepeinc/book-of-kek/master';

  var navItems = [];
  var currentPath = '';

  /**
   * Parse GitBook SUMMARY.md into list of { title, path, indent, isHeading }.
   * List items: * [Title](path). Headings: ## Chapter …
   */
  function parseSummary(text) {
    var lines = (text || '').split(/\r?\n/);
    var items = [];
    var linkRe = /^\s*\*\s*\[([^\]]*)\]\(([^)]+)\)/;
    var headingRe = /^##\s+(.+?)\s*$/;
    for (var i = 0; i < lines.length; i++) {
      var line = lines[i];
      var hm = line.match(headingRe);
      if (hm) {
        items.push({
          title: hm[1].trim(),
          path: '',
          indent: 0,
          isHeading: true
        });
        continue;
      }
      var m = line.match(linkRe);
      if (!m) continue;
      var spaces = line.match(/^\s*/)[0].length;
      var indent = 0;
      if (spaces >= 4) indent = 2;
      else if (spaces >= 2) indent = 1;
      items.push({
        title: m[1].trim(),
        path: m[2].trim(),
        indent: indent,
        isHeading: false
      });
    }
    return items;
  }

  function stripFrontmatter(md) {
    if (!md) return '';
    return md.replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n?/, '');
  }

  /**
   * Strip GitBook-style blocks so marked doesn't show raw tags.
   * Keep hint body as a blockquote. Keep embed URLs as links.
   */
  function stripGitBookBlocks(md) {
    if (!md) return '';
    return md
      .replace(/\{%\s*embed\s+url="([^"]*)"\s*%\}[\s\S]*?{%\s*endembed\s*%}/gi, function (_b, url) {
        return '\n\n[Embedded media](' + url + ')\n\n';
      })
      .replace(/\{%\s*hint[^%]*%\}([\s\S]*?){%\s*endhint\s*%}/gi, function (_b, body) {
        var lines = String(body || '').trim().split(/\r?\n/);
        return '\n\n' + lines.map(function (l) { return '> ' + l; }).join('\n') + '\n\n';
      })
      .replace(/\{%\s*content-ref[^%]*%\}[\s\S]*?{%\s*endcontent-ref\s*%}/gi, '')
      .replace(/\{%[^%]*%}/g, '');
  }

  function unescapeGitBookEntities(md) {
    if (!md) return '';
    return md
      .replace(/&#x20;/gi, ' ')
      .replace(/&nbsp;/gi, ' ')
      .replace(/\\_/g, '_');
  }

  function escapeHtml(s) {
    if (!s) return '';
    var d = document.createElement('div');
    d.textContent = s;
    return d.innerHTML;
  }

  function dirname(path) {
    var i = path.lastIndexOf('/');
    return i === -1 ? '' : path.slice(0, i);
  }

  function normalizePath(path) {
    var parts = [];
    String(path || '').split('/').forEach(function (part) {
      if (!part || part === '.') return;
      if (part === '..') {
        if (parts.length) parts.pop();
        return;
      }
      parts.push(part);
    });
    return parts.join('/');
  }

  function resolveAgainst(basePath, rel) {
    if (!rel) return '';
    if (/^(https?:|data:|mailto:|#)/i.test(rel)) return rel;
    if (rel.charAt(0) === '/') return rel.slice(1);
    var baseDir = dirname(basePath);
    return normalizePath((baseDir ? baseDir + '/' : '') + rel);
  }

  function isInternalMdLink(href) {
    if (!href || /^(https?:|mailto:|data:|#)/i.test(href)) return false;
    var clean = href.split('#')[0].split('?')[0];
    return /\.md$/i.test(clean) || /\/$/i.test(clean) || clean.indexOf('.') === -1;
  }

  function toViewerHash(resolved) {
    var path = resolved.replace(/\/$/, '');
    if (!/\.md$/i.test(path)) {
      var asReadme = path + '/README.md';
      var asIndex = path + '/index.md';
      if (navItems.some(function (i) { return i.path === asReadme; })) path = asReadme;
      else if (navItems.some(function (i) { return i.path === asIndex; })) path = asIndex;
      else path = asReadme;
    }
    return '#' + encodeURIComponent(path);
  }

  function setActiveNav(path) {
    var nav = document.getElementById('bok-nav');
    if (!nav) return;
    var links = nav.querySelectorAll('a[data-path]');
    for (var i = 0; i < links.length; i++) {
      var a = links[i];
      if (a.dataset.path === path) a.classList.add('active');
      else a.classList.remove('active');
    }
  }

  function buildNav(items, defaultPath) {
    var nav = document.getElementById('bok-nav');
    var loading = document.getElementById('bok-nav-loading');
    var missing = document.getElementById('bok-nav-missing');
    var pageItems = items.filter(function (i) { return !i.isHeading && i.path; });
    if (!nav || !pageItems.length) {
      if (loading) loading.classList.add('d-none');
      if (missing) missing.classList.remove('d-none');
      return;
    }
    if (loading) loading.classList.add('d-none');
    if (missing) missing.classList.add('d-none');
    nav.classList.remove('d-none');
    nav.innerHTML = '';
    defaultPath = defaultPath || (pageItems[0] && pageItems[0].path);
    items.forEach(function (item) {
      if (item.isHeading) {
        var h = document.createElement('div');
        h.className = 'bok-nav-heading';
        h.textContent = item.title;
        nav.appendChild(h);
        return;
      }
      var a = document.createElement('a');
      a.href = '#' + encodeURIComponent(item.path);
      a.className =
        'list-group-item list-group-item-action indent-' + item.indent +
        (item.path === defaultPath ? ' active' : '');
      a.textContent = item.title;
      a.dataset.path = item.path;
      nav.appendChild(a);
    });
    return defaultPath;
  }

  function rewriteContentLinks(body, pagePath) {
    if (!body) return;

    var anchors = body.querySelectorAll('a[href]');
    for (var i = 0; i < anchors.length; i++) {
      var a = anchors[i];
      var href = a.getAttribute('href') || '';
      if (href === 'broken-reference' || /broken-reference/i.test(href)) {
        a.removeAttribute('href');
        a.classList.add('bok-broken-link');
        continue;
      }
      if (!isInternalMdLink(href)) continue;
      var resolved = resolveAgainst(pagePath, href.split('#')[0]);
      var hash = href.indexOf('#') >= 0 ? href.slice(href.indexOf('#')) : '';
      // Same-page fragment stays a normal in-page anchor.
      if (hash && hash !== '#' && (!href.split('#')[0] || resolved === pagePath)) {
        a.setAttribute('href', hash);
      } else {
        a.setAttribute('href', toViewerHash(resolved));
      }
      a.classList.add('bok-internal-link');
    }

    var imgs = body.querySelectorAll('img[src]');
    for (var j = 0; j < imgs.length; j++) {
      rewriteImage(imgs[j], pagePath);
    }
  }

  function rewriteImage(img, pagePath) {
    var src = img.getAttribute('src') || '';
    if (!src || /^(https?:|data:)/i.test(src)) return;
    // GitBook angle-bracket paths may leave encoded spaces; decode once.
    try { src = decodeURIComponent(src); } catch (e) { /* keep */ }
    var resolved = resolveAgainst(pagePath, src);
    var localUrl = BOK_BASE + '/' + resolved;
    img.setAttribute('src', localUrl);
    img.setAttribute('loading', 'lazy');
    img.classList.add('bok-content-img');
    img.onerror = function () {
      if (img.dataset.fallbackTried) {
        img.classList.add('bok-img-missing');
        img.removeAttribute('src');
        img.alt = img.alt || 'Image unavailable';
        return;
      }
      img.dataset.fallbackTried = '1';
      img.src = ASSET_FALLBACK_BASE + '/' + resolved;
    };
  }

  function setDocumentTitle(path) {
    var item = navItems.find(function (i) { return i.path === path; });
    var title = (item && item.title) || 'Book of Kek';
    document.title = title + ' — Book of Kek — RARE PEPE WORLD';
  }

  function loadPage(path) {
    var body = document.getElementById('bok-content-body');
    var loading = document.getElementById('bok-content-loading');
    var error = document.getElementById('bok-content-error');
    if (!path) return;
    currentPath = path;
    setActiveNav(path);
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
        var cleaned = unescapeGitBookEntities(stripGitBookBlocks(stripFrontmatter(md)));
        if (typeof marked !== 'undefined') {
          body.innerHTML = marked.parse(cleaned || '');
        } else {
          body.innerHTML = '<pre>' + escapeHtml(md) + '</pre>';
        }
        rewriteContentLinks(body, path);
        body.classList.remove('d-none');
        if (history && history.replaceState) {
          history.replaceState(null, '', '#' + encodeURIComponent(path));
        }
        setDocumentTitle(path);
        try {
          body.scrollIntoView({ block: 'start', behavior: 'smooth' });
        } catch (e) {
          window.scrollTo(0, 0);
        }
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
        navItems = parseSummary(text);
        var hash = (window.location.hash || '').replace(/^#/, '');
        var decodedHash = hash ? decodeURIComponent(hash) : '';
        var defaultPath = buildNav(navItems, decodedHash || null);

        if (decodedHash && navItems.some(function (i) { return i.path === decodedHash; })) {
          loadPage(decodedHash);
        } else if (defaultPath) {
          loadPage(defaultPath);
        }
        if (contentLoading) contentLoading.classList.add('d-none');

        document.getElementById('bok-nav').addEventListener('click', function (e) {
          var a = e.target.closest('a[data-path]');
          if (!a) return;
          e.preventDefault();
          loadPage(a.dataset.path);
        });

        document.getElementById('bok-content-body').addEventListener('click', function (e) {
          var a = e.target.closest('a.bok-internal-link');
          if (!a) return;
          var href = a.getAttribute('href') || '';
          if (href.charAt(0) !== '#') return;
          e.preventDefault();
          loadPage(decodeURIComponent(href.slice(1)));
        });
      })
      .catch(function (err) {
        if (typeof window.rpwWarn === 'function') {
          window.rpwWarn('book-of-kek.js: summary fetch failed', { error: String(err && err.message || err) });
        }
        var navLoading = document.getElementById('bok-nav-loading');
        var navMissing = document.getElementById('bok-nav-missing');
        if (navLoading) navLoading.classList.add('d-none');
        if (navMissing) navMissing.classList.remove('d-none');
        if (contentLoading) contentLoading.classList.add('d-none');
      });

    window.addEventListener('hashchange', function () {
      var hash = (window.location.hash || '').replace(/^#/, '');
      if (!hash) return;
      var path = decodeURIComponent(hash);
      if (path !== currentPath) loadPage(path);
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
