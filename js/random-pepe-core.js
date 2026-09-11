/**
 * Shared random pepe catalog + image preload helpers (GitHub Pages static).
 * Exposes window.RandomPepeCore.
 */
(function () {
  'use strict';

  var catalogCache = null;
  var catalogPromise = null;

  function flattenSeriesNames(seriesData) {
    var list = [];
    if (!seriesData || typeof seriesData !== 'object') return list;
    Object.keys(seriesData).forEach(function (seriesNum) {
      if (seriesNum === '_meta') return;
      var names = seriesData[seriesNum];
      if (!Array.isArray(names)) return;
      names.forEach(function (name) {
        if (name) list.push(String(name).toUpperCase());
      });
    });
    return list;
  }

  function loadCatalog() {
    if (catalogCache) return Promise.resolve(catalogCache);
    if (catalogPromise) return catalogPromise;
    catalogPromise = fetch('data/RarePepeDirectory_Series_Data.json')
      .then(function (r) { return r.ok ? r.json() : {}; })
      .then(function (seriesData) {
        catalogCache = flattenSeriesNames(seriesData);
        return catalogCache;
      })
      .catch(function () {
        catalogCache = [];
        return catalogCache;
      });
    return catalogPromise;
  }

  function randomIndex(length) {
    if (length <= 0) return 0;
    if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
      var max = 0x100000000;
      var limit = max - (max % length);
      var buf = new Uint32Array(1);
      var value;
      do {
        crypto.getRandomValues(buf);
        value = buf[0];
      } while (value >= limit);
      return value % length;
    }
    return Math.floor(Math.random() * length);
  }

  function pickRandomAsset(names, excludeName) {
    if (!names || !names.length) return null;
    var excludes = {};
    if (Array.isArray(excludeName)) {
      excludeName.forEach(function (n) {
        if (n) excludes[String(n).toUpperCase()] = true;
      });
    } else if (excludeName) {
      excludes[String(excludeName).toUpperCase()] = true;
    }
    var pool = names;
    if (Object.keys(excludes).length && names.length > 1) {
      pool = names.filter(function (n) { return !excludes[n]; });
      if (!pool.length) pool = names;
    }
    return pool[randomIndex(pool.length)];
  }

  function imageUrlFor(name) {
    if (typeof window.pepeImageUrlFirst === 'function') {
      return window.pepeImageUrlFirst(name);
    }
    var safe = (name || '').replace(/[^A-Za-z0-9._-]/g, '');
    return safe ? 'archive/pepes/' + safe + '.gif' : '';
  }

  /** Start loading an image URL; resolves when loaded or errored. */
  function preloadUrl(url) {
    return new Promise(function (resolve) {
      if (!url) {
        resolve({ url: url, ok: false });
        return;
      }
      var img = new Image();
      img.onload = function () { resolve({ url: url, ok: true, img: img }); };
      img.onerror = function () { resolve({ url: url, ok: false, img: img }); };
      img.src = url;
    });
  }

  function preloadAsset(name) {
    var url = imageUrlFor(name);
    return preloadUrl(url).then(function (result) {
      result.name = name;
      result.imgUrl = url;
      return result;
    });
  }

  window.RandomPepeCore = {
    flattenSeriesNames: flattenSeriesNames,
    loadCatalog: loadCatalog,
    randomIndex: randomIndex,
    pickRandomAsset: pickRandomAsset,
    imageUrlFor: imageUrlFor,
    preloadUrl: preloadUrl,
    preloadAsset: preloadAsset
  };
})();
