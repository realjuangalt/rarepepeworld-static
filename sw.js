/**
 * Rare Pepe World service worker — cache pepes + static data on GitHub Pages.
 * TokenScan / cross-origin: network only (never cached here).
 * Bump CACHE_VERSION when shipping breaking asset URL changes.
 */
/* eslint-disable no-restricted-globals */
var CACHE_VERSION = 'v1';
var PEPE_CACHE = 'rpw-pepes-' + CACHE_VERSION;
var DATA_CACHE = 'rpw-data-' + CACHE_VERSION;
var STATIC_CACHE = 'rpw-static-' + CACHE_VERSION;
var KNOWN_PREFIXES = [PEPE_CACHE, DATA_CACHE, STATIC_CACHE];

function shouldHandle(request) {
  if (request.method !== 'GET') return false;
  var url;
  try {
    url = new URL(request.url);
  } catch (e) {
    return false;
  }
  if (url.origin !== self.location.origin) return false;
  return true;
}

function isPepeImage(pathname) {
  return pathname.indexOf('/archive/pepes/') !== -1;
}

function isDataJson(pathname) {
  return pathname.indexOf('/data/') !== -1 && pathname.slice(-5) === '.json';
}

function isStaticAsset(pathname) {
  return (
    pathname.indexOf('/css/') !== -1 ||
    pathname.indexOf('/js/') !== -1 ||
    pathname.indexOf('/images/') !== -1 ||
    /\.(css|js)$/.test(pathname)
  );
}

function cachePutOk(cacheName, request, response) {
  if (!response || !response.ok) return response;
  var copy = response.clone();
  caches.open(cacheName).then(function (cache) {
    cache.put(request, copy);
  }).catch(function () {});
  return response;
}

function cacheFirst(cacheName, request) {
  return caches.open(cacheName).then(function (cache) {
    return cache.match(request).then(function (cached) {
      if (cached) return cached;
      return fetch(request).then(function (response) {
        return cachePutOk(cacheName, request, response);
      });
    });
  });
}

function staleWhileRevalidate(cacheName, request) {
  return caches.open(cacheName).then(function (cache) {
    return cache.match(request).then(function (cached) {
      var network = fetch(request).then(function (response) {
        return cachePutOk(cacheName, request, response);
      }).catch(function () {
        return cached || Response.error();
      });
      return cached || network;
    });
  });
}

self.addEventListener('install', function (event) {
  self.skipWaiting();
});

self.addEventListener('activate', function (event) {
  event.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(
        keys.map(function (key) {
          if (key.indexOf('rpw-') === 0 && KNOWN_PREFIXES.indexOf(key) === -1) {
            return caches.delete(key);
          }
          return null;
        })
      );
    }).then(function () {
      return self.clients.claim();
    })
  );
});

self.addEventListener('fetch', function (event) {
  var request = event.request;
  if (!shouldHandle(request)) return;

  var pathname = '';
  try {
    pathname = new URL(request.url).pathname;
  } catch (e) {
    return;
  }

  if (isPepeImage(pathname)) {
    event.respondWith(cacheFirst(PEPE_CACHE, request));
    return;
  }
  if (isDataJson(pathname)) {
    event.respondWith(staleWhileRevalidate(DATA_CACHE, request));
    return;
  }
  if (isStaticAsset(pathname)) {
    event.respondWith(staleWhileRevalidate(STATIC_CACHE, request));
  }
});
