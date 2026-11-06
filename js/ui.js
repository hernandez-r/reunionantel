import { EVENTO, fechaLegible, importeLegible } from './config.js';

export function mostrarEvento() {
  const valores = {
    nombre: EVENTO.nombre,
    lugar: EVENTO.lugar,
    fecha: fechaLegible(EVENTO.fecha),
    confirmacion: fechaLegible(EVENTO.limiteConfirmacion),
    pago: fechaLegible(EVENTO.limitePago),
    ticket: importeLegible(EVENTO.ticketReferencia),
    moneda: EVENTO.moneda,
  };
  document.querySelectorAll('[data-evento]').forEach((elemento) => {
    elemento.textContent = valores[elemento.dataset.evento] ?? '';
  });
  const administracion = document.body.classList.contains('pagina-admin');
  document.title = administracion ? `Administración · ${EVENTO.nombre}` : `${EVENTO.nombre} · Inscripciones`;
  const descripcion = document.querySelector('meta[name="description"]');
  if (descripcion) descripcion.content = `Confirmá tu asistencia a ${EVENTO.nombre} en ${EVENTO.lugar}.`;
}

export function mensaje(elemento, texto = '', tipo = 'info') {
  elemento.textContent = texto;
  elemento.className = `mensaje mensaje--${tipo}`;
  elemento.hidden = !texto;
}

export function describirError(error, contexto = 'guardar') {
  const codigo = error?.code ?? '';
  if (codigo.includes('permission-denied')) {
    return 'Firebase rechazó la operación. Verificá el plazo de inscripción, los datos y los permisos. Si administrás el evento, revisá el UID y las reglas.';
  }
  if (['auth/invalid-credential', 'auth/wrong-password', 'auth/user-not-found', 'auth/invalid-email'].includes(codigo)) {
    return 'No se pudo iniciar sesión. Revisá el correo y la contraseña.';
  }
  if (codigo === 'auth/too-many-requests') return 'Demasiados intentos. Esperá unos minutos antes de volver a intentar.';
  if (codigo === 'auth/user-disabled') return 'Esta cuenta está deshabilitada. Contactá a la organización.';
  if (codigo === 'auth/operation-not-allowed') return 'El acceso por correo y contraseña no está habilitado en Firebase.';
  if (codigo.includes('network') || codigo.includes('unavailable')) return 'No hay conexión con Firebase. Revisá Internet y volvé a intentar.';
  if (error?.message?.startsWith('Falta configurar')) return error.message;
  return `No se pudo ${contexto}. Intentá nuevamente. Si persiste, contactá a la organización.`;
}

export function elemento(etiqueta, texto, clase) {
  const nodo = document.createElement(etiqueta);
  if (texto !== undefined) nodo.textContent = texto;
  if (clase) nodo.className = clase;
  return nodo;
}

export function mostrarResumen(contenedor, datos) {
  const lista = elemento('ul', undefined, 'lista-personas');
  lista.append(elemento('li', `${datos.titular} — Titular · Mayor`));
  datos.invitados.forEach((invitado) => {
    lista.append(elemento('li', `${invitado.nombre} — ${invitado.tipo === 'mayor' ? 'Mayor' : 'Menor'}`));
  });
  contenedor.replaceChildren(lista);
}
