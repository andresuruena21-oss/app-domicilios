// ===== Service worker: hace que la app cargue rápido y se pueda instalar =====
// Cada vez que cambies archivos, sube este número (v1 -> v2) para que el celular tome la versión nueva.
const VERSION = 'domicilios-v1';

// Archivos de la app que se guardan en el celular
const ARCHIVOS = [
  './',
  './index.html',
  './menu.html',
  './nuevo.html',
  './pedidos.html',
  './cierre.html',
  './reportes.html',
  './mensajeros.html',
  './respaldo.html',
  './manifest.json',
  './css/estilos.css',
  './css/nuevo.css',
  './css/pedidos.css',
  './css/cierre.css',
  './css/reportes.css',
  './css/mensajeros.css',
  './css/respaldo.css',
  './js/config.js',
  './js/sesion.js',
  './js/login.js',
  './js/menu.js',
  './js/nuevo.js',
  './js/pedidos.js',
  './js/cierre.js',
  './js/reportes.js',
  './js/mensajeros.js',
  './js/respaldo.js',
  './js/exportar.js',
  './icons/icon-192.png',
  './icons/icon-512.png'
];

// 1. Al instalar: guarda todos los archivos
self.addEventListener('install', (evento) => {
  evento.waitUntil(caches.open(VERSION).then((cache) => cache.addAll(ARCHIVOS)));
  self.skipWaiting();
});

// 2. Al activar: borra las versiones viejas
self.addEventListener('activate', (evento) => {
  evento.waitUntil(
    caches.keys().then((nombres) =>
      Promise.all(nombres.filter((n) => n !== VERSION).map((n) => caches.delete(n)))
    )
  );
  self.clients.claim();
});

// 3. Al pedir un archivo: primero internet (para tener lo más nuevo),
//    si no hay internet, la copia guardada.
//    Los datos de Supabase NO se guardan aquí: siempre van a internet.
self.addEventListener('fetch', (evento) => {
  const pedido = evento.request;
  const esDeLaApp = new URL(pedido.url).origin === self.location.origin;
  if (pedido.method !== 'GET' || !esDeLaApp) return;

  evento.respondWith(
    fetch(pedido)
      .then((respuesta) => {
        const copia = respuesta.clone();
        caches.open(VERSION).then((cache) => cache.put(pedido, copia));
        return respuesta;
      })
      .catch(() => caches.match(pedido, { ignoreSearch: true }))
  );
});