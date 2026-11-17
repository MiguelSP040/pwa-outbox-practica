importScripts('./db-helper.js');

const CACHE_NAME = 'outbox-v6';
const ARCHIVOS = ['./', './index.html', './styles.css', './vendor/bootstrap.min.css', './db-helper.js', './app.js', './manifest.json', './icon.svg'];
const API_URL = 'https://jsonplaceholder.typicode.com/posts';
let sincronizacionActiva = null;

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(ARCHIVOS)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(caches.keys().then((claves) => Promise.all(claves.filter((clave) => clave.startsWith('outbox-') && clave !== CACHE_NAME).map((clave) => caches.delete(clave)))).then(() => self.clients.claim()));
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET' || new URL(event.request.url).origin !== self.location.origin) return;
  event.respondWith(caches.open(CACHE_NAME).then((cache) => cache.match(event.request)).then((respuesta) => respuesta || fetch(event.request)));
});

function avisarClientes() {
  return self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientes) => {
    clientes.forEach((cliente) => cliente.postMessage({ tipo: 'SINCRONIZACION_TERMINADA' }));
  });
}

function sincronizar() {
  if (sincronizacionActiva) return sincronizacionActiva;
  sincronizacionActiva = obtenerTodosLosRegistros().then((registros) => {
    const pendientes = registros.filter((registro) => registro.estado === 'pendiente');
    return Promise.all(pendientes.map((registro) => fetch(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json; charset=UTF-8' },
      body: JSON.stringify({ title: registro.titulo, body: registro.descripcion, userId: 1 })
    }).then((respuesta) => {
      if (!respuesta.ok) throw new Error('El servidor respondió con ' + respuesta.status);
      return actualizarEstadoRegistro(registro.id, 'sincronizado');
    }).then(() => true).catch(() => false))).then((resultados) => {
      return avisarClientes().then(() => {
        if (resultados.includes(false)) throw new Error('Quedan reportes pendientes.');
      });
    });
  }).then(() => { sincronizacionActiva = null; }, (error) => { sincronizacionActiva = null; throw error; });
  return sincronizacionActiva;
}

self.addEventListener('sync', (event) => {
  if (event.tag === 'sync-reportes') event.waitUntil(sincronizar());
});

self.addEventListener('message', (event) => {
  if (event.data && event.data.tipo === 'SINCRONIZAR') {
    event.waitUntil(sincronizar().catch(() => { }));
  }
});
