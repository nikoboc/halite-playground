// モデルのダウンロード（models/ 以下）だけをキャッシュする service worker。
// モデルは合計 130MB ほどあるので、2 回目からはダウンロードさせない
// Service worker that caches only the model downloads (under models/).
// The models total about 130MB, so revisits must not download them again
"use strict";

const CACHE = "halite-models";

self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  // 登録した直後の読み込みから制御する（初回からキャッシュを効かせる）
  // Take control from the very load that registered us (so the first visit already fills the cache)
  event.waitUntil(self.clients.claim());
});

self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);
  if (event.request.method !== "GET" || url.origin !== location.origin || !url.pathname.includes("/models/")) return;
  // 一覧（manifest.json）は常に取り直し、モデル本体はキャッシュ優先
  // Always refetch the manifest; the model bytes are cache first
  if (url.pathname.endsWith("manifest.json")) return;
  event.respondWith((async () => {
    const cache = await caches.open(CACHE);
    const hit = await cache.match(event.request);
    if (hit) return hit;
    const response = await fetch(event.request);
    if (response.ok) await cache.put(event.request, response.clone());
    return response;
  })());
});

self.addEventListener("message", (event) => {
  if (event.data?.type !== "keep") return;
  // ページが伝えてきた今のモデル以外（古いモデル）をキャッシュから消す
  // Drop everything but the models the page just listed (the old ones)
  const keep = new Set(event.data.urls);
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    for (const request of await cache.keys()) {
      if (!keep.has(request.url)) await cache.delete(request);
    }
  })());
});
