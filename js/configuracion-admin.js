import { EVENTO_INICIAL } from './config.js';
import { normalizarTextoEvento, validarConfiguracionEvento } from './evento-datos.js';
import { observarEvento, guardarEvento } from './evento-service.js';
import { describirError, mensaje, mostrarEvento } from './ui.js';

export function crearEditorEvento(db) {
  const $ = (selector) => document.querySelector(selector);
  const formulario = $('#evento-form');
  const campos = $('#evento-campos');
  const estado = $('#evento-estado');
  const entradas = {
    nombre: $('#evento-nombre'), lugar: $('#evento-lugar'), fecha: $('#evento-fecha'),
    limiteConfirmacion: $('#evento-confirmacion'), limitePago: $('#evento-pago'),
    ticketReferencia: $('#evento-ticket'),
  };
  let cancelar;
  let activo = false;
  let generacion = 0;
  let guardando = false;
  let modificado = false;
  let ultimoEvento;
  let versionEdicion = null;

  function cargar(datos) {
    for (const [clave, input] of Object.entries(entradas)) input.value = datos[clave];
    versionEdicion = datos.version ?? null;
    modificado = false;
  }

  function detener() {
    generacion += 1;
    activo = false;
    cancelar?.();
    cancelar = undefined;
    formulario.reset();
    campos.disabled = true;
    ultimoEvento = undefined;
    versionEdicion = null;
    modificado = false;
    mensaje(estado);
  }

  formulario.addEventListener('input', () => { modificado = true; });
  $('#evento-descartar').addEventListener('click', () => {
    if (!activo || guardando || ultimoEvento === undefined) return;
    cargar(ultimoEvento ?? EVENTO_INICIAL);
    mensaje(estado, ultimoEvento ? 'Se cargó la configuración guardada.' : 'Completá los datos y guardá la primera configuración.');
  });
  formulario.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (!activo || guardando || campos.disabled || ultimoEvento === undefined) return;
    const datos = Object.fromEntries(Object.entries(entradas).map(([clave, input]) => [clave,
      clave === 'ticketReferencia' ? Number(input.value) : normalizarTextoEvento(input.value),
    ]));
    const error = validarConfiguracionEvento(datos);
    if (error) { mensaje(estado, error, 'error'); return; }
    if (!navigator.onLine) { mensaje(estado, 'Conectate a Internet para guardar la configuración.', 'error'); return; }
    const version = generacion;
    const anterior = versionEdicion;
    guardando = true;
    campos.disabled = true;
    formulario.setAttribute('aria-busy', 'true');
    mensaje(estado, 'Guardando la configuración del evento…');
    try {
      await guardarEvento(db, datos, anterior);
      if (version !== generacion) return;
      modificado = false;
      // El listener puede haber recibido ya la confirmación de nuestra transacción.
      if (ultimoEvento && ultimoEvento.version !== anterior) cargar(ultimoEvento);
      mensaje(estado, 'Configuración guardada. La página pública se actualiza automáticamente.', 'exito');
    } catch (errorGuardado) {
      if (version !== generacion) return;
      mensaje(estado, errorGuardado.code === 'evento/configuracion-modificada'
        ? errorGuardado.message : describirError(errorGuardado, 'guardar la configuración'), 'error');
    } finally {
      guardando = false;
      formulario.removeAttribute('aria-busy');
      if (version === generacion) campos.disabled = !activo;
    }
  });

  return {
    estaGuardando: () => guardando,
    detener,
    iniciar() {
      detener();
      activo = true;
      const version = generacion;
      mensaje(estado, 'Cargando la configuración del evento…');
      cancelar = observarEvento(db, (datos) => {
        if (!activo || version !== generacion) return;
        ultimoEvento = datos;
        mostrarEvento();
        campos.disabled = guardando;
        if (!modificado) cargar(datos ?? EVENTO_INICIAL);
        if (!datos) {
          $('#configuracion-evento').open = true;
          mensaje(estado, 'Primer uso: revisá y guardá estos datos para habilitar las inscripciones públicas.', 'aviso');
        } else if (modificado && !guardando && datos.version !== versionEdicion) {
          mensaje(estado, 'La configuración cambió en otra pestaña. Tus cambios no se sobrescribieron; descartalos para cargar la versión actual.', 'aviso');
        }
      }, () => {
        if (!activo || version !== generacion) return;
        campos.disabled = true;
        mensaje(estado, 'No se pudo cargar la configuración. Verificá que las nuevas reglas de firestore.rules estén publicadas en Firebase Console y volvé a iniciar sesión.', 'error');
      });
    },
  };
}
