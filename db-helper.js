const DB_NAME = 'pwa-outbox';
const STORE_NAME = 'reportes';

function abrirDB() {
  return new Promise((resolve, reject) => {
    const solicitud = indexedDB.open(DB_NAME, 1);
    solicitud.onupgradeneeded = () => {
      if (!solicitud.result.objectStoreNames.contains(STORE_NAME)) {
        solicitud.result.createObjectStore(STORE_NAME, { keyPath: 'id', autoIncrement: true });
      }
    };
    solicitud.onsuccess = () => resolve(solicitud.result);
    solicitud.onerror = () => reject(solicitud.error);
    solicitud.onblocked = () => reject(new Error('La base de datos está bloqueada por otra pestaña.'));
  });
}

function ejecutarTransaccion(modo, operacion) {
  return abrirDB().then((db) => new Promise((resolve, reject) => {
    let resultado;
    const tx = db.transaction(STORE_NAME, modo);
    const solicitud = operacion(tx.objectStore(STORE_NAME));
    if (solicitud) solicitud.onsuccess = () => { resultado = solicitud.result; };
    tx.oncomplete = () => { db.close(); resolve(resultado); };
    tx.onerror = () => { db.close(); reject(tx.error); };
    tx.onabort = () => { db.close(); reject(tx.error || new Error('Transacción cancelada.')); };
  }));
}

function guardarRegistro(registro) {
  return ejecutarTransaccion('readwrite', (store) => store.add(registro));
}

function obtenerTodosLosRegistros() {
  return ejecutarTransaccion('readonly', (store) => store.getAll());
}

function eliminarRegistro(id) {
  return ejecutarTransaccion('readwrite', (store) => store.delete(id));
}

function actualizarEstadoRegistro(id, estado) {
  return abrirDB().then((db) => new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    const solicitud = store.get(id);
    solicitud.onsuccess = () => {
      if (solicitud.result) {
        solicitud.result.estado = estado;
        solicitud.result.fechaSincronizacion = Date.now();
        store.put(solicitud.result);
      }
    };
    tx.oncomplete = () => { db.close(); resolve(); };
    tx.onerror = () => { db.close(); reject(tx.error); };
    tx.onabort = () => { db.close(); reject(tx.error || new Error('Transacción cancelada.')); };
  }));
}
