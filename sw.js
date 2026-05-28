const CACHE_NAME = 'beki-cache-v1'; // Nombre actualizado a beki

// Lista de archivos clave que el celular debe guardar en memoria
const urlsToCache = [
  './',
  './index.html',
  './barista.html',
  './admin.html',
  './manifest.json',
  './manifest-barista.json', // Agregamos el de la caja
  './manifest-admin.json',   // Agregamos el del panel
  './icon.png'
];

// 1. INSTALACIÓN: Guarda los archivos en caché
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('Archivos de beki cacheados correctamente');
        return cache.addAll(urlsToCache);
      })
  );
  // Fuerza al Service Worker a activarse inmediatamente
  self.skipWaiting(); 
});

// 2. ACTIVACIÓN: Limpia cachés viejos si actualizas la app
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
  self.clients.claim();
});

// 3. FETCH: Sirve los archivos desde el caché para que cargue rapidísimo
self.addEventListener('fetch', (event) => {
  event.respondWith(
    caches.match(event.request)
      .then((response) => {
        // Devuelve el archivo del caché si existe, si no, lo pide a internet
        return response || fetch(event.request);
      })
  );
});
