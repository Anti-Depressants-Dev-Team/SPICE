const SHELL_CACHE = 'spice-shell-v3';
const RUNTIME_CACHE = 'spice-runtime-v3';
const SPICE_CACHE_PREFIX = 'spice-';
const MAX_RUNTIME_ENTRIES = 80;
const SHELL_ASSETS = ['/', '/icon.svg', '/manifest.json'];
const SHELL_READY_MARKER = '/__spice_shell_ready__';

async function prepareShell() {
  const cache = await caches.open(SHELL_CACHE);
  await cache.delete(SHELL_READY_MARKER);
  const rootResponse = await fetch('/').catch(() => null);
  if (!rootResponse?.ok) throw new Error('SPICE shell document could not be cached.');
  await cache.put('/', rootResponse.clone());
  const html = await rootResponse.text();
  const nextAssets = [...html.matchAll(/(?:src|href)=["']([^"']*\/_next\/static\/[^"']+)["']/g)]
    .map((match) => new URL(match[1], self.location.origin).pathname)
    .filter((asset, index, list) => list.indexOf(asset) === index);
  if (nextAssets.length === 0) throw new Error('No Next.js shell assets were discovered.');
  await Promise.all([...SHELL_ASSETS.slice(1), ...nextAssets].map((asset) => cache.add(asset)));
  await cache.put(SHELL_READY_MARKER, new Response(JSON.stringify({ nextAssets }), {
    headers: { 'Content-Type': 'application/json' },
  }));
}

async function trimRuntimeCache() {
  const cache = await caches.open(RUNTIME_CACHE);
  const keys = await cache.keys();
  await Promise.all(keys.slice(0, Math.max(0, keys.length - MAX_RUNTIME_ENTRIES)).map((key) => cache.delete(key)));
}

self.addEventListener('install', (event) => {
  event.waitUntil(prepareShell());
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys
      .filter((key) => key.startsWith(SPICE_CACHE_PREFIX) && key !== SHELL_CACHE && key !== RUNTIME_CACHE)
      .map((key) => caches.delete(key)));
    await self.clients.claim();
  })());
});

self.addEventListener('message', (event) => {
  if (event.data?.type !== 'SPICE_CACHE_REPAIR') return;
  event.waitUntil((async () => {
    try {
      const keys = await caches.keys();
      await Promise.all(keys.filter((key) => key.startsWith(SPICE_CACHE_PREFIX)).map((key) => caches.delete(key)));
      await prepareShell();
      event.ports[0]?.postMessage({ type: 'SPICE_CACHE_REPAIRED' });
      event.source?.postMessage?.({ type: 'SPICE_CACHE_REPAIRED' });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Offline shell repair failed.';
      event.ports[0]?.postMessage({ type: 'SPICE_CACHE_REPAIR_FAILED', message });
      event.source?.postMessage?.({ type: 'SPICE_CACHE_REPAIR_FAILED', message });
    }
  })());
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (
    url.origin !== self.location.origin
    || url.pathname.startsWith('/api/')
    || request.headers.has('range')
    || request.destination === 'audio'
    || request.destination === 'video'
  ) {
    return;
  }

  if (request.mode === 'navigate') {
    const network = fetch(request);
    event.waitUntil(network.then(async (response) => {
      if (!response.ok) return;
      const cache = await caches.open(SHELL_CACHE);
      await cache.put(request, response.clone()).catch(() => undefined);
    }).catch(() => undefined));
    event.respondWith(network.catch(async () => (
      (await caches.match(request)) || (await caches.match('/')) || Response.error()
    )));
    return;
  }

  if (!['script', 'style', 'font', 'image', 'worker'].includes(request.destination)) return;
  event.respondWith((async () => {
    const shellCache = await caches.open(SHELL_CACHE);
    const shellAsset = await shellCache.match(request);
    if (shellAsset) return shellAsset;

    const runtimeCache = await caches.open(RUNTIME_CACHE);
    const cached = await runtimeCache.match(request);
    if (cached) return cached;

    const response = await fetch(request);
    if (response.ok && response.type === 'basic') {
      await runtimeCache.put(request, response.clone()).catch(() => undefined);
      await trimRuntimeCache().catch(() => undefined);
    }
    return response;
  })());
});
