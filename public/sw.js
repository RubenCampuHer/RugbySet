// Service worker mínimo (F5 del plan): cachea el shell estático para que la
// PWA arranque offline. Los datos vienen de RTDB por WebSocket, que no pasa
// por el SW — sin conexión se ve el shell con estados de carga.
//
// CACHE debe subir de número en cualquier deploy que toque este archivo (o
// que quieras forzar a purgar cachés viejas) — activate() borra cualquier
// caché que no coincida con el nombre actual. Bug real 2026-09-04: se
// quedó fijo en "v1" desde el principio, así que esa limpieza nunca hizo
// nada en la práctica.
const CACHE = "rugbyset-shell-v2";
const SHELL = ["/", "/login", "/exercises", "/manifest.webmanifest"];

// Con skipWaiting() automático, una pestaña abierta durante el deploy pasaba
// a ejecutar el SW nuevo (y sus caches) a media navegación sin avisar. Ahora
// solo se activa al momento cuando lo pide la propia pestaña (ver
// RegisterSW.tsx: aviso "hay versión nueva" → botón "Recargar").
self.addEventListener("message", (event) => {
  if (event.data?.type === "SKIP_WAITING") self.skipWaiting();
});

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(SHELL)));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);
  // Solo GET del propio origen; nunca interceptar Firebase/googleapis.
  if (event.request.method !== "GET" || url.origin !== self.location.origin) return;

  // Assets estáticos con hash: cache-first. Documentos: network-first con
  // fallback a caché (para funcionar offline tras la primera visita).
  if (url.pathname.startsWith("/_next/static/") || url.pathname.startsWith("/icons/")) {
    event.respondWith(
      caches.match(event.request).then(
        (hit) =>
          hit ??
          fetch(event.request).then((res) => {
            const copy = res.clone();
            void caches.open(CACHE).then((cache) => cache.put(event.request, copy));
            return res;
          }),
      ),
    );
  } else {
    event.respondWith(
      fetch(event.request)
        .then((res) => {
          const copy = res.clone();
          void caches.open(CACHE).then((cache) => cache.put(event.request, copy));
          return res;
        })
        .catch(() => caches.match(event.request).then((hit) => hit ?? caches.match("/"))),
    );
  }
});
