import { normalizarNombre, nombreValido, validarInscripcion, contarPersonas, calcularEstadisticas, filtrarInscripciones, generarCSV } from '../js/inscripciones.js';
import { EVENTO, inscripcionesAbiertas } from '../js/config.js';
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
