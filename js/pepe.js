/**
 * Pepe detail page — Info/Holders, XCP & PEPECASH DEX.
 *
 * Data sources (aligned with v1 RarePepeWorld.com where possible):
 * - TokenScan API: /asset, /holders, /destructions, /market/{asset}/{XCP|PEPECASH}/orderbook
 *   (v1 used XChain API + MySQL populated from Counterparty RPC; TokenScan is same ecosystem.)
 * - Local: asset_metadata.json (issued/circulating/destroyed, supply_cap, artist, series, rpd_url),
 *   RarePepeDirectory_Series_Data.json, RarePepeDirectory_Links.json, burn_addresses.json (Real Supply).
 *
 * Supply: prefers asset_metadata.json; fallback TokenScan asset.supply + destructions → issued.
 * Real Supply (Holders tab): sum(holder quantities) minus holdings at known burn addresses (v1 logic).
 */
(function () {
  'use strict';

  var API = 'https://tokenscan.io/api';
  var TOKENSCAN = 'https://tokenscan.io';

  function getAssetFromQuery() {
    var p = new URLSearchParams(window.location.search);
    return (p.get('asset') || '').trim().toUpperCase();
  }

  function escapeHtml(s) {
    if (!s) return '';
    var d = document.createElement('div'); d.textContent = s; return d.innerHTML;
  }

  var PEPE_IMAGE_EXTS = ['.gif', '.jpg', '.png'];

  function pepeImageUrl(name, ext) {
    var safe = (name || '').replace(/[^A-Za-z0-9._-]/g, '');
    return safe ? 'archive/pepes/' + safe + (ext || '.jpg') : '';
  }

  function tryPepeImage(imgEl, linkEl, asset) {
    if (!asset) { imgEl.src = placeholderImg(); return; }
    var safe = (asset || '').replace(/[^A-Za-z0-9._-]/g, '');
    if (!safe) { imgEl.src = placeholderImg(); return; }
    var idx = 0;
    function tryNext() {
      if (idx >= PEPE_IMAGE_EXTS.length) {
        imgEl.src = placeholderImg();
        if (linkEl) linkEl.href = '#';
        return;
      }
      var url = 'archive/pepes/' + safe + PEPE_IMAGE_EXTS[idx];
      imgEl.onerror = function () { idx++; tryNext(); };
      imgEl.src = url;
      if (linkEl) linkEl.href = url;
    }
    tryNext();
  }

  function placeholderImg() {
    return 'data:image/svg+xml,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="350" height="350" viewBox="0 0 350 350"><rect fill="#e9ecef" width="350" height="350"/><text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle" fill="#6c757d">Pepe</text></svg>');
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

  /** Strip redundant Series/Supply lines from wiki markdown when shown on asset page (already in details above). */
  function stripSeriesSupplyFromWikiMd(md) {
    if (!md || typeof md !== 'string') return md;
    return md
      .replace(/^\s*\*\*Series:\*\*[^\n]*\n?/gm, '')
      .replace(/^\s*\*\*Supply:\*\*[^\n]*\n?/gm, '')
      .replace(/^\s*Series:\s*[^\n]*\n?/gim, '')
      .replace(/^\s*Supply:\s*[^\n]*\n?/gim, '')
      .replace(/^[^\n]*Series:\s*[^\n]*Supply:\s*[^\n]*\n?/gim, '')
      .replace(/\n{3,}/g, '\n\n')
      .trim();
  }

  function setWikiContentWithMarkdown(contentEl, md) {
    if (!contentEl) return;
    md = stripSeriesSupplyFromWikiMd(md);
    contentEl.innerHTML = renderMarkdownToHtml(md, escapeHtml);
    contentEl.querySelectorAll('a[href^="http"]').forEach(function (a) {
      a.setAttribute('target', '_blank');
      a.setAttribute('rel', 'noopener noreferrer');
    });
    contentEl.classList.remove('d-none');
  }

  function formatSupply(supply, divisible) {
    if (supply == null) return '—';
    var n = Number(supply);
    if (divisible) n = n / 1e8;
    return n.toLocaleString(undefined, { maximumFractionDigits: divisible ? 8 : 0 });
  }

  function renderOrderTable(asks, bids, baseLabel) {
    var html = '<div class="row"><div class="col"><table class="order-table table"><tr><th colspan="3">Sell Orders</th></tr><tr><th>' + baseLabel + '</th><th>Price</th><th>Stock</th></tr>';
    (asks || []).slice(0, 15).forEach(function (row) {
      var price = row[0], amount = row[1];
      html += '<tr><td>' + escapeHtml(amount) + '</td><td>' + escapeHtml(price) + '</td><td>' + escapeHtml(amount) + '</td></tr>';
    });
    html += '</table></div><div class="col"><table class="order-table table"><tr><th colspan="3">Buy Orders</th></tr><tr><th>' + baseLabel + '</th><th>Price</th><th>Stock</th></tr>';
    (bids || []).slice(0, 15).forEach(function (row) {
      var price = row[0], amount = row[1];
      html += '<tr><td>' + escapeHtml(amount) + '</td><td>' + escapeHtml(price) + '</td><td>' + escapeHtml(amount) + '</td></tr>';
    });
    html += '</table></div></div>';
    return html;
  }

  function run() {
    var asset = getAssetFromQuery();
    if (!asset) {
      document.getElementById('pepe-loading').textContent = 'No asset specified. Use ?asset=NAME';
      return;
    }

    document.getElementById('pepe-loading').classList.remove('d-none');
    document.getElementById('pepe-content').classList.add('d-none');

    var imgEl = document.getElementById('pepe-image');
    var linkEl = document.getElementById('pepe-image-link');
    tryPepeImage(imgEl, linkEl, asset);

    Promise.all([
      fetch('data/RarePepeDirectory_Links.json').then(function (r) { return r.ok ? r.json() : {}; }).catch(function () { return {}; }),
      fetch(API + '/asset/' + encodeURIComponent(asset)).then(function (r) { return r.ok ? r.json() : null; }).catch(function () { return null; }),
      fetch(API + '/market/' + encodeURIComponent(asset) + '/XCP/orderbook').then(function (r) { return r.ok ? r.json() : null; }).catch(function () { return null; }),
      fetch(API + '/market/' + encodeURIComponent(asset) + '/PEPECASH/orderbook').then(function (r) { return r.ok ? r.json() : null; }).catch(function () { return null; }),
      fetch('data/RarePepeDirectory_Series_Data.json').then(function (r) { return r.ok ? r.json() : {}; }).catch(function () { return {}; }),
      fetch(API + '/destructions/' + encodeURIComponent(asset)).then(function (r) { return r.ok ? r.json() : { data: [] }; }).catch(function () { return { data: [] }; }),
      fetch('data/burn_addresses.json').then(function (r) { return r.ok ? r.json() : []; }).catch(function () { return []; }),
      fetch('data/asset_metadata.json').then(function (r) { return r.ok ? r.json() : {}; }).catch(function () { return {}; })
    ]).then(function (results) {
      var apiFailed = !results[1];
      var links = results[0];
      var assetData = results[1];
      var xcpOrderbook = results[2];
      var pcOrderbook = results[3];
      var seriesData = results[4] || {};
      var destructionsData = results[5] || { data: [] };
      var burnAddresses = results[6] || [];
      var assetMetadata = results[7] || {};
      var supplyEntry = assetMetadata[asset] || null;

      document.title = asset + ' — RARE PEPE WORLD';

      var rpdUrl = (assetMetadata[asset] && assetMetadata[asset].rpd_url) || links[asset] || '';
      document.getElementById('pepe-rpd-link').href = rpdUrl || '#';
      document.getElementById('pepe-rpd-link').style.display = rpdUrl ? '' : 'none';
      var xchainEl = document.getElementById('pepe-xchain-link');
      if (xchainEl) {
        xchainEl.href = TOKENSCAN + '/asset/' + encodeURIComponent(asset);
        xchainEl.style.display = 'inline';
      }

      document.getElementById('pepe-name').textContent = asset;
      var nameDetails = document.getElementById('pepe-name-details');
      if (nameDetails) nameDetails.textContent = asset;
      var breadcrumb = document.querySelector('.pepe-v2-breadcrumb');
      if (breadcrumb) breadcrumb.innerHTML = '<a href="index.html">Home</a> / ' + escapeHtml(asset);

      var supply = '—';
      var divisible = false;
      if (supplyEntry && supplyEntry.issued != null && supplyEntry.issued !== '' && !supplyEntry.note) {
        divisible = supplyEntry.divisible || false;
        var circ = supplyEntry.circulating != null ? supplyEntry.circulating : supplyEntry.issued;
        supply = formatSupply(circ, divisible) + ' / ' + formatSupply(supplyEntry.issued, divisible);
        var destroyed = supplyEntry.destroyed != null ? parseInt(supplyEntry.destroyed, 10) : 0;
        if (destroyed > 0) supply += ' (' + destroyed.toLocaleString() + ' destroyed)';
      } else if (assetData && assetData.supply != null) {
        divisible = assetData.divisible || false;
        var totalDestroyed = 0;
        (destructionsData.data || []).forEach(function (d) {
          if (d.status === 'valid' && d.quantity != null) totalDestroyed += parseFloat(d.quantity) || 0;
        });
        var circ = parseFloat(assetData.supply);
        if (!divisible) circ = parseInt(assetData.supply, 10);
        var issued = divisible ? (circ + totalDestroyed) : (Math.round(circ) + Math.round(totalDestroyed));
        supply = formatSupply(circ, divisible) + ' / ' + formatSupply(issued, divisible);
        if (totalDestroyed > 0) supply += ' (' + (divisible ? totalDestroyed.toLocaleString() : Math.round(totalDestroyed).toLocaleString()) + ' destroyed)';
      } else {
        var metaCap = assetMetadata[asset] && (assetMetadata[asset].supply_cap != null && assetMetadata[asset].supply_cap !== '');
        if (metaCap) supply = 'Cap: ' + formatSupply(assetMetadata[asset].supply_cap, false);
      }
      document.getElementById('pepe-supply').textContent = supply;

      var supplyCapEl = document.getElementById('pepe-supply-cap');
      var capValue = '—';
      if (supplyEntry && supplyEntry.issued != null && supplyEntry.issued !== '' && !supplyEntry.note) {
        capValue = formatSupply(supplyEntry.issued, supplyEntry.divisible || false);
      } else if (assetData && assetData.supply != null) {
        var div = assetData.divisible || false;
        var tot = 0;
        (destructionsData.data || []).forEach(function (d) {
          if (d.status === 'valid' && d.quantity != null) tot += parseFloat(d.quantity) || 0;
        });
        var circ = parseFloat(assetData.supply);
        if (!div) circ = parseInt(assetData.supply, 10);
        capValue = formatSupply(div ? (circ + tot) : (Math.round(circ) + Math.round(tot)), div);
      } else if (assetMetadata[asset] && (assetMetadata[asset].supply_cap != null && assetMetadata[asset].supply_cap !== '')) {
        capValue = formatSupply(assetMetadata[asset].supply_cap, false);
      }
      if (supplyCapEl) supplyCapEl.textContent = capValue;

      var series = '—';
      if (assetMetadata[asset] && assetMetadata[asset].series != null && assetMetadata[asset].series !== '') {
        series = String(assetMetadata[asset].series);
      } else {
        var seriesNum = null;
        Object.keys(seriesData).forEach(function (k) {
          if (k === '_meta' || !Array.isArray(seriesData[k])) return;
          if (seriesData[k].indexOf(asset) !== -1) seriesNum = k;
        });
        if (seriesNum != null) series = String(seriesNum);
        else if (assetData && assetData.asset_longname) series = assetData.asset_longname;
      }
      document.getElementById('pepe-series').textContent = series;

      var artist = '—';
      var issuerAddr = (assetData && assetData.issuer) ? assetData.issuer : (assetMetadata[asset] && assetMetadata[asset].artist) ? assetMetadata[asset].artist : null;
      if (issuerAddr) {
        var short = String(issuerAddr).length > 12 ? (String(issuerAddr).slice(0, 8) + '…') : String(issuerAddr);
        artist = '<a class="link-undecorated" href="artist.html?address=' + encodeURIComponent(issuerAddr) + '">' + escapeHtml(short) + '</a>';
      }
      document.getElementById('pepe-artist').innerHTML = artist;

      var descRow = document.getElementById('pepe-description-row');
      var descEl = document.getElementById('pepe-description');
      if (assetData && assetData.description && String(assetData.description).trim()) {
        var descUrl = String(assetData.description).trim();
        if (/^https?:\/\//i.test(descUrl)) {
          descEl.innerHTML = '<a class="link-undecorated" href="' + escapeHtml(descUrl) + '" target="_blank" rel="noopener">' + escapeHtml(descUrl.replace(/^https?:\/\//, '').slice(0, 50)) + (descUrl.length > 50 ? '…' : '') + ' <i class="fa fa-external-link"></i></a>';
          descRow.classList.remove('d-none');
        }
      }

      var valueRow = document.getElementById('pepe-value-row');
      var valueEl = document.getElementById('pepe-value');
      if (assetData && (assetData.estimated_value || (assetData.market_info && assetData.market_info.btc))) {
        var btc = (assetData.estimated_value && assetData.estimated_value.btc) || (assetData.market_info && assetData.market_info.btc && assetData.market_info.btc.floor);
        var usd = assetData.estimated_value && assetData.estimated_value.usd;
        var parts = [];
        if (btc) parts.push(parseFloat(btc).toFixed(8) + ' BTC');
        if (usd) parts.push('$' + parseFloat(usd).toLocaleString(undefined, { maximumFractionDigits: 0 }));
        if (parts.length) {
          valueEl.textContent = parts.join(' · ');
          valueRow.classList.remove('d-none');
        }
      }

      var holdersLink = document.getElementById('pepe-holders-link');
      if (holdersLink) holdersLink.href = 'pepe-holders.html?asset=' + encodeURIComponent(asset);

      document.getElementById('pepe-loading').classList.add('d-none');
      document.getElementById('pepe-content').classList.remove('d-none');

      var loadingEl = document.getElementById('wiki-loading');
      var contentEl = document.getElementById('wiki-content');
      var emptyEl = document.getElementById('wiki-empty');
      if (loadingEl) loadingEl.classList.remove('d-none');
      if (contentEl) { contentEl.innerHTML = ''; contentEl.classList.add('d-none'); }
      if (emptyEl) emptyEl.classList.add('d-none');
      fetch('wiki/' + encodeURIComponent(asset) + '.md')
        .then(function (r) {
          if (!r.ok) throw new Error('Not found');
          return r.text();
        })
        .then(function (md) {
          if (loadingEl) loadingEl.classList.add('d-none');
          if (emptyEl) emptyEl.classList.add('d-none');
          if (contentEl) {
            setWikiContentWithMarkdown(contentEl, md);
            var h1 = contentEl.querySelector('h1');
            if (h1 && String((h1.textContent || '')).trim().toUpperCase() === asset.toUpperCase()) {
              h1.parentNode.removeChild(h1);
            }
          }
        })
        .catch(function (e) {
          if (typeof window.rpwWarn === 'function') {
            window.rpwWarn('pepe.js: wiki fetch failed', { asset: asset, error: String(e && e.message || e) });
          }
          if (loadingEl) loadingEl.classList.add('d-none');
          if (contentEl) contentEl.classList.add('d-none');
          if (emptyEl) emptyEl.classList.remove('d-none');
        });
    }).catch(function (err) {
      if (typeof window.rpwWarn === 'function') {
        window.rpwWarn('pepe.js: page init failed', { asset: asset, error: String(err && err.message || err) });
      }
      console.warn('[RarePepeWorld]', err);
      var el = document.getElementById('pepe-loading');
      if (el) el.innerHTML = 'Something went wrong loading this page. <a href="pepe.html?asset=' + encodeURIComponent(asset) + '">Try again</a>.';
    });
  }

  function initPepeLightbox() {
    var link = document.getElementById('pepe-image-link');
    var img = document.getElementById('pepe-image');
    var lb = document.getElementById('pepe-lightbox');
    var lbImg = document.getElementById('pepe-lightbox-img');
    var lbOpenTab = document.getElementById('pepe-lightbox-open-tab');
    var backdrop = lb && lb.querySelector('.pepe-lightbox-backdrop');
    var closeBtn = lb && lb.querySelector('.pepe-lightbox-close');
    if (!link || !img || !lb || !lbImg) return;
    link.addEventListener('click', function (e) {
      e.preventDefault();
      var src = img.src || (img.currentSrc && img.currentSrc);
      if (!src || String(src).indexOf('data:') === 0) return;
      lbImg.src = src;
      if (lbOpenTab) lbOpenTab.href = src;
      lb.setAttribute('aria-hidden', 'false');
      lb.classList.add('pepe-lightbox-open');
    });
    function closeLightbox() {
      lb.classList.remove('pepe-lightbox-open');
      lb.setAttribute('aria-hidden', 'true');
    }
    if (backdrop) backdrop.addEventListener('click', closeLightbox);
    if (closeBtn) closeBtn.addEventListener('click', closeLightbox);
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && lb.classList.contains('pepe-lightbox-open')) closeLightbox();
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () { run(); initPepeLightbox(); });
  } else {
    run();
    initPepeLightbox();
  }
})();
