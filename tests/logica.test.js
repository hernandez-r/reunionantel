import { normalizarNombre, nombreValido, validarInscripcion, contarPersonas, calcularEstadisticas, filtrarInscripciones, generarCSV } from '../js/inscripciones.js';
import { EVENTO, EVENTO_INICIAL, aplicarEvento, inscripcionesAbiertas, importeLegible, esUidAdministrador, listaAdministradoresValida } from '../js/config.js';
import { fechaValida, inicioDiaUruguay, cierreDelDia, validarConfiguracionEvento, configuracionADocumento, configuracionDesdeDocumento } from '../js/evento-datos.js';
import { crearFormularioParticipantes } from '../js/formulario.js';

let aprobadas = 0;
let fallidas = 0;
function igual(actual, esperado) {
  if (JSON.stringify(actual) !== JSON.stringify(esperado)) {
    throw new Error(`Esperado ${JSON.stringify(esperado)}; obtenido ${JSON.stringify(actual)}`);
  }
}
function prueba(nombre, ejecutar) {
  const fila = document.createElement('li');
  try {
    ejecutar();
    aprobadas += 1;
    fila.textContent = `✓ ${nombre}`;
  } catch (error) {
    fallidas += 1;
    fila.textContent = `✗ ${nombre}: ${error.message}`;
  }
  document.querySelector('#pruebas').append(fila);
}

const solo = { id: 'a', titular: 'Juan Pérez', invitados: [], pagado: false };
const grupo = {
  id: 'b', titular: 'Ana López', pagado: true,
  invitados: [{ nombre: 'María López', tipo: 'mayor' }, { nombre: 'Pedro Pérez', tipo: 'menor' }, { nombre: 'Lucía Pérez', tipo: 'menor' }],
};

prueba('Normaliza espacios, tabulaciones y saltos', () => igual(normalizarNombre('  Juan \n Pérez\t '), 'Juan Pérez'));
prueba('Acepta nombres internacionales y compuestos', () => {
  ['Juan Pérez', 'María del Carmen López', "Ana O’Connor", '李 明'].forEach((nombre) => igual(nombreValido(nombre), true));
});
prueba('Rechaza nombres incompletos y espacios extra', () => {
  ['', 'Juan', ' Juan Pérez', 'Juan Pérez ', 'Juan  Pérez', 'Juan\nPérez', 'A B' + 'c'.repeat(118)].forEach((nombre) => igual(nombreValido(nombre), false));
});
prueba('Solo titular: 1 persona, mayor', () => igual(contarPersonas(solo), { total: 1, mayores: 1, menores: 0 }));
prueba('Titular y tres invitados: 4 / 2 / 2', () => igual(contarPersonas(grupo), { total: 4, mayores: 2, menores: 2 }));
prueba('Alta válida sin invitados', () => igual(validarInscripcion(solo), ''));
prueba('Alta válida con tres invitados', () => igual(validarInscripcion(grupo), ''));
prueba('Rechaza nombre de invitado vacío', () => igual(Boolean(validarInscripcion({ ...solo, invitados: [{ nombre: '', tipo: 'mayor' }] })), true));
prueba('Rechaza categoría desconocida', () => igual(Boolean(validarInscripcion({ ...solo, invitados: [{ nombre: 'Ana López', tipo: 'adulto' }] })), true));
prueba('Admite exactamente 10 invitados', () => igual(validarInscripcion({ ...solo, invitados: Array.from({ length: 10 }, () => ({ nombre: 'Ana López', tipo: 'mayor' })) }), ''));
prueba('Rechaza 11 invitados', () => igual(Boolean(validarInscripcion({ ...solo, invitados: Array.from({ length: 11 }, () => ({ nombre: 'Ana López', tipo: 'mayor' })) })), true));
prueba('Respeta un límite configurable menor', () => igual(Boolean(validarInscripcion(grupo, 2)), true));
prueba('Estadísticas globales cuentan personas, no pagos individuales', () => {
  igual(calcularEstadisticas([solo, grupo]), { grupos: 2, personas: 5, mayores: 3, menores: 2, pagadas: 4, pendientes: 1 });
});
prueba('Cambiar pago mueve el grupo completo', () => igual(calcularEstadisticas([{ ...grupo, pagado: false }]).pendientes, 4));
prueba('Eliminar invitado actualiza totales', () => igual(contarPersonas({ ...grupo, invitados: grupo.invitados.slice(0, 2) }), { total: 3, mayores: 2, menores: 1 }));
prueba('Cambiar categoría actualiza totales', () => igual(contarPersonas({ ...solo, invitados: [{ nombre: 'Ana López', tipo: 'menor' }] }).menores, 1));
prueba('Eliminar inscripción actualiza estadísticas', () => igual(calcularEstadisticas([]), { grupos: 0, personas: 0, mayores: 0, menores: 0, pagadas: 0, pendientes: 0 }));
prueba('Busca por invitado sin distinguir tildes', () => igual(filtrarInscripciones([solo, grupo], 'LUCIA').map((registro) => registro.id), ['b']));
prueba('Busca por titular', () => igual(filtrarInscripciones([solo, grupo], 'juan').map((registro) => registro.id), ['a']));
prueba('Filtra pagados', () => igual(filtrarInscripciones([solo, grupo], '', 'pagados').map((registro) => registro.id), ['b']));
prueba('Filtra pendientes', () => igual(filtrarInscripciones([solo, grupo], '', 'pendientes').map((registro) => registro.id), ['a']));
prueba('Orden ascendente y descendente sin mutar el original', () => {
  const registros = [solo, grupo];
  igual(filtrarInscripciones(registros).map((registro) => registro.id), ['b', 'a']);
  igual(filtrarInscripciones(registros, '', 'todos', 'desc').map((registro) => registro.id), ['a', 'b']);
  igual(registros[0].id, 'a');
});
prueba('Combina búsqueda y filtro sin resultados', () => igual(filtrarInscripciones([solo, grupo], 'Lucía', 'pendientes'), []));
prueba('CSV incluye titular y todos los invitados', () => {
  const csv = generarCSV([grupo]);
  igual(csv.startsWith('\uFEFF'), true);
  igual(csv.split('\r\n').length, 5);
  igual(csv.includes('Lucía Pérez'), true);
});
prueba('CSV escapa comillas y neutraliza fórmulas', () => {
  const csv = generarCSV([{ ...solo, titular: '=HYPERLINK("X") Nombre' }]);
  igual(csv.includes("\"'=HYPERLINK(\"\"X\"\") Nombre\""), true);
});
prueba('CSV también neutraliza fórmulas precedidas de espacios', () => igual(generarCSV([{ ...solo, titular: '  +SUM(1) Nombre' }]).includes("'  +SUM(1) Nombre"), true));
prueba('Plazo abierto justo antes del cierre', () => igual(inscripcionesAbiertas(new Date(Date.parse(EVENTO.cierreInscripciones) - 1)), true));
prueba('Plazo cerrado exactamente al cierre y después', () => {
  igual(inscripcionesAbiertas(new Date(EVENTO.cierreInscripciones)), false);
  igual(inscripcionesAbiertas(new Date(Date.parse(EVENTO.cierreInscripciones) + 1)), false);
});

