import { doc, onSnapshot, runTransaction, serverTimestamp } from 'https://www.gstatic.com/firebasejs/12.6.0/firebase-firestore.js';
import { aplicarEvento } from './config.js';
import { configuracionADocumento, configuracionDesdeDocumento } from './evento-datos.js';

function versionDocumento(datos) {
  const fecha = datos?.actualizadoEn;
  if (!fecha || !Number.isInteger(fecha.seconds) || !Number.isInteger(fecha.nanoseconds)) {
    throw new Error('La configuración no tiene una fecha de actualización válida.');
  }
  return `${fecha.seconds}:${fecha.nanoseconds}`;
}

export function observarEvento(db, alActualizar, alError) {
  return onSnapshot(doc(db, 'configuracion', 'evento'), { includeMetadataChanges: true }, (snapshot) => {
    // Solo habilitar altas con una configuración confirmada por el servidor.
    if (snapshot.metadata.fromCache || snapshot.metadata.hasPendingWrites) return;
    try {
      if (!snapshot.exists()) { alActualizar(null); return; }
      const datos = snapshot.data();
      const configuracion = configuracionDesdeDocumento(datos);
      const version = versionDocumento(datos);
      aplicarEvento(configuracion);
      alActualizar({ ...configuracion, version });
    } catch (error) {
      alError(error);
    }
  }, alError);
}

export async function guardarEvento(db, datos, versionEsperada) {
  const documento = configuracionADocumento(datos);
  const referencia = doc(db, 'configuracion', 'evento');
  await runTransaction(db, async (transaccion) => {
    const actual = await transaccion.get(referencia);
    const versionActual = actual.exists() ? versionDocumento(actual.data()) : null;
    if (versionActual !== versionEsperada) {
      const error = new Error('La configuración cambió en otra pestaña. Presioná “Descartar cambios” para cargar la versión actual antes de editar nuevamente.');
      error.code = 'evento/configuracion-modificada';
      throw error;
    }
    transaccion.set(referencia, { ...documento, actualizadoEn: serverTimestamp() });
  });
}
