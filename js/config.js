// Configuración del evento. No contiene secretos.
export const EVENTO = Object.freeze({
  nombre: 'Reunión de fin de año',
  lugar: 'Club Los Carpinteros',
  fecha: '2026-12-04',
  limiteConfirmacion: '2026-11-27',
  limitePago: '2026-12-01',
  // Cierre al terminar el 27/11 en Uruguay (UTC−3). Sincronizar con firestore.rules.
  cierreInscripciones: '2026-11-28T03:00:00Z',
  zonaHoraria: 'America/Montevideo',
  moneda: 'UYU',
  ticketReferencia: 1000,
  // Entre 0 y 10. Sincronizar con maxInvitados() en firestore.rules.
  maxInvitados: 10,
  // UID de Authentication, NO el correo ni una contraseña. Copiar también en las reglas.
  adminUid: 'REEMPLAZAR_UID_ADMIN',
});

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
    style: 'currency', currency: EVENTO.moneda, maximumFractionDigits: 0,
  }).format(importe);
}