const evento = {
  nombre: 'Encuentro de primavera', lugar: 'Club Social', fecha: '2028-10-20',
  limiteConfirmacion: '2028-10-10', limitePago: '2028-10-15', ticketReferencia: 1250.5,
};
prueba('Configuración del evento válida', () => igual(validarConfiguracionEvento(evento), ''));
prueba('Rechaza fechas inexistentes y formatos distintos', () => {
  ['2027-02-29', '2028-02-30', '20/10/2028', '', '2019-12-31', '2101-01-01'].forEach((fecha) => igual(fechaValida(fecha), false));
});
prueba('Admite fecha bisiesta válida', () => igual(fechaValida('2028-02-29'), true));
prueba('Día de Uruguay independiente del huso del navegador', () => igual(inicioDiaUruguay('2028-10-10').toISOString(), '2028-10-10T03:00:00.000Z'));
prueba('Cierre al terminar el día, incluso al cambiar de año', () => igual(cierreDelDia('2028-12-31'), '2029-01-01T03:00:00.000Z'));
prueba('Rechaza confirmación posterior al pago', () => igual(Boolean(validarConfiguracionEvento({ ...evento, limiteConfirmacion: '2028-10-16' })), true));
prueba('Rechaza pago posterior al encuentro', () => igual(Boolean(validarConfiguracionEvento({ ...evento, limitePago: '2028-10-21' })), true));
prueba('Admite plazos en el mismo día del encuentro', () => igual(validarConfiguracionEvento({ ...evento, limiteConfirmacion: evento.fecha, limitePago: evento.fecha }), ''));
prueba('Rechaza nombre y lugar vacíos o demasiado largos', () => {
  igual(Boolean(validarConfiguracionEvento({ ...evento, nombre: '' })), true);
  igual(Boolean(validarConfiguracionEvento({ ...evento, lugar: 'x'.repeat(181) })), true);
});
prueba('Rechaza ticket inválido, negativo o con más de dos decimales', () => {
  [-1, NaN, Infinity, 1000001, 12.345].forEach((ticketReferencia) => igual(Boolean(validarConfiguracionEvento({ ...evento, ticketReferencia })), true));
});
prueba('Permite ticket cero y precio con dos decimales', () => {
  [0, 0.29, 1000000, 1250.5].forEach((ticketReferencia) => igual(validarConfiguracionEvento({ ...evento, ticketReferencia }), ''));
});
prueba('Persiste el costo en centavos enteros', () => igual(configuracionADocumento(evento).ticketCentavos, 125050));
prueba('Conversión del documento conserva todas las fechas y el importe', () => igual(configuracionDesdeDocumento(configuracionADocumento(evento)), evento));
prueba('Rechaza documentos con fechas que no son medianoche de Uruguay', () => {
  let rechazo = false;
  try { configuracionDesdeDocumento({ ...configuracionADocumento(evento), fecha: new Date('2028-10-20T00:00:00Z') }); }
  catch { rechazo = true; }
  igual(rechazo, true);
});
prueba('Cambiar la configuración actualiza el cierre usado por la aplicación', () => {
  try {
    aplicarEvento(evento);
    igual(EVENTO.lugar, evento.lugar);
    igual(inscripcionesAbiertas(new Date('2028-10-11T02:59:59Z')), true);
    igual(inscripcionesAbiertas(new Date('2028-10-11T03:00:00Z')), false);
    igual(EVENTO.adminUids, EVENTO_INICIAL.adminUids);
  } finally { aplicarEvento(EVENTO_INICIAL); }
});
prueba('El ticket con decimales no se redondea en pantalla', () => igual(importeLegible(1250.5).includes(',50'), true));

