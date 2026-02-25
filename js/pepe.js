/**
 * Pepe detail page — v1 match: Info/Holders tabs, XCP & PEPECASH DEX order tables
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

  function pepeImageUrl(name) {
    var safe = (name || '').replace(/[^A-Za-z0-9._-]/g, '');
    return safe ? 'archive/pepes/' + safe + '.jpg' : '';
  }

  function placeholderImg() {
    return 'data:image/svg+xml,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="350" height="350" viewBox="0 0 350 350"><rect fill="#e9ecef" width="350" height="350"/><text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle" fill="#6c757d">Pepe</text></svg>');
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
    var imgSrc = pepeImageUrl(asset);
    imgEl.src = imgSrc || placeholderImg();
    imgEl.onerror = function () { this.src = placeholderImg(); };
    document.getElementById('pepe-image-link').href = imgSrc || '#';

    Promise.all([
      fetch('data/RarePepeDirectory_Links.json').then(function (r) { return r.ok ? r.json() : {}; }).catch(function () { return {}; }),
      fetch(API + '/asset/' + encodeURIComponent(asset)).then(function (r) { return r.ok ? r.json() : null; }).catch(function () { return null; }),
      fetch(API + '/holders/' + encodeURIComponent(asset)).then(function (r) { return r.ok ? r.json() : null; }).catch(function () { return null; }),
      fetch(API + '/market/' + encodeURIComponent(asset) + '/XCP/orderbook').then(function (r) { return r.ok ? r.json() : null; }).catch(function () { return null; }),
      fetch(API + '/market/' + encodeURIComponent(asset) + '/PEPECASH/orderbook').then(function (r) { return r.ok ? r.json() : null; }).catch(function () { return null; })
    ]).then(function (results) {
      var links = results[0];
      var assetData = results[1];
      var holdersData = results[2];
      var xcpOrderbook = results[3];
      var pcOrderbook = results[4];

      document.title = asset + ' — RARE PEPE WORLD';

      var rpdUrl = links[asset] || '';
      document.getElementById('pepe-rpd-link').href = rpdUrl || '#';
      document.getElementById('pepe-rpd-link').style.display = rpdUrl ? '' : 'none';
      document.getElementById('pepe-wiki-link').href = 'wiki.html?asset=' + encodeURIComponent(asset);
      document.getElementById('pepe-xchain-link').href = TOKENSCAN + '/asset/' + encodeURIComponent(asset);

      document.getElementById('pepe-name').textContent = asset;

      var supply = '—';
      var divisible = false;
      if (assetData && assetData.supply != null) {
        supply = formatSupply(assetData.supply, assetData.divisible);
        divisible = assetData.divisible;
      }
      document.getElementById('pepe-supply').textContent = supply;

      var series = '—';
      if (assetData && assetData.asset_longname) series = assetData.asset_longname;
      document.getElementById('pepe-series').textContent = series;

      var artist = '—';
      if (assetData && assetData.issuer) {
        artist = '<a class="link-undecorated" href="artist.html?address=' + encodeURIComponent(assetData.issuer) + '">' + escapeHtml(assetData.issuer.slice(0, 8)) + '...</a>';
      }
      document.getElementById('pepe-artist').innerHTML = artist;

      var holders = (holdersData && holdersData.data) ? holdersData.data : [];
      var total = 0;
      holders.forEach(function (h) {
        var q = parseFloat(h.quantity || 0);
        total += q;
      });
      document.getElementById('holders-heading').textContent = asset;
      document.getElementById('holders-supply').innerHTML = 'Real Supply <a href="faq.html"><sup>?</sup></a>: ' + (divisible ? (total / 1e8).toLocaleString() : Math.round(total).toLocaleString());
      var thead = '<th>Holder</th><th>Amount</th>';
      document.getElementById('holders-table-headings').innerHTML = thead;
      var tbody = '';
      holders.slice(0, 10).forEach(function (h) {
        var addr = h.address || '';
        var qty = h.quantity != null ? (divisible ? (parseFloat(h.quantity) * 1e8) : h.quantity) : '0';
        if (divisible) qty = (parseFloat(h.quantity) || 0).toLocaleString(undefined, { maximumFractionDigits: 2 });
        else qty = parseInt(h.quantity, 10).toLocaleString();
        var pct = total > 0 ? ((parseFloat(h.quantity || 0) / total) * 100).toFixed(1) : '0';
        tbody += '<tr><td><a class="link-undecorated" href="address.html?address=' + encodeURIComponent(addr) + '">' + escapeHtml(addr.slice(0, 6) + '...' + addr.slice(-4)) + '</a></td><td>' + qty + ' (' + pct + '%)</td></tr>';
      });
      document.getElementById('holders-table-body').innerHTML = tbody;
      if (holders.length > 10) {
        document.getElementById('holders-more').innerHTML = '<a href="' + TOKENSCAN + '/asset/' + encodeURIComponent(asset) + '">' + (holders.length - 10) + ' more on TokenScan <i class="fa fa-external-link"></i></a>';
      }

      var showXcp = asset !== 'XCP' && (xcpOrderbook && (xcpOrderbook.asks || xcpOrderbook.bids));
      var showPc = asset !== 'PEPECASH' && (pcOrderbook && (pcOrderbook.asks || pcOrderbook.bids));
      document.getElementById('tab-xcp-li').style.display = showXcp ? '' : 'none';
      document.getElementById('tab-pepecash-li').style.display = showPc ? '' : 'none';
      if (showXcp) {
        document.getElementById('xcp-orders').innerHTML = renderOrderTable(xcpOrderbook.asks, xcpOrderbook.bids, 'XCP');
        document.querySelector('#bottomTabs a[href="#xcp"]').classList.add('active');
        document.getElementById('xcp').classList.add('show', 'active');
      }
      if (showPc) {
        document.getElementById('pepecash-orders').innerHTML = renderOrderTable(pcOrderbook.asks, pcOrderbook.bids, 'PEPECASH');
        if (!showXcp) {
          document.querySelector('#bottomTabs a[href="#pepecash"]').classList.add('active');
          document.getElementById('pepecash').classList.add('show', 'active');
        }
      }

      document.getElementById('pepe-loading').classList.add('d-none');
      document.getElementById('pepe-content').classList.remove('d-none');
    }).catch(function (err) {
      console.warn(err);
      document.getElementById('pepe-loading').innerHTML = 'Could not load asset. <a href="' + TOKENSCAN + '/asset/' + encodeURIComponent(asset) + '">View on TokenScan</a>';
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', run);
  else run();
})();
