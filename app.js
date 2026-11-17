const formulario = document.getElementById('formulario');
const lista = document.getElementById('lista');
const aviso = document.getElementById('aviso');
const conexion = document.getElementById('conexion');
const contador = document.getElementById('contador');
const purgar = document.getElementById('purgar');
const enviar = document.getElementById('enviar');
const API_URL = 'https://jsonplaceholder.typicode.com/posts';
let registroSW;

function mostrarAviso(mensaje) {
  aviso.textContent = mensaje;
}

function actualizarConexion() {
  conexion.textContent = navigator.onLine ? 'En línea' : 'Sin conexión';
  conexion.classList.toggle('text-bg-success', navigator.onLine);
  conexion.classList.toggle('text-bg-warning', !navigator.onLine);
}

function renderizar() {
  return obtenerTodosLosRegistros().then((registros) => {
    lista.replaceChildren();
    const pendientes = registros.filter((registro) => registro.estado === 'pendiente').length;
    contador.textContent = pendientes + (pendientes === 1 ? ' pendiente' : ' pendientes');
    purgar.disabled = !registros.some((registro) => registro.estado === 'sincronizado');
    document.getElementById('vacio').hidden = registros.length > 0;
    registros.reverse().forEach((registro) => {
      const articulo = document.createElement('article');
      articulo.className = 'card border bg-body-tertiary';
      const cuerpo = document.createElement('div');
      cuerpo.className = 'card-body p-3';
      const cabecera = document.createElement('div');
      cabecera.className = 'd-flex flex-wrap justify-content-between align-items-start gap-2';
      const titulo = document.createElement('p');
      titulo.className = 'reporte-titulo fw-semibold mb-0';
      titulo.textContent = registro.titulo;
      const estado = document.createElement('span');
      estado.className = 'badge rounded-pill flex-shrink-0 ' + (registro.estado === 'pendiente' ? 'text-bg-warning' : 'text-bg-success');
      estado.textContent = registro.estado === 'pendiente' ? 'Pendiente' : 'Sincronizado';
      const descripcion = document.createElement('p');
      descripcion.className = 'reporte-descripcion text-body-secondary small my-2';
      descripcion.textContent = registro.descripcion;
      const fecha = document.createElement('time');
      fecha.className = 'text-body-secondary small';
      fecha.dateTime = new Date(registro.fechaCreacion).toISOString();
      fecha.textContent = new Date(registro.fechaCreacion).toLocaleString('es-MX', { dateStyle: 'medium', timeStyle: 'short' });
      cabecera.append(titulo, estado);
      cuerpo.append(cabecera, descripcion, fecha);
      articulo.append(cuerpo);
      lista.append(articulo);
    });
  }).catch(() => mostrarAviso('No fue posible leer la base de datos local.'));
}

function solicitarSincronizacion() {
  if (!registroSW) return Promise.resolve();
  if ('sync' in registroSW) {
    return registroSW.sync.register('sync-reportes').catch(() => {
      if (navigator.onLine && registroSW.active) registroSW.active.postMessage({ tipo: 'SINCRONIZAR' });
    });
  }
  if (navigator.onLine && registroSW.active) registroSW.active.postMessage({ tipo: 'SINCRONIZAR' });
  return Promise.resolve();
}

formulario.addEventListener('submit', (event) => {
  event.preventDefault();
  const titulo = formulario.titulo.value.trim();
  const descripcion = formulario.descripcion.value.trim();
  if (!titulo || !descripcion) { mostrarAviso('Completa el título y la descripción.'); return; }
  enviar.disabled = true;
  const registro = { titulo, descripcion, estado: 'pendiente', fechaCreacion: Date.now() };
  fetch(API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json; charset=UTF-8' },
    body: JSON.stringify({ title: titulo, body: descripcion, userId: 1 })
  }).then((respuesta) => {
    if (!respuesta.ok) throw new Error('No se pudo enviar el reporte.');
    registro.estado = 'sincronizado';
    registro.fechaSincronizacion = Date.now();
  }).catch(() => { }).then(() => guardarRegistro(registro)).then(() => {
    formulario.reset();
    mostrarAviso(registro.estado === 'pendiente' ? 'Reporte guardado en este dispositivo. Se enviará cuando haya conexión.' : 'Reporte enviado correctamente.');
    return renderizar();
  }).then(() => {
    if (registro.estado === 'pendiente') return solicitarSincronizacion();
  }).catch(() => mostrarAviso('No fue posible guardar el reporte. Inténtalo de nuevo.')).then(() => { enviar.disabled = false; });
});

purgar.addEventListener('click', () => {
  purgar.disabled = true;
  obtenerTodosLosRegistros().then((registros) => Promise.all(registros.filter((registro) => registro.estado === 'sincronizado').map((registro) => eliminarRegistro(registro.id))))
    .then(() => { mostrarAviso('Reportes sincronizados eliminados de este dispositivo.'); return renderizar(); })
    .catch(() => { mostrarAviso('No fue posible purgar los reportes.'); return renderizar(); });
});

window.addEventListener('online', () => {
  actualizarConexion();
  if (!registroSW || !('sync' in registroSW)) solicitarSincronizacion();
});
window.addEventListener('offline', actualizarConexion);

if ('serviceWorker' in navigator) {
  navigator.serviceWorker.addEventListener('message', (event) => {
    if (event.data && event.data.tipo === 'SINCRONIZACION_TERMINADA') renderizar();
  });
  navigator.serviceWorker.register('./sw.js').then(() => navigator.serviceWorker.ready).then((registro) => {
    registroSW = registro;
    return obtenerTodosLosRegistros();
  }).then((registros) => {
    if (registros.some((registro) => registro.estado === 'pendiente')) return solicitarSincronizacion();
  }).catch(() => mostrarAviso('No se pudo iniciar el modo sin conexión. Usa localhost o HTTPS.'));
} else {
  mostrarAviso('Este navegador no admite Service Workers; el envío en segundo plano no está disponible.');
}
actualizarConexion();
renderizar();