prueba('La lista admite tres administradores distintos', () => {
  const uids = ['admin-uno', 'admin-dos', 'admin-tres'];
  igual(listaAdministradoresValida(uids), true);
  uids.forEach((uid) => igual(esUidAdministrador(uid, uids), true));
  EVENTO.adminUids.forEach((uid) => igual(esUidAdministrador(uid), true));
});
prueba('Una cuenta autenticada fuera de la lista no es administradora', () => igual(esUidAdministrador('otro-usuario', ['admin-uno', 'admin-dos', 'admin-tres']), false));
prueba('No autoriza visitantes ni UID vacíos', () => {
  [null, undefined, '', 123].forEach((uid) => igual(esUidAdministrador(uid), false));
});
prueba('Detecta listas vacías, duplicadas o sin completar', () => {
  [[], [''], ['admin-uno', 'admin-uno'], ['REEMPLAZAR_UID'], ['UID_REAL_DEL_SEGUNDO_USUARIO'], [' uid '], ['x'.repeat(129)], 'admin-uno', null]
    .forEach((uids) => igual(listaAdministradoresValida(uids), false));
});
prueba('La configuración pública del evento no puede cambiar administradores', () => {
  try {
    aplicarEvento({ ...evento, adminUids: ['intruso'] });
    igual(EVENTO.adminUids, EVENTO_INICIAL.adminUids);
    igual(esUidAdministrador('intruso'), false);
    igual(Object.isFrozen(EVENTO.adminUids), true);
  } finally { aplicarEvento(EVENTO_INICIAL); }
});

// Ejercita el editor DOM real, no una copia de su lógica.
function conEditor(ejecutar, maximo = 10) {
  const formulario = document.createElement('form');
  formulario.hidden = true;
  formulario.innerHTML = '<input name="titular"><div data-invitados></div><button type="button" data-agregar></button><p data-limite></p><span data-cuenta="total"></span><span data-cuenta="mayores"></span><span data-cuenta="menores"></span>';
  document.body.append(formulario);
  try { ejecutar(crearFormularioParticipantes(formulario, maximo), formulario); }
  finally { formulario.remove(); }
}

prueba('Editor DOM incluye al titular desde el inicio', () => conEditor((editor, form) => {
  igual(form.querySelector('[data-cuenta="total"]').textContent, '1');
  igual(editor.obtenerDatos(), { titular: '', invitados: [] });
}));
prueba('Editor DOM carga invitados, categorías y totales', () => conEditor((editor, form) => {
  editor.cargar(grupo);
  igual(form.querySelectorAll('[data-invitados] > div').length, 3);
  igual(form.querySelector('[data-cuenta="menores"]').textContent, '2');
  igual(editor.validar(), '');
}));
prueba('Editor DOM agrega y quita invitados', () => conEditor((editor, form) => {
  form.querySelector('[data-agregar]').click();
  igual(editor.obtenerDatos().invitados.length, 1);
  form.querySelector('[data-invitados] button').click();
  igual(editor.obtenerDatos().invitados.length, 0);
}));
prueba('Editor DOM deshabilita el botón al llegar al máximo', () => conEditor((editor, form) => {
  form.querySelector('[data-agregar]').click();
  igual(form.querySelector('[data-agregar]').disabled, true);
  form.querySelector('[data-agregar]').click();
  igual(editor.obtenerDatos().invitados.length, 1);
}, 1));
prueba('Editor DOM no interpreta HTML ingresado como nombre', () => conEditor((editor, form) => {
  editor.cargar({ titular: '<script> Nombre', invitados: [{ nombre: '<img onerror=alert(1)> Nombre', tipo: 'mayor' }] });
  igual(form.querySelectorAll('img, script').length, 0);
  igual(editor.obtenerDatos().invitados[0].nombre, '<img onerror=alert(1)> Nombre');
}));
prueba('Reducir el límite no descarta invitados ya existentes', () => conEditor((editor, form) => {
  editor.cargar(grupo);
  igual(editor.obtenerDatos().invitados.length, 3);
  igual(form.querySelector('[data-agregar]').disabled, true);
  igual(Boolean(editor.validar()), true); // Exige ajustar explícitamente el grupo antes de guardar.
}, 1));

const resultado = document.querySelector('#resultado');
resultado.textContent = `${aprobadas} aprobadas; ${fallidas} fallidas.`;
resultado.className = `mensaje mensaje--${fallidas ? 'error' : 'exito'}`;
document.documentElement.dataset.pruebasFallidas = String(fallidas);
