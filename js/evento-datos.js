// Fechas de calendario en Uruguay (UTC−3), sin depender de la zona del dispositivo.
const UN_DIA = 86_400_000;
const DESFASE_URUGUAY = 3 * 60 * 60 * 1000;

export function fechaValida(fecha) {
  if (typeof fecha !== 'string' || !/^\d{4}-\d{2}-\d{2}$/u.test(fecha)) return false;
  const instante = Date.parse(`${fecha}T00:00:00Z`);
  return Number.isFinite(instante) && fecha >= '2020-01-01' && fecha <= '2100-12-31'
    && new Date(instante).toISOString().slice(0, 10) === fecha;
}

export function inicioDiaUruguay(fecha) {
  if (!fechaValida(fecha)) throw new Error('La fecha ingresada no es válida.');
  return new Date(`${fecha}T00:00:00-03:00`);
}

export function cierreDelDia(fecha) {
  return new Date(inicioDiaUruguay(fecha).getTime() + UN_DIA).toISOString();
}

export function normalizarTextoEvento(texto) {
  return String(texto ?? '').trim().replace(/\s+/gu, ' ');
}

export function validarConfiguracionEvento(datos) {
  if (typeof datos.nombre !== 'string' || datos.nombre.length < 3 || datos.nombre.length > 120
      || normalizarTextoEvento(datos.nombre) !== datos.nombre) {
    return 'Ingresá un nombre de evento de entre 3 y 120 caracteres.';
  }
  if (typeof datos.lugar !== 'string' || datos.lugar.length < 3 || datos.lugar.length > 180
      || normalizarTextoEvento(datos.lugar) !== datos.lugar) {
    return 'Ingresá un lugar de entre 3 y 180 caracteres.';
  }
  if (![datos.fecha, datos.limiteConfirmacion, datos.limitePago].every(fechaValida)) {
    return 'Completá las tres fechas con días válidos, entre 2020 y 2100.';
  }
  if (datos.limiteConfirmacion > datos.limitePago || datos.limitePago > datos.fecha) {
    return 'La confirmación debe vencer antes o el mismo día que el pago, y el pago antes o el mismo día del evento.';
  }
  const importe = datos.ticketReferencia;
  if (!Number.isFinite(importe) || importe < 0 || importe > 1_000_000
      || Math.abs(importe * 100 - Math.round(importe * 100)) > 0.000001) {
    return 'El ticket debe ser un importe entre 0 y 1.000.000 UYU, con hasta dos decimales.';
  }
  return '';
}

export function configuracionADocumento(datos) {
  const error = validarConfiguracionEvento(datos);
  if (error) throw new Error(error);
  return {
    nombre: datos.nombre,
    lugar: datos.lugar,
    fecha: inicioDiaUruguay(datos.fecha),
    limiteConfirmacion: inicioDiaUruguay(datos.limiteConfirmacion),
    limitePago: inicioDiaUruguay(datos.limitePago),
    // Enteros en centavos evitan errores de coma flotante en los importes persistidos.
    ticketCentavos: Math.round(datos.ticketReferencia * 100),
  };
}

export function configuracionDesdeDocumento(datos) {
  function fechaCalendario(valor) {
    const fecha = valor instanceof Date ? valor : valor?.toDate?.();
    if (!(fecha instanceof Date) || !Number.isFinite(fecha.getTime())) throw new Error('Fecha inválida en la configuración.');
    const texto = new Date(fecha.getTime() - DESFASE_URUGUAY).toISOString().slice(0, 10);
    if (!fechaValida(texto) || inicioDiaUruguay(texto).getTime() !== fecha.getTime()) {
      throw new Error('Las fechas del evento deben representar el inicio del día en Uruguay.');
    }
    return texto;
  }
  if (!Number.isInteger(datos.ticketCentavos)) throw new Error('El ticket guardado debe estar expresado en centavos enteros.');
  const configuracion = {
    nombre: datos.nombre,
    lugar: datos.lugar,
    fecha: fechaCalendario(datos.fecha),
    limiteConfirmacion: fechaCalendario(datos.limiteConfirmacion),
    limitePago: fechaCalendario(datos.limitePago),
    ticketReferencia: datos.ticketCentavos / 100,
  };
  const error = validarConfiguracionEvento(configuracion);
  if (error) throw new Error(error);
  return configuracion;
}
