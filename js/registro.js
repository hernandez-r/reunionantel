import { collection, doc, serverTimestamp, setDoc } from 'https://www.gstatic.com/firebasejs/12.6.0/firebase-firestore.js';
import { EVENTO, inscripcionesAbiertas } from './config.js';
import { getFirebase } from './firebase-config.js';
import { crearFormularioParticipantes } from './formulario.js';
import { contarPersonas } from './inscripciones.js';
import { mostrarEvento, mensaje, describirError, mostrarResumen } from './ui.js';

mostrarEvento();
const formulario = document.querySelector('#formulario');
const campos = document.querySelector('#campos-registro');
const estado = document.querySelector('#estado-registro');
const dialogo = document.querySelector('#confirmacion-dialogo');
const guardar = document.querySelector('#guardar');
const volver = document.querySelector('#volver');
const errorDialogo = document.querySelector('#confirmacion-error');
let editor;
let db;
let enviando = false;
let completado = false;
let datosPendientes;
// Reutilizamos el ID ante reintentos. Un segundo envío nunca crea otro documento.
let referencia;

function revisarPlazo() {
  if (completado || !db) return;
  const abierto = inscripcionesAbiertas();
  campos.disabled = !abierto || enviando;
  if (!abierto && !enviando) {
    mensaje(estado, 'Las inscripciones están cerradas. Si necesitás ayuda, contactá a la organización.', 'aviso');
    if (dialogo.open) dialogo.close();
  }
}

try {
  editor = crearFormularioParticipantes(formulario, EVENTO.maxInvitados);
  ({ db } = getFirebase());
  campos.disabled = false;
  mensaje(estado);
  revisarPlazo();
} catch (error) {
  mensaje(estado, describirError(error, 'preparar el formulario'), 'error');
}

formulario.addEventListener('submit', (event) => {
  event.preventDefault();
  if (!db || enviando || completado) return;
  revisarPlazo();
  if (!inscripcionesAbiertas()) return;
  const error = editor.validar();
  if (error) { mensaje(estado, error, 'error'); return; }
  mensaje(estado);
  mensaje(errorDialogo);
  datosPendientes = editor.obtenerDatos();
  mostrarResumen(document.querySelector('#confirmacion-resumen'), datosPendientes);
  const cuenta = contarPersonas(datosPendientes);
  document.querySelector('#confirmacion-totales').textContent = `${cuenta.total} personas · ${cuenta.mayores} mayores · ${cuenta.menores} menores`;
  dialogo.showModal();
});

volver.addEventListener('click', () => { if (!enviando) dialogo.close(); });
dialogo.addEventListener('cancel', (event) => { if (enviando) event.preventDefault(); });

guardar.addEventListener('click', async () => {
  if (enviando || completado || !datosPendientes || !db) return;
  if (!inscripcionesAbiertas()) { revisarPlazo(); return; }
  if (!navigator.onLine) { mensaje(errorDialogo, 'No hay conexión. Conectate a Internet antes de confirmar.', 'error'); return; }
  enviando = true; // Antes del primer await: evita envíos por doble clic.
  guardar.disabled = volver.disabled = campos.disabled = true;
  dialogo.setAttribute('aria-busy', 'true');
  guardar.textContent = 'Guardando…';
  mensaje(errorDialogo, 'Esperando la confirmación de Firebase. No cierres esta pestaña.');
  referencia ??= doc(collection(db, 'inscripciones'));
  try {
    await setDoc(referencia, { ...datosPendientes, pagado: false, fechaRegistro: serverTimestamp() });
    completado = true;
    dialogo.close();
    formulario.hidden = true;
    mensaje(estado);
    document.querySelector('#codigo-inscripcion').textContent = referencia.id;
    const exito = document.querySelector('#exito');
    exito.hidden = false;
    exito.focus();
  } catch (error) {
    mensaje(errorDialogo, describirError(error, 'guardar la inscripción'), 'error');
  } finally {
    enviando = false;
    guardar.disabled = volver.disabled = false;
    guardar.textContent = 'Confirmar inscripción';
    dialogo.removeAttribute('aria-busy');
    revisarPlazo();
  }
});

// También revalidamos en reglas con request.time: cambiar el reloj no permite inscribirse fuera de plazo.
setInterval(revisarPlazo, 15_000);
document.addEventListener('visibilitychange', revisarPlazo);
