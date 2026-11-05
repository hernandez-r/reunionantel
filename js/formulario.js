import { contarPersonas, normalizarNombre, validarInscripcion } from './inscripciones.js';
import { elemento } from './ui.js';

let siguienteId = 0;

// Editor reutilizado por las dos páginas. Todos los valores ingresados se insertan como texto.
export function crearFormularioParticipantes(formulario, maxInvitados) {
  if (!Number.isInteger(maxInvitados) || maxInvitados < 0 || maxInvitados > 10) {
    throw new Error('El límite de invitados debe ser un entero entre 0 y 10.');
  }
  const titular = formulario.querySelector('[name="titular"]');
  const contenedor = formulario.querySelector('[data-invitados]');
  const agregar = formulario.querySelector('[data-agregar]');
  const limite = formulario.querySelector('[data-limite]');

  function obtenerDatos() {
    return {
      titular: normalizarNombre(titular.value),
      invitados: [...contenedor.children].map((fila) => ({
        nombre: normalizarNombre(fila.querySelector('input').value),
        tipo: fila.querySelector('select').value,
      })),
    };
  }

  function actualizar() {
    const cuenta = contarPersonas(obtenerDatos());
    formulario.querySelectorAll('[data-cuenta]').forEach((nodo) => {
      nodo.textContent = cuenta[nodo.dataset.cuenta];
    });
    agregar.disabled = contenedor.children.length >= maxInvitados;
    limite.textContent = `${contenedor.children.length} de ${maxInvitados} invitados. El titular se cuenta como mayor.`;
    [...contenedor.children].forEach((fila, index) => {
      fila.querySelector('.invitado-titulo').textContent = `Invitado ${index + 1}`;
      fila.querySelector('button').setAttribute('aria-label', `Quitar invitado ${index + 1}`);
    });
  }

  function agregarInvitado(datos = { nombre: '', tipo: 'mayor' }, enfocar = true, existente = false) {
    // Si se redujo el límite, preservar los invitados ya guardados; nunca truncar silenciosamente.
    if (contenedor.children.length >= (existente ? 10 : maxInvitados)) return;
    const id = `invitado-${++siguienteId}`;
    const fila = elemento('div', undefined, 'invitado');
    const encabezado = elemento('div', undefined, 'invitado-encabezado');
    const quitar = elemento('button', 'Quitar', 'boton-texto peligro');
    quitar.type = 'button';
    encabezado.append(elemento('strong', '', 'invitado-titulo'), quitar);
    const campos = elemento('div', undefined, 'invitado-campos');
    const nombreGrupo = elemento('div', undefined, 'campo');
    const nombreLabel = elemento('label', 'Nombre y apellido');
    nombreLabel.htmlFor = `${id}-nombre`;
    const nombre = elemento('input');
    Object.assign(nombre, { id: `${id}-nombre`, type: 'text', required: true, maxLength: 120, minLength: 3, autocomplete: 'off', value: datos.nombre });
    nombre.placeholder = 'Nombre y apellido';
    nombreGrupo.append(nombreLabel, nombre);
    const tipoGrupo = elemento('div', undefined, 'campo');
    const tipoLabel = elemento('label', 'Categoría');
    tipoLabel.htmlFor = `${id}-tipo`;
    const tipo = elemento('select');
    tipo.id = `${id}-tipo`;
    [['mayor', 'Mayor'], ['menor', 'Menor']].forEach(([value, texto]) => {
      const opcion = elemento('option', texto);
      opcion.value = value;
      tipo.append(opcion);
    });
    tipo.value = datos.tipo;
    tipoGrupo.append(tipoLabel, tipo);
    campos.append(nombreGrupo, tipoGrupo);
    fila.append(encabezado, campos);
    contenedor.append(fila);
    quitar.addEventListener('click', () => {
      fila.remove();
      actualizar();
      agregar.focus();
    });
    actualizar();
    if (enfocar) nombre.focus();
  }

  agregar.addEventListener('click', () => agregarInvitado());
  formulario.addEventListener('input', actualizar);
  formulario.addEventListener('change', actualizar);
  actualizar();

  return {
    obtenerDatos,
    validar: () => validarInscripcion(obtenerDatos(), maxInvitados),
    cargar(datos = { titular: '', invitados: [] }) {
      titular.value = datos.titular;
      contenedor.replaceChildren();
      datos.invitados.forEach((invitado) => agregarInvitado(invitado, false, true));
      actualizar();
    },
  };
}
