// Lógica pura compartida entre el formulario público y el panel privado.
export function normalizarNombre(nombre) {
  return String(nombre ?? '').trim().replace(/\s+/gu, ' ');
}

export function nombreValido(nombre) {
  return typeof nombre === 'string' && nombre.length >= 3 && nombre.length <= 120
    && /^[^\s]+( [^\s]+)+$/u.test(nombre);
}

export function validarInscripcion(datos, maxInvitados = 10) {
  if (!nombreValido(datos.titular)) return 'Ingresá nombre y apellido del titular (entre 3 y 120 caracteres).';
  if (!Array.isArray(datos.invitados) || datos.invitados.length > maxInvitados) {
    return `Podés agregar hasta ${maxInvitados} invitados.`;
  }
  for (const [index, invitado] of datos.invitados.entries()) {
    if (!nombreValido(invitado.nombre)) return `Completá nombre y apellido del invitado ${index + 1} (entre 3 y 120 caracteres).`;
    if (!['mayor', 'menor'].includes(invitado.tipo)) return `Elegí una categoría para el invitado ${index + 1}.`;
  }
  return '';
}

export function contarPersonas({ invitados = [] }) {
  const menores = invitados.filter((invitado) => invitado.tipo === 'menor').length;
  const total = invitados.length + 1; // El titular siempre es mayor.
  return { total, mayores: total - menores, menores };
}

export function calcularEstadisticas(registros) {
  return registros.reduce((suma, registro) => {
    const cuenta = contarPersonas(registro);
    suma.grupos += 1;
    suma.personas += cuenta.total;
    suma.mayores += cuenta.mayores;
    suma.menores += cuenta.menores;
    suma[registro.pagado ? 'pagadas' : 'pendientes'] += cuenta.total;
    return suma;
  }, { grupos: 0, personas: 0, mayores: 0, menores: 0, pagadas: 0, pendientes: 0 });
}

function textoBuscable(valor) {
  return valor.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLocaleLowerCase('es').trim();
}

export function filtrarInscripciones(registros, busqueda = '', pago = 'todos', orden = 'asc') {
  const termino = textoBuscable(busqueda);
  const filtrados = registros.filter((registro) => {
    const coincidePago = pago === 'todos' || registro.pagado === (pago === 'pagados');
    const nombres = [registro.titular, ...registro.invitados.map((invitado) => invitado.nombre)];
    return coincidePago && nombres.some((nombre) => textoBuscable(nombre).includes(termino));
  });
  return filtrados.sort((a, b) => {
    const comparacion = a.titular.localeCompare(b.titular, 'es', { sensitivity: 'base' }) || a.id.localeCompare(b.id);
    return orden === 'desc' ? -comparacion : comparacion;
  });
}

// Un renglón por persona conserva todos los invitados y permite filtrar en una planilla.
// Se neutralizan fórmulas, incluso si se ingresaron precedidas de espacios o controles.
export function generarCSV(registros) {
  const escapar = (valor) => {
    let texto = String(valor ?? '');
    if (/^[\s\u0000-\u001f]*[=+@-]/u.test(texto)) texto = `'${texto}`;
    return `"${texto.replaceAll('"', '""')}"`;
  };
  const filas = [['Código', 'Titular del grupo', 'Nombre', 'Rol', 'Categoría', 'Pago del grupo', 'Fecha de registro']];
  for (const registro of registros) {
    const fecha = registro.fechaRegistro?.toDate?.().toISOString() ?? '';
    const personas = [{ nombre: registro.titular, tipo: 'mayor', rol: 'Titular' },
      ...registro.invitados.map((invitado) => ({ ...invitado, rol: 'Invitado' }))];
    personas.forEach((persona) => filas.push([
      registro.id, registro.titular, persona.nombre, persona.rol,
      persona.tipo === 'mayor' ? 'Mayor' : 'Menor', registro.pagado ? 'Pagado' : 'Pendiente', fecha,
    ]));
  }
  return '\uFEFF' + filas.map((fila) => fila.map(escapar).join(';')).join('\r\n');
}
