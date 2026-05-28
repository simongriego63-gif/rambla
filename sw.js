const CACHE_NAME = 'beki-cache-v2'; // Subimos a v2 para que los celulares descarten la memoria vieja

// Lista de archivos clave que el celular debe guardar en memoria
const urlsToCache = [
  './',
  './index.html',
  './caja.html',
  './admin.html',
  './manifest.json',
  './caja.json',   
  './admin.json',   
  './icon.png',
  
  // ¡Agregamos los archivos de las carpetas nuevas!
  './css/style.css',
  './css/caja.css',
  './js/firebase-config.js',
  './js/app.js',
  './js/caja.js'
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
            console.log('Borrando caché antiguo:', cacheName);
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
  // Ignoramos las peticiones a Firebase u otras APIs externas para que no se traben
  if (event.request.url.includes('firestore.googleapis.com') || event.request.url.includes('identitytoolkit')) {
    return;
  }

  event.respondWith(
    caches.match(event.request)
      .then((response) => {
        // Devuelve el archivo del caché si existe, si no, lo pide a internet
        return response || fetch(event.request);
      })
  );
});
