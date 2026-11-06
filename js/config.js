import { cierreDelDia, validarConfiguracionEvento } from './evento-datos.js';

// Valores iniciales para el primer guardado desde el panel. Después manda Firestore.
// El UID, la moneda, la zona horaria y el máximo no son editables desde el formulario.
export const EVENTO_INICIAL = Object.freeze({
  nombre: 'Reunión de fin de año',
  lugar: 'Club Los Carpinteros',
  fecha: '2026-12-04',
  limiteConfirmacion: '2026-11-27',
  limitePago: '2026-12-01',
  zonaHoraria: 'America/Montevideo',
  moneda: 'UYU',
  ticketReferencia: 1000,
  // Entre 0 y 10. Sincronizar con maxInvitados() en firestore.rules.
  maxInvitados: 10,
  // UID de Authentication, NO el correo ni una contraseña. Copiar también en las reglas.
  adminUid: 'ZM7oO3DxIqYFWnGLYANS9s6Erar1',
});

// Los imports ES reciben esta referencia actualizada cuando cambia la configuración.
export let EVENTO = Object.freeze({ ...EVENTO_INICIAL, cierreInscripciones: cierreDelDia(EVENTO_INICIAL.limiteConfirmacion) });

export function aplicarEvento(datos) {
  const error = validarConfiguracionEvento(datos);
  if (error) throw new Error(error);
  EVENTO = Object.freeze({
    ...EVENTO_INICIAL,
    nombre: datos.nombre,
    lugar: datos.lugar,
    fecha: datos.fecha,
    limiteConfirmacion: datos.limiteConfirmacion,
    limitePago: datos.limitePago,
    ticketReferencia: datos.ticketReferencia,
    cierreInscripciones: cierreDelDia(datos.limiteConfirmacion),
  });
}

export function inscripcionesAbiertas(ahora = new Date()) {
  return ahora.getTime() < Date.parse(EVENTO.cierreInscripciones);
}

export function fechaLegible(fecha) {
  return new Intl.DateTimeFormat('es-UY', {
    day: 'numeric', month: 'long', year: 'numeric', timeZone: EVENTO.zonaHoraria,
  }).format(new Date(`${fecha}T12:00:00-03:00`));
}

export function importeLegible(importe) {
  return new Intl.NumberFormat('es-UY', {
    style: 'currency', currency: EVENTO.moneda,
    minimumFractionDigits: Number.isInteger(importe) ? 0 : 2, maximumFractionDigits: 2,
  }).format(importe);
}
