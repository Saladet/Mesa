// Mesa · service worker: la app abre sin conexión con lo último que se cargó.
const CACHE = 'mesa-__VERSION__';

self.addEventListener('install', (evento) => {
  evento.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE);
      const res = await fetch('./', { cache: 'no-store' });
      const html = await res.clone().text();
      await cache.put('./', res);
      const recursos = [...html.matchAll(/(?:src|href)="(\.\/assets\/[^"]+)"/g)].map((m) => m[1]);
      await cache.addAll([...new Set([...recursos, './manifest.webmanifest', './icons/icon-192.png', './icons/favicon.svg'])]);
    })().catch(() => {}),
  );
  self.skipWaiting();
});

self.addEventListener('activate', (evento) => {
  evento.waitUntil(
    (async () => {
      for (const clave of await caches.keys()) if (clave !== CACHE) await caches.delete(clave);
      await self.clients.claim();
    })(),
  );
});

async function primeroRed(peticion, clave) {
  const cache = await caches.open(CACHE);
  try {
    const res = await fetch(peticion);
    if (res.ok) cache.put(clave || peticion, res.clone());
    return res;
  } catch (e) {
    const guardada = (await cache.match(clave || peticion)) || (clave ? null : await cache.match('./'));
    if (guardada) return guardada;
    throw e;
  }
}

async function primeroCache(peticion) {
  const cache = await caches.open(CACHE);
  const guardada = await cache.match(peticion);
  if (guardada) return guardada;
  const res = await fetch(peticion);
  if (res.ok || res.type === 'opaque') cache.put(peticion, res.clone());
  return res;
}

self.addEventListener('fetch', (evento) => {
  const peticion = evento.request;
  if (peticion.method !== 'GET') return;
  const url = new URL(peticion.url);
  if (url.origin === self.location.origin) {
    if (peticion.mode === 'navigate') evento.respondWith(primeroRed(peticion, './'));
    else if (url.pathname.includes('/assets/')) evento.respondWith(primeroCache(peticion));
    else evento.respondWith(primeroRed(peticion));
    return;
  }
  // Fotos de los platos (cada foto tiene su propia dirección, no cambian)
  if (url.hostname.endsWith('.supabase.co') && url.pathname.startsWith('/storage/v1/object/public/')) {
    evento.respondWith(primeroCache(peticion));
  }
});
