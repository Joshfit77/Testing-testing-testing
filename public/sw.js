/*
 * Narrow Gate Fitness service worker.
 * - Static build assets and icons: cache-first (light network usage).
 * - Page navigations: network-first; when offline, show the offline page.
 * - Authenticated HTML and API responses are never cached, so no private data is stored by the SW.
 *   (The in-progress workout is persisted separately in localStorage by the app.)
 * - The Bible: when a member chooses "Save for offline", the page stores the public-domain BSB text
 *   (/bible/bsb/*.json) and the offline reader (/bible-offline.html, .js) in the BIBLE_CACHE. Those files are then
 *   answered from that cache, and a Bible page opened without a connection shows the offline reader. The cache holds
 *   Scripture only, never account data, and survives service-worker updates (it is versioned on its own).
 */
const VERSION = "ngf-v1";
const STATIC_CACHE = `${VERSION}-static`;
const OFFLINE_URL = "/offline.html";
const BIBLE_CACHE = "ngf-bible-v1";
const PRECACHE = [OFFLINE_URL, "/icons/icon-192.png", "/icons/icon-512.png", "/icons/icon.svg", "/manifest.webmanifest"];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(STATIC_CACHE).then((cache) => cache.addAll(PRECACHE)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => !k.startsWith(VERSION) && k !== BIBLE_CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  if (request.mode === "navigate") {
    const bible = url.pathname === "/faith/bible" || url.pathname.startsWith("/faith/bible/");
    event.respondWith(
      fetch(request).catch(async () => {
        const reader = bible ? await caches.open(BIBLE_CACHE).then((c) => c.match("/bible-offline.html")) : undefined;
        return reader || caches.match(OFFLINE_URL);
      }),
    );
    return;
  }

  if (url.pathname.startsWith("/bible/bsb/") || url.pathname === "/bible-offline.js" || url.pathname === "/bible-offline.html") {
    event.respondWith(caches.open(BIBLE_CACHE).then((c) => c.match(request, { ignoreSearch: true })).then((hit) => hit || fetch(request)));
    return;
  }

  const isStatic = url.pathname.startsWith("/_next/static/") || url.pathname.startsWith("/icons/") || /\.(?:woff2?|png|svg|ico)$/.test(url.pathname);
  if (isStatic) {
    event.respondWith(
      caches.match(request).then(
        (cached) =>
          cached ||
          fetch(request).then((response) => {
            if (response.ok) {
              const copy = response.clone();
              caches.open(STATIC_CACHE).then((cache) => cache.put(request, copy));
            }
            return response;
          }),
      ),
    );
  }
});
