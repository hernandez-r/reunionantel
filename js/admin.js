import { collection, deleteDoc, doc, onSnapshot, runTransaction, serverTimestamp, setDoc, updateDoc } from 'https://www.gstatic.com/firebasejs/12.6.0/firebase-firestore.js';
import { EVENTO, listaAdministradoresValida } from './config.js';
import { getFirebase } from './firebase-config.js';
import { cerrarSesion, iniciarSesion, observarSesion } from './auth.js';
import { crearFormularioParticipantes } from './formulario.js';
import { crearEditorEvento } from './configuracion-admin.js';
import { calcularEstadisticas, contarPersonas, filtrarInscripciones, generarCSV } from './inscripciones.js';
import { describirError, elemento, mensaje, mostrarEvento, mostrarResumen } from './ui.js';

const $ = (selector) => document.querySelector(selector);
mostrarEvento();
let db;
let editor;
let editorEvento;
let registros = [];
let dejarDeEscuchar;
let sesionActiva = false;
let versionSesion = 0;
let guardando = false;
let eliminando = false;
let edicion; // null para alta; copia del registro para detectar ediciones simultáneas.
let referenciaNueva;
let aEliminar;
let avisoConexion = false;
const expandidos = new Set();
const pagosPendientes = new Set();

function limpiarPanel() {
  versionSesion += 1;
  sesionActiva = false;
  dejarDeEscuchar?.();
  dejarDeEscuchar = undefined;
  editorEvento?.detener();
  registros = [];
  expandidos.clear();
  pagosPendientes.clear();
  avisoConexion = false;
  $('#filas').replaceChildren();
  document.querySelectorAll('[data-estadistica]').forEach((nodo) => { nodo.textContent = '0'; });
  $('#dashboard').hidden = true;
  $('#login').hidden = false;
  $('#login-campos').disabled = false;
  $('#salir').hidden = true;
  $('#editor-dialogo').close();
  $('#eliminar-dialogo').close();
  editor?.cargar();
  edicion = aEliminar = referenciaNueva = undefined;
  $('#eliminar-descripcion').textContent = '';
  mensaje($('#editor-estado'));
  mensaje($('#eliminar-estado'));
  $('#buscar').value = '';
  mensaje($('#estado-admin'));
}

function escucharInscripciones(usuario) {
  limpiarPanel();
  sesionActiva = true;
  editorEvento.iniciar();
  const version = versionSesion;
  $('#salir').hidden = false;
  $('#login-campos').disabled = true;
  mensaje($('#estado-auth'), 'Comprobando permisos y cargando inscripciones…');
  dejarDeEscuchar = onSnapshot(collection(db, 'inscripciones'), { includeMetadataChanges: true }, (snapshot) => {
    if (!sesionActiva || version !== versionSesion) return;
    // No mostramos un dashboard vacío como si se hubiera verificado el permiso en el servidor.
    if (snapshot.metadata.fromCache && $('#dashboard').hidden) return;
    registros = snapshot.docs.map((documento) => ({ ...documento.data(), id: documento.id }));
    $('#login').hidden = true;
    $('#dashboard').hidden = false;
    $('#salir').title = `Cerrar sesión de ${usuario.email}`;
    mensaje($('#estado-auth'));
    if (snapshot.metadata.fromCache) {
      avisoConexion = true;
      mensaje($('#estado-admin'), 'Sin conexión confirmada con el servidor. Los cambios pueden quedar pendientes; mantené esta pestaña abierta.', 'aviso');
    } else if (avisoConexion) {
      avisoConexion = false;
      mensaje($('#estado-admin'), 'Conexión con Firebase restablecida.', 'exito');
    }
    renderizar();
  }, async (error) => {
    if (version !== versionSesion) return;
    limpiarPanel();
    try { await cerrarSesion(); } catch { /* La interfaz y los datos ya se limpiaron. */ }
    mensaje($('#estado-auth'), describirError(error, 'consultar las inscripciones'), 'error');
  });
}

function resultadosActuales() {
  return filtrarInscripciones(registros, $('#buscar').value, $('#filtro-pago').value, $('#orden').value);
}

