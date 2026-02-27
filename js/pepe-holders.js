/**
 * Pepe Holders page — sub-page of asset: lists holders and Real Supply.
 * Linked from pepe.html as "View holders →".
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
    var d = document.createElement('div');
    d.textContent = s;
    return d.innerHTML;
  }

  function run() {
    var asset = getAssetFromQuery();
    if (!asset) {
      document.getElementById('holders-loading').textContent = 'No asset specified. Use ?asset=NAME';
      return;
    }

    document.getElementById('holders-loading').classList.remove('d-none');
    document.getElementById('holders-content').classList.add('d-none');

    Promise.all([
      fetch(API + '/asset/' + encodeURIComponent(asset)).then(function (r) { return r.ok ? r.json() : null; }).catch(function () { return null; }),
      fetch(API + '/holders/' + encodeURIComponent(asset)).then(function (r) { return r.ok ? r.json() : null; }).catch(function () { return null; }),
      fetch('data/burn_addresses.json').then(function (r) { return r.ok ? r.json() : []; }).catch(function () { return []; }),
      fetch('data/asset_metadata.json').then(function (r) { return r.ok ? r.json() : {}; }).catch(function () { return {}; })
    ]).then(function (results) {
      var assetData = results[0];
      var holdersData = results[1];
      var burnAddresses = results[2] || [];
      var assetMetadata = results[3] || {};
      var burnSet = {};
      burnAddresses.forEach(function (addr) { if (addr) burnSet[addr] = true; });

      document.title = asset + ' — Holders — RARE PEPE WORLD';
      document.getElementById('holders-asset-name').textContent = asset;
      document.getElementById('holders-back-link').textContent = asset;
      document.getElementById('holders-back-link').href = 'pepe.html?asset=' + encodeURIComponent(asset);

      var divisible = false;
      var supplyEntry = assetMetadata[asset];
      if (supplyEntry && supplyEntry.issued != null && supplyEntry.issued !== '' && !supplyEntry.note) {
        divisible = supplyEntry.divisible || false;
      } else if (assetData && assetData.divisible != null) {
        divisible = assetData.divisible;
      }

      var holders = (holdersData && holdersData.data) ? holdersData.data : [];
      var total = 0;
      var burnTotal = 0;
      holders.forEach(function (h) {
        var q = parseFloat(h.quantity || 0);
        total += q;
        if (burnSet[h.address]) burnTotal += q;
      });
      var realSupply = total - burnTotal;
      if (realSupply < 0) realSupply = 0;

      var apiFailed = !assetData && holders.length === 0;
      var holdersSupplyEl = document.getElementById('holders-supply');
      holdersSupplyEl.innerHTML = 'Real Supply <a href="faq.html"><sup>?</sup></a>: ' + (holders.length ? (divisible ? realSupply.toLocaleString(undefined, { maximumFractionDigits: 8 }) : Math.round(realSupply).toLocaleString()) : '—');
      if (apiFailed && holders.length === 0) {
        holdersSupplyEl.innerHTML += ' <span class="text-muted small">(live data temporarily unavailable)</span>';
      }

      document.getElementById('holders-table-headings').innerHTML = '<th>Holder</th><th>Amount</th>';
      var showCount = 10;
      var tbody = '';
      if (holders.length === 0 && apiFailed) {
        tbody = '<tr><td colspan="2" class="text-muted">Live holder data is temporarily unavailable. Check back soon.</td></tr>';
      }
      holders.slice(0, showCount).forEach(function (h) {
        var addr = h.address || '';
        var qty = h.quantity != null ? (divisible ? (parseFloat(h.quantity) * 1e8) : h.quantity) : '0';
        if (divisible) qty = (parseFloat(h.quantity) || 0).toLocaleString(undefined, { maximumFractionDigits: 2 });
        else qty = parseInt(h.quantity, 10).toLocaleString();
        var pct = total > 0 ? ((parseFloat(h.quantity || 0) / total) * 100).toFixed(1) : '0';
        tbody += '<tr><td><a class="link-undecorated" href="address.html?address=' + encodeURIComponent(addr) + '">' + escapeHtml(addr.slice(0, 6) + '...' + addr.slice(-4)) + '</a></td><td>' + qty + ' (' + pct + '%)</td></tr>';
      });
      if (holders.length > showCount) {
        var remainingQty = 0;
        holders.slice(showCount).forEach(function (h) { remainingQty += parseFloat(h.quantity || 0); });
        var remainingPct = total > 0 ? ((remainingQty / total) * 100).toFixed(1) : '0';
        var remainingStr = divisible ? remainingQty.toLocaleString(undefined, { maximumFractionDigits: 2 }) : Math.round(remainingQty).toLocaleString();
        tbody += '<tr><td><a class="link-undecorated" href="' + TOKENSCAN + '/asset/' + encodeURIComponent(asset) + '" target="_blank" rel="noopener">' + (holders.length - showCount) + ' more… <i class="fa fa-external-link"></i></a></td><td>' + remainingStr + ' (' + remainingPct + '%)</td></tr>';
      }
      document.getElementById('holders-table-body').innerHTML = tbody;
      if (holders.length > showCount) {
        document.getElementById('holders-more').innerHTML = '<a href="' + TOKENSCAN + '/asset/' + encodeURIComponent(asset) + '" target="_blank" rel="noopener">View all holders on TokenScan <i class="fa fa-external-link"></i></a>';
      } else {
        document.getElementById('holders-more').innerHTML = '';
      }

      document.getElementById('holders-loading').classList.add('d-none');
      document.getElementById('holders-content').classList.remove('d-none');
    }).catch(function (err) {
      console.warn(err);
      document.getElementById('holders-loading').innerHTML = 'Something went wrong. <a href="pepe-holders.html?asset=' + encodeURIComponent(asset) + '">Try again</a> or <a href="pepe.html?asset=' + encodeURIComponent(asset) + '">back to asset</a>.';
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', run);
  else run();
})();
