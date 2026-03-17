const CACHE = 'jarvis-v1';
const STATIC = ['/', '/index.html', '/manifest.json', '/icon-192.png', '/icon-512.png'];

// Install — cacheia os arquivos estáticos
self.addEventListener('install', function(e) {
  e.waitUntil(
    caches.open(CACHE).then(function(c) {
      return c.addAll(STATIC);
    }).then(function() {
      return self.skipWaiting();
    })
  );
});

// Activate — limpa caches antigos
self.addEventListener('activate', function(e) {
  e.waitUntil(
    caches.keys().then(function(keys) {
      return Promise.all(
        keys.filter(function(k) { return k !== CACHE; })
            .map(function(k) { return caches.delete(k); })
      );
    }).then(function() {
      return self.clients.claim();
    })
  );
});

// Fetch — cache first para estáticos, network only para /api/
self.addEventListener('fetch', function(e) {
  var url = new URL(e.request.url);

  // API calls: sempre vai para a rede, nunca cacheia
  if (url.pathname.startsWith('/api/')) {
    e.respondWith(fetch(e.request));
    return;
  }

  // Estáticos: cache first, fallback para rede
  e.respondWith(
    caches.match(e.request).then(function(cached) {
      if (cached) return cached;
      return fetch(e.request).then(function(res) {
        // Cacheia novas respostas bem-sucedidas
        if (res && res.status === 200 && res.type === 'basic') {
          var clone = res.clone();
          caches.open(CACHE).then(function(c) { c.put(e.request, clone); });
        }
        return res;
      });
    }).catch(function() {
      // Offline fallback: retorna index.html cacheado
      return caches.match('/index.html');
    })
  );
});