function botonAccion(texto, etiqueta, accion, deshabilitado = false, clase = '') {
  const boton = elemento('button', texto, `boton-texto ${clase}`.trim());
  boton.type = 'button';
  boton.setAttribute('aria-label', etiqueta);
  boton.disabled = deshabilitado;
  boton.addEventListener('click', accion);
  return boton;
}

function renderizar() {
  const estadisticas = calcularEstadisticas(registros);
  document.querySelectorAll('[data-estadistica]').forEach((nodo) => {
    nodo.textContent = estadisticas[nodo.dataset.estadistica];
  });
  const resultados = resultadosActuales();
  $('#resultados').textContent = `${resultados.length} de ${registros.length} inscripciones encontradas`;
  $('#exportar').disabled = resultados.length === 0;
  $('#sin-resultados').hidden = resultados.length !== 0;
  const fragmento = document.createDocumentFragment();
  resultados.forEach((registro) => {
    const cuenta = contarPersonas(registro);
    const fila = elemento('tr');
    const titular = elemento('th');
    titular.scope = 'row';
    titular.append(elemento('span', registro.titular, 'nombre-titular'), elemento('small', `#${registro.id}`, 'codigo-tabla'));
    fila.append(titular, elemento('td', cuenta.mayores), elemento('td', cuenta.menores), elemento('td', cuenta.total, 'total-tabla'));
    const pago = elemento('td');
    const etiqueta = elemento('label', undefined, `pago ${registro.pagado ? 'pago--pagado' : 'pago--pendiente'}`);
    const checkbox = elemento('input');
    checkbox.type = 'checkbox';
    checkbox.checked = registro.pagado;
    checkbox.disabled = pagosPendientes.has(registro.id);
    checkbox.setAttribute('aria-label', `Pagado: grupo de ${registro.titular}`);
    checkbox.addEventListener('change', () => cambiarPago(registro, checkbox.checked));
    etiqueta.append(checkbox, elemento('span', registro.pagado ? 'Pagado' : 'Pendiente'));
    pago.append(etiqueta);
    const acciones = elemento('td');
    const accionesGrupo = elemento('div', undefined, 'acciones-fila');
    const ver = botonAccion(expandidos.has(registro.id) ? 'Ocultar' : 'Ver', `Ver integrantes del grupo de ${registro.titular}`, () => {
      const expandido = !expandidos.has(registro.id);
      if (expandido) expandidos.add(registro.id); else expandidos.delete(registro.id);
      detalle.hidden = !expandido;
      ver.textContent = expandido ? 'Ocultar' : 'Ver';
      ver.setAttribute('aria-expanded', String(expandido));
    });
    ver.setAttribute('aria-expanded', String(expandidos.has(registro.id)));
    ver.setAttribute('aria-controls', `detalle-${registro.id}`);
    accionesGrupo.append(ver,
      botonAccion('Editar', `Editar grupo de ${registro.titular}`, () => abrirEditor(registro), pagosPendientes.has(registro.id)),
      botonAccion('Eliminar', `Eliminar grupo de ${registro.titular}`, () => confirmarEliminacion(registro), pagosPendientes.has(registro.id), 'peligro'));
    acciones.append(accionesGrupo);
    fila.append(pago, acciones);
    const detalle = elemento('tr', undefined, 'fila-detalle');
    detalle.id = `detalle-${registro.id}`;
    detalle.hidden = !expandidos.has(registro.id);
    const contenido = elemento('td');
    contenido.colSpan = 6;
    const resumen = elemento('div');
    mostrarResumen(resumen, registro);
    contenido.append(resumen);
    if (registro.fechaRegistro?.toDate) {
      contenido.append(elemento('p', `Inscripción: ${registro.fechaRegistro.toDate().toLocaleString('es-UY', { timeZone: EVENTO.zonaHoraria })} (Uruguay)`, 'nota'));
    }
    detalle.append(contenido);
    fragmento.append(fila, detalle);
  });
  $('#filas').replaceChildren(fragmento);
}

