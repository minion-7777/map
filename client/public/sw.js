const SHELL_CACHE = "dandong-shell-v1";
const TILE_CACHE = "dandong-tiles-v1";
const TILE_HOST = "tile.openstreetmap.org";

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(SHELL_CACHE).then((cache) =>
      Promise.all(
        ["/", "/manifest.webmanifest", "/icon.svg", "/tile-empty.png"].map((url) =>
          cache.add(url).catch(() => undefined)
        )
      )
    )
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key !== SHELL_CACHE && key !== TILE_CACHE)
            .map((key) => caches.delete(key))
        )
      )
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  const url = new URL(request.url);

  if (url.pathname.startsWith("/api/")) {
    event.respondWith(forwardLocalApi(request));
    return;
  }

  if (request.method !== "GET") return;
  if (url.port === "3000") return;

  if (url.hostname === TILE_HOST) {
    event.respondWith(tileCache(request));
    return;
  }

  if (url.origin !== self.location.origin) return;

  if (url.pathname === "/sw.js") {
    event.respondWith(fetch(request).catch(() => caches.match(request)));
    return;
  }

  if (request.mode === "navigate") {
    event.respondWith(networkFirstPage(request));
    return;
  }

  event.respondWith(cacheFirst(request, SHELL_CACHE));
});

async function forwardLocalApi(request) {
  const incoming = new URL(request.url);
  const target = `http://127.0.0.1:4000${incoming.pathname}${incoming.search}`;
  const init = { method: request.method, headers: new Headers(request.headers), redirect: "follow" };
  if (request.method !== "GET" && request.method !== "HEAD") {
    init.body = await request.arrayBuffer();
  }
  try {
    return await fetch(target, init);
  } catch {
    return fetch(request);
  }
}

async function tileCache(request) {
  const cache = await caches.open(TILE_CACHE);
  const cached = await matchTile(cache, request);
  if (cached) return cached;
  try {
    const response = await fetch(request);
    if (response.ok || response.type === "opaque") {
      await cache.put(request, response.clone());
    }
    return response;
  } catch (error) {
    const fallback = await caches.match("/tile-empty.png");
    if (fallback) return fallback;
    throw error;
  }
}

async function matchTile(cache, request) {
  return (
    (await cache.match(request, { ignoreSearch: true, ignoreVary: true })) ||
    (await cache.match(request.url, { ignoreVary: true }))
  );
}

async function cacheFirst(request, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);
  if (cached) return cached;
  const response = await fetch(request);
  if (response.ok) await cache.put(request, response.clone());
  return response;
}

async function networkFirstPage(request) {
  const cache = await caches.open(SHELL_CACHE);
  try {
    const response = await fetch(request);
    if (response.ok) {
      await cache.put("/", response.clone());
      await cache.put(request, response.clone());
    }
    return response;
  } catch (error) {
    return (await cache.match(request)) || (await cache.match("/")) || Promise.reject(error);
  }
}