async function cambiarPago(registro, pagado) {
  if (!sesionActiva || pagosPendientes.has(registro.id)) return;
  if (!navigator.onLine) { mensaje($('#estado-admin'), 'Conectate a Internet para modificar pagos.', 'error'); renderizar(); return; }
  const version = versionSesion;
  pagosPendientes.add(registro.id);
  renderizar();
  mensaje($('#estado-admin'), 'Guardando el pago…');
  try {
    // Cambiar únicamente el pago impide sobrescribir ediciones de los integrantes.
    await updateDoc(doc(db, 'inscripciones', registro.id), { pagado });
    if (version === versionSesion) mensaje($('#estado-admin'), 'Estado de pago guardado.', 'exito');
  } catch (error) {
    if (version === versionSesion) mensaje($('#estado-admin'), describirError(error, 'guardar el pago'), 'error');
  } finally {
    if (version === versionSesion) { pagosPendientes.delete(registro.id); renderizar(); }
  }
}

function abrirEditor(registro = null) {
  if (!sesionActiva || guardando) return;
  edicion = registro ? { ...registro, invitados: registro.invitados.map((invitado) => ({ ...invitado })) } : null;
  referenciaNueva = registro ? undefined : doc(collection(db, 'inscripciones'));
  editor.cargar(registro ?? undefined);
  $('#editor-titulo').textContent = registro ? 'Editar inscripción' : 'Nueva inscripción';
  $('#editor-campos').disabled = false;
  mensaje($('#editor-estado'));
  $('#editor-dialogo').showModal();
}

$('#editor-form').addEventListener('submit', async (event) => {
  event.preventDefault();
  if (!sesionActiva || guardando) return;
  const error = editor.validar();
  if (error) { mensaje($('#editor-estado'), error, 'error'); return; }
  if (!navigator.onLine) { mensaje($('#editor-estado'), 'Conectate a Internet para guardar.', 'error'); return; }
  const datos = editor.obtenerDatos();
  const original = edicion;
  const refNueva = referenciaNueva;
  const version = versionSesion;
  guardando = true;
  $('#editor-campos').disabled = true;
  $('#editor-dialogo').setAttribute('aria-busy', 'true');
  mensaje($('#editor-estado'), 'Guardando en Firebase…');
  try {
    if (original) {
      await runTransaction(db, async (transaccion) => {
        const referencia = doc(db, 'inscripciones', original.id);
        const actual = await transaccion.get(referencia);
        if (!actual.exists()) throw new Error('registro-eliminado');
        const valores = actual.data();
        if (valores.titular !== original.titular || JSON.stringify(valores.invitados) !== JSON.stringify(original.invitados)) {
          throw new Error('registro-modificado');
        }
        transaccion.update(referencia, datos); // Preserva pago y fecha originales.
      });
    } else {
      await setDoc(refNueva, { ...datos, pagado: false, fechaRegistro: serverTimestamp() });
    }
    if (version === versionSesion) {
      $('#editor-dialogo').close();
      mensaje($('#estado-admin'), 'Inscripción guardada.', 'exito');
    }
  } catch (errorGuardado) {
    if (version !== versionSesion) return;
    const texto = errorGuardado.message === 'registro-modificado'
      ? 'Otro administrador modificó este grupo. Cerrá el editor y volvé a abrirlo para trabajar con los datos actuales.'
      : errorGuardado.message === 'registro-eliminado' ? 'Esta inscripción ya fue eliminada. Cerrá el editor.'
        : describirError(errorGuardado, 'guardar la inscripción');
    mensaje($('#editor-estado'), texto, 'error');
  } finally {
    guardando = false;
    $('#editor-campos').disabled = false;
    $('#editor-dialogo').removeAttribute('aria-busy');
  }
});

function confirmarEliminacion(registro) {
  if (!sesionActiva || eliminando) return;
  aEliminar = registro.id;
  $('#eliminar-descripcion').textContent = `${registro.titular} · ${contarPersonas(registro).total} personas · Código ${registro.id}`;
  mensaje($('#eliminar-estado'));
  $('#eliminar-dialogo').showModal();
}

$('#eliminar-confirmar').addEventListener('click', async () => {
  if (!sesionActiva || eliminando || !aEliminar) return;
  if (!navigator.onLine) { mensaje($('#eliminar-estado'), 'Conectate a Internet para eliminar.', 'error'); return; }
  const version = versionSesion;
  const id = aEliminar;
  eliminando = true;
  $('#eliminar-confirmar').disabled = $('#eliminar-cancelar').disabled = true;
  $('#eliminar-dialogo').setAttribute('aria-busy', 'true');
  mensaje($('#eliminar-estado'), 'Eliminando…');
  try {
    await deleteDoc(doc(db, 'inscripciones', id));
    if (version === versionSesion) {
      expandidos.delete(id);
      $('#eliminar-dialogo').close();
      mensaje($('#estado-admin'), 'Inscripción eliminada.', 'exito');
    }
  } catch (error) {
    if (version === versionSesion) mensaje($('#eliminar-estado'), describirError(error, 'eliminar la inscripción'), 'error');
  } finally {
    eliminando = false;
    $('#eliminar-confirmar').disabled = $('#eliminar-cancelar').disabled = false;
    $('#eliminar-dialogo').removeAttribute('aria-busy');
  }
});

$('#login-form').addEventListener('submit', async (event) => {
  event.preventDefault();
  if ($('#login-campos').disabled) return;
  $('#login-campos').disabled = true;
  mensaje($('#estado-auth'), 'Iniciando sesión…');
  try {
    await iniciarSesion($('#correo').value.trim(), $('#clave').value);
  } catch (error) {
    mensaje($('#estado-auth'), describirError(error, 'iniciar sesión'), 'error');
  } finally {
    $('#clave').value = '';
    if (!sesionActiva) $('#login-campos').disabled = false;
  }
});

$('#salir').addEventListener('click', async () => {
  if (guardando || eliminando || pagosPendientes.size || editorEvento?.estaGuardando()) {
    mensaje($('#estado-admin'), 'Esperá a que termine la operación antes de cerrar sesión.', 'aviso');
    return;
  }
  $('#salir').disabled = true;
  try {
    await cerrarSesion();
    mensaje($('#estado-auth'), 'Sesión cerrada.');
  } catch (error) {
    mensaje($('#estado-admin'), describirError(error, 'cerrar sesión'), 'error');
  } finally { $('#salir').disabled = false; }
});

$('#nueva-inscripcion').addEventListener('click', () => abrirEditor());
$('#editor-cancelar').addEventListener('click', () => { if (!guardando) $('#editor-dialogo').close(); });
$('#eliminar-cancelar').addEventListener('click', () => { if (!eliminando) $('#eliminar-dialogo').close(); });
$('#editor-dialogo').addEventListener('cancel', (event) => { if (guardando) event.preventDefault(); });
$('#eliminar-dialogo').addEventListener('cancel', (event) => { if (eliminando) event.preventDefault(); });
['#buscar', '#filtro-pago', '#orden'].forEach((selector) => {
  $(selector).addEventListener(selector === '#buscar' ? 'input' : 'change', renderizar);
});
$('#exportar').addEventListener('click', () => {
  if (!sesionActiva) return;
  const url = URL.createObjectURL(new Blob([generarCSV(resultadosActuales())], { type: 'text/csv;charset=utf-8;' }));
  const enlace = elemento('a');
  enlace.href = url;
  enlace.download = `inscripciones-${new Date().toISOString().slice(0, 10)}.csv`;
  enlace.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
});

try {
  editor = crearFormularioParticipantes($('#editor-form'), EVENTO.maxInvitados);
  ({ db } = getFirebase());
  editorEvento = crearEditorEvento(db);
  if (!listaAdministradoresValida()) throw new Error('Falta configurar una lista válida de UID administradores en js/config.js y firestore.rules.');
  observarSesion({
    onAdmin: escucharInscripciones,
    onExit: () => { limpiarPanel(); mensaje($('#estado-auth')); },
    onError: (texto) => { limpiarPanel(); mensaje($('#estado-auth'), texto, 'error'); },
  });
} catch (error) {
  mensaje($('#estado-auth'), describirError(error, 'preparar el acceso'), 'error');
}
