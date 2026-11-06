# Reunión de fin de año

Aplicación estática en HTML, CSS y JavaScript Vanilla. Formulario público, administración privada con Firebase Authentication y datos en Cloud Firestore. Sin Node.js, frameworks, compilación, servidor de aplicación ni dependencias instalables.

**Antes de usarla:** revisar la configuración pública de Firebase y el UID, publicar las reglas actualizadas y guardar la configuración del evento desde el panel. No se incluyen contraseñas ni credenciales de servicio.

## Qué incluye

- Titular mayor de edad y hasta 10 invitados Mayor/Menor; resumen y revisión antes de enviar.
- Código de inscripción = ID aleatorio de Firestore, `serverTimestamp()` y pago pendiente. Bloqueo de doble clic e ID reutilizado en reintentos de la misma página.
- Configuración desde el panel: nombre, lugar, fecha del encuentro, plazos de confirmación/pago y ticket de referencia. Los datos se guardan en Firestore y se actualizan en la página pública.
- Cierre público al terminar el día de confirmación elegido, hora de Uruguay. Las reglas usan ese mismo plazo guardado; cambiar el reloj o JavaScript no permite eludirlo.
- Login privado por correo/contraseña, validación de sesión al recargar y autorización por UID en las reglas.
- Dashboard en tiempo real, alta manual después del cierre, edición, invitados, eliminación con confirmación y pagos del grupo reversibles.
- Búsqueda sin distinción de tildes, filtro de pagos, orden A–Z/Z–A, conteo y CSV de los resultados filtrados (un renglón por persona).
- Interfaz responsive, etiquetas accesibles, diálogos nativos y mensajes de espera/error.

## Estructura

```text
index.html                 Formulario público
admin.html                 Acceso y panel privado
css/styles.css             Diseño compartido, sin librerías
js/config.js               Valores iniciales, evento activo, límite y UID del admin
js/firebase-config.js      SDK modular y configuración pública (sin App Check)
js/registro.js             Alta pública y confirmación
js/auth.js                 Sesión de Authentication y comprobación de UID
js/admin.js                Suscripción en vivo, tabla y operaciones
js/configuracion-admin.js  Formulario privado de configuración del evento
js/evento-service.js       Lectura en vivo y guardado transaccional de la configuración
js/evento-datos.js         Validación y conversión de fechas/precio, sin Firebase
js/formulario.js           Editor de titular/invitados reutilizable
js/inscripciones.js        Validación, totales, búsqueda y CSV (funciones puras)
js/ui.js                   Mensajes, formato y renderizado seguro
firestore.rules            Seguridad y validación en el servidor
tests/                     Pruebas de lógica en navegador y revisión estática
.nojekyll                  Publicación sin procesamiento de Jekyll
```

## 1. Crear el proyecto Firebase

1. Entrá a [Firebase Console](https://console.firebase.google.com/) y creá un proyecto. Google Analytics no es necesario.
2. En **Configuración del proyecto → General → Tus apps**, elegí **Web (`</>`)** y registrá la app. No necesitás Firebase Hosting.
3. Copiá los valores de `firebaseConfig` que muestra Firebase a `js/firebase-config.js`, reemplazando todos los `REEMPLAZAR_…`. No copies el bloque de imports sugerido por la consola: el proyecto ya carga el SDK modular por CDN (misma versión en todos los módulos).
4. Esos identificadores y la API key web **son públicos**, no otorgan permisos de lectura/escritura. No incluyas cuentas de servicio, claves privadas, tokens administrativos ni contraseñas en los archivos.

## 2. Crear Firestore

1. En **Compilación → Firestore Database → Crear base de datos**, usá la base **`(default)`** y elegí la región adecuada para los asistentes (por ejemplo, Sudamérica).
2. Elegí **modo producción**, nunca reglas de prueba abiertas.
3. No es necesario crear colecciones manualmente: `configuracion/evento` se crea al guardar los ajustes desde el panel e `inscripciones` con la primera inscripción válida.
4. No se necesitan índices compuestos: el administrador escucha la colección y filtra/ordena en memoria. Es apropiado para una reunión pequeña, no para millones de registros.

## 3. Crear la cuenta administradora

1. Abrí **Compilación → Authentication → Comenzar**.
2. En **Método de acceso / Sign-in method**, habilitá **Correo electrónico/contraseña (Email/Password)**. No hace falta habilitar acceso por enlace de correo ni acceso anónimo.
3. En **Usuarios → Agregar usuario**, creá manualmente el correo y una contraseña segura. Comunicá la contraseña por un canal privado, no por el repositorio.
4. Copiá su **UID** desde la tabla/detalle del usuario.
5. Reemplazá `REEMPLAZAR_UID_ADMIN` por ese UID en **ambos** archivos:
   - `js/config.js` → `EVENTO.adminUid` (control de interfaz).
   - `firestore.rules` → `esAdmin()` (protección real).
6. La aplicación no expone registro de cuentas. Firebase Email/Password puede permitir que alguien cree una cuenta usando su API: **tener una cuenta no da acceso**; las reglas aceptan solamente el UID configurado. No se usa el correo como autorización.
7. En **Authentication → Configuración → Dominios autorizados**, agregá `localhost` para pruebas y `usuario.github.io` para producción (sin `https://` ni el nombre del repositorio). Firebase ya no siempre incluye `localhost` automáticamente.
8. Recomendado: activar protección contra enumeración de correos y política de contraseñas en Authentication.

## 4. Configurar evento y publicar reglas

### Si actualizás una instalación existente

1. En **Firestore Database → Reglas**, reemplazá todo el contenido por la nueva versión de `firestore.rules`, conservando tu UID administrador, y presioná **Publicar**.
2. Publicá los archivos actualizados en GitHub Pages y recargá sin caché.
3. Iniciá sesión en `admin.html` y abrí **Configuración del evento**. Si es la primera vez, se abre automáticamente con los valores iniciales.
4. Revisá nombre, lugar, fechas y ticket; presioná **Guardar configuración**. Se crea `configuracion/evento` automáticamente, sin usar el editor de documentos de Console.
5. Probá el formulario público. **Hasta el primer guardado, las altas públicas permanecen cerradas por seguridad.** Las inscripciones anteriores no se alteran y el administrador puede seguir consultándolas.

Si aparecen errores de permisos en los ajustes, verificá que publicaste **las nuevas reglas completas** en el proyecto y base `(default)` correctos. No sirve mantener las reglas anteriores, aunque permitan las inscripciones.

### Cambiar el evento desde el panel

Editá **Configuración del evento** para cambiar nombre, lugar, fecha, confirmación, pago y ticket. No necesitás modificar código ni volver a desplegar por esos cambios. La configuración se escucha en tiempo real en las páginas abiertas; si cambia mientras alguien revisa una inscripción, se le pide revisar nuevamente antes de confirmar.

- Las fechas son días de Uruguay (UTC−3), entre 2020 y 2100. Confirmación ≤ pago ≤ evento; se permiten fechas iguales y eventos pasados para cerrar el registro.
- La inscripción cierra al terminar el día de confirmación: por ejemplo, el 27/11 cierra el 28/11 a las 00:00 de Uruguay (03:00 UTC). El plazo se calcula desde el mismo timestamp tanto en la página como en las reglas, sin duplicar una fecha fija.
- El ticket admite entre 0 y 1.000.000 UYU, con hasta dos decimales. Es referencia para mayores: **no calcula un total a pagar ni asigna un precio a menores**.
- **Descartar cambios** vuelve a los valores guardados. Una transacción evita sobrescribir silenciosamente la edición realizada desde otra pestaña.
- `js/config.js` contiene únicamente los valores de arranque del primer formulario y las constantes técnicas. Una vez guardado el evento, prevalecen los valores de Firestore.

### Reutilizar la página para otro encuentro

Esta versión gestiona **un evento activo**, no un historial de eventos separados. Cambiar nombre/fechas **no borra ni separa inscripciones o pagos**. Antes de usarla para otro encuentro, exportá el CSV y gestioná la eliminación de los registros anteriores desde el panel, con sus confirmaciones. No hay vaciado automático ni eliminación masiva. Cambiar el ticket tampoco recalcula pagos ya marcados.

Hay dos valores técnicos que siguen teniendo su equivalente en `firestore.rules`:

| Configuración de interfaz | Reglas del servidor |
| --- | --- |
| `EVENTO.adminUid` | `esAdmin()` |
| `EVENTO.maxInvitados` (entero entre 0 y 10) | `maxInvitados()` |

**Mantenelos sincronizados y volvé a publicar las reglas al cambiarlos.** El UID, la moneda UYU, el huso de Uruguay y el máximo de invitados no se editan desde el formulario público ni desde los ajustes del evento.

El máximo de seguridad soportado es 10: Firestore Rules no permite recorrer listas con bucles; por eso se valida explícitamente cada una de las 10 posiciones posibles. Reducir el máximo solo requiere cambiar los dos valores. Aumentarlo exige extender también las validaciones de reglas y el editor; no alcanza con cambiar un número.

Si reducís el límite cuando ya hay grupos más grandes, el editor conserva todos sus invitados: no los descarta automáticamente. Para guardar esos grupos, quitá invitados explícitamente hasta cumplir el nuevo máximo o restablecé el límite anterior en configuración y reglas.

Para publicar:

1. Abrí **Firestore Database → Reglas**.
2. Reemplazá el contenido por **todo** `firestore.rules` ya configurado.
3. Presioná **Publicar**. La consola debe aceptarlo sin errores.
4. Verificá los casos del apartado de pruebas usando **Rules Playground / Simulador de reglas** y el proyecto de prueba. No habilites permisos amplios para resolver un error.

**Subir `firestore.rules` a GitHub no lo despliega en Firebase.** Hay que publicarlo en la consola. Ningún otro archivo del repositorio habilita permisos.

### Garantías de las reglas

- El público solo puede **crear** documentos válidos dentro del plazo y con `pagado: false`.
- Solo puede consultar el documento público `configuracion/evento`; no puede modificarlo, borrarlo ni listar su colección. Solo el UID administrador puede crear/actualizar la configuración y nadie puede eliminarla desde el cliente.
- Los ajustes admiten exactamente sus campos esperados, fechas a medianoche de Uruguay con orden válido, ticket en centavos enteros y timestamp de actualización del servidor.
- No puede leer ni siquiera un documento conociendo el código, listar, actualizar o borrar.
- El administrador puede leer, crear después del cierre, editar, eliminar y cambiar pagos.
- Cada nombre requiere al menos dos palabras, entre 3 y 120 caracteres, sin espacios iniciales/finales ni duplicados. Se permiten acentos, apóstrofes, guiones y nombres internacionales. No se puede comprobar que un nombre sea real.
- Invitados: lista de hasta el máximo configurado; cada elemento debe ser un mapa con **solo** `nombre` y `tipo`, tipo `mayor`/`menor`.
- El documento tiene **exactamente** `titular`, `invitados`, `pagado`, `fechaRegistro`. Pago booleano, timestamp del servidor al crear y fecha de registro inmutable al editar.
- El ID de alta debe ser alfanumérico de 20 caracteres, como el generado por `doc(collection(...))`.
- Todo el resto (incluidas subcolecciones) queda denegado. No hay permisos globales ni lecturas públicas.

## 5. App Check retirado y prevención de abuso

Esta versión **no carga ni inicializa Firebase App Check ni reCAPTCHA**. La autorización del administrador y la privacidad de los registros siguen protegidas por Authentication y las reglas de Firestore; no se habilitaron lecturas o modificaciones públicas.

**Importante:** quitar App Check del código no desactiva su exigencia en Firebase. Si lo habías activado:

1. Abrí **Firebase Console → proyecto `antelreunion` → App Check → APIs**.
2. Seleccioná **Cloud Firestore** y desactivá **Exigir / Enforcement** (dejalo en supervisión o sin exigencia, según el texto que muestre la consola).
3. Si también exigiste App Check para **Authentication**, desactivá esa exigencia.
4. Guardá los cambios y esperá a que se propaguen. Publicá esta versión de la aplicación y recargá sin caché.

No hace falta eliminar la app de Firebase ni modificar sus claves. Si persiste `permission-denied`, comprobá que las reglas completas de `firestore.rules` estén **publicadas en el mismo proyecto y en la base `(default)`** que usa la aplicación. Subirlas a GitHub no las publica en Firebase.

Un formulario anónimo sin App Check tiene menos protección frente a registros automatizados. La validación y el plazo no comprueban identidad ni limitan la cantidad de solicitudes. Revisá cuotas, uso y alertas de presupuesto; las alertas no son un tope de gasto. Una protección fuerte contra spam, límites por IP o unicidad real requieren un backend confiable y quedan fuera del alcance estático de este proyecto. Restringí APIs/dominios según las recomendaciones de Firebase sin bloquear los servicios necesarios.

## 6. Probar localmente (sin Node.js)

Necesitás conexión a Internet: Firebase se importa por HTTPS. No abras los HTML con `file://`, porque los módulos ES necesitan HTTP(S).

Desde la carpeta del proyecto:

```sh
python3 -m http.server 8000 --bind 127.0.0.1
```

Abrí:

- `http://localhost:8000/index.html`
- `http://localhost:8000/admin.html`
- `http://localhost:8000/tests/index.html` (pruebas de lógica que no escriben en Firebase).

Python se usa únicamente como servidor de archivos durante el desarrollo; no forma parte del despliegue. También podés usar el servidor estático de tu editor. No hay instalación, `npm`, `package.json` ni build.

Si Firebase no está configurado, las páginas muestran un aviso y mantienen deshabilitados los formularios. Si el CDN no puede cargar por falta de Internet o bloqueo del navegador, los módulos no arrancarán: revisá la pestaña Red/Consola. No hay modo offline de inscripción.

### Sesiones y privacidad

Las inscripciones se conservan **solo en Firestore**. No se usa `localStorage` ni caché persistente de Firestore. Authentication usa `sessionStorage` exclusivamente para su sesión: resiste recargas de esa pestaña y termina al cerrarla. Al cerrar sesión se cancela el listener, se borra la tabla y se cierran/limpian los editores. Usá equipos confiables, cerrá sesión y no compartas archivos CSV con personas ajenas al evento.

La página pública no lee el documento después de crearlo: muestra el ID conocido por el cliente solo cuando Firebase confirma la escritura. El código sirve como referencia para la organización, no como contraseña ni como enlace de consulta pública.

## 7. Publicar en GitHub Pages

1. Creá un repositorio, por ejemplo `reunion-fin-ano`.
2. Subí estos archivos a la raíz de la rama `main`, incluidos `.nojekyll` y la configuración web pública de Firebase. Nunca subas contraseñas o credenciales de servicio.
3. En **Settings → Pages → Build and deployment**, elegí **Deploy from a branch**.
4. Elegí `main` y `/ (root)`, guardá y esperá el despliegue.
5. Abrí `https://usuario.github.io/reunion-fin-ano/` y `https://usuario.github.io/reunion-fin-ano/admin.html`.
6. Agregá `usuario.github.io` a los dominios autorizados de Authentication.
7. Repetí las pruebas de permisos y funcionalidades en esa URL, no solo en localhost.

Todas las rutas propias son relativas (`./css/…`, `./js/…`, `./admin.html`). No hay rutas SPA ni un servidor backend. El SDK de Firebase usa URLs externas absolutas intencionalmente. Las reglas se publican por separado en Firebase Console.

## Modelo y decisiones técnicas

```js
// inscripciones/{ID de 20 caracteres}
{
  titular: 'Juan Pérez',
  invitados: [
    { nombre: 'María López', tipo: 'mayor' },
    { nombre: 'Pedro Pérez', tipo: 'menor' },
    { nombre: 'Lucía Pérez', tipo: 'menor' }
  ],
  pagado: false,
  fechaRegistro: serverTimestamp()
}
```

- El titular es siempre mayor. No se guardan totales redundantes: se calculan desde los integrantes.
- `pagado` describe el **grupo**, no cada persona. No se guardan importes por inscripción ni se supone que menores y mayores pagan lo mismo. El precio guardado en la configuración es solo una referencia. A futuro pueden diseñarse pagos por persona con IDs estables y una colección/subcolección propia; requerirá migración y reglas nuevas. Hoy esa subcolección no tiene permisos.
- `onSnapshot` actualiza estadísticas y lista automáticamente. Las tarjetas pagadas/pendientes cuentan **personas**, no grupos ni dinero.
- `configuracion/evento` es el único documento de ajustes públicos. Guarda `nombre`, `lugar`, `fecha`, `limiteConfirmacion`, `limitePago`, `ticketCentavos` y `actualizadoEn`. Las tres fechas son timestamps a las 03:00 UTC (medianoche de Uruguay); el cierre se deriva sumando un día a `limiteConfirmacion`. Los centavos son enteros para evitar errores de coma flotante. `actualizadoEn` usa `serverTimestamp()` y permite detectar ediciones simultáneas.
- Cambiar un pago actualiza solo `pagado`. Editar participantes usa una transacción para detectar cambios simultáneos en nombres/invitados y conserva pago y fecha.
- Se bloquean botones en operaciones pendientes y se reutiliza el ID en reintentos dentro de la página. No se garantiza deduplicación entre dispositivos, recargas o inscripciones independientes: no se pide identidad única y dos personas pueden tener el mismo nombre. No se impone una falsa unicidad por nombre.
- Si la conexión se corta durante una escritura, Firebase puede dejarla pendiente en memoria hasta reconectar. Esperá la confirmación y no cierres la pestaña. Los botones muestran el estado; no se promete éxito antes de la respuesta del servidor.
- Los textos ingresados se renderizan mediante `textContent` y valores de inputs, nunca como HTML. CSV entrecomillado, BOM UTF-8, separador `;`, fórmulas neutralizadas.
- Los diálogos usan `<dialog>`: se requieren navegadores modernos con soporte de módulos ES y dialog (Chrome, Edge, Firefox y Safari actuales).

## 8. Pruebas obligatorias y de seguridad

### Pruebas locales automatizadas

```sh
python3 tests/verificar.py
```

Verifica estructura HTML, IDs, rutas relativas, imports internos, consistencia de versión de Firebase, ausencia de persistencia local de datos y posiciones cubiertas por reglas. No equivale a ejecutar el motor de Rules.

`tests/index.html` ejecuta pruebas de lógica real en el navegador: nombres, categorías, límite, titular, totales, estadísticas, filtros, orden, CSV y cierre exacto. No requiere configuración ni SDK de Firebase y no modifica datos.

### Pruebas automáticas de reglas en emulador (opcional, sin Node.js)

Para repetir las pruebas de seguridad sin tocar Firebase real, necesitás Java 21 o superior y el JAR oficial de [Firestore Emulator](https://firebase.google.com/docs/emulator-suite/install_and_configure). Las herramientas de prueba no son dependencias de la aplicación ni se publican en Pages.

Descargá el JAR en una carpeta temporal, fuera del repositorio:

```sh
curl -fLo /tmp/cloud-firestore-emulator.jar https://storage.googleapis.com/firebase-preview-drop/emulator/cloud-firestore-emulator-v1.19.8.jar
java -jar /tmp/cloud-firestore-emulator.jar --host 127.0.0.1 --port 8787 --project_id demo-reunion-test --rules ./firestore.rules
```

En otra terminal:

```sh
python3 tests/firestore.test.py
```

La prueba usa exclusivamente `127.0.0.1:8787` y el proyecto ficticio `demo-reunion-test`. Verifica compilación de las reglas, altas anónimas, todos los invitados, límites, campos inesperados, lecturas prohibidas, pago público denegado, permisos del admin y fecha inmutable. También comprueba lectura pública de los ajustes, edición privada, fechas, precio y cierre/reapertura cambiando el documento del evento **solo dentro del emulador**. Restaura reglas y limpia sus documentos al terminar; nunca edita `firestore.rules` ni accede a producción. Los tokens ficticios solo son aceptados por el emulador. No uses este emulador como servidor de la aplicación publicada ni ejecutes esta suite sobre un emulador con datos que quieras conservar: administra el documento de configuración del proyecto demo.

### Integración contra Firebase (realizar manualmente)

Usá un proyecto de prueba y nombres ficticios; luego borrá esos datos desde el panel o Console. La siguiente matriz no debe considerarse aprobada hasta ejecutarla con tus credenciales, reglas publicadas y fecha configurada.

| Escenario | Resultado esperado |
| --- | --- |
| Público: solo Juan Pérez | 1 persona, 1 mayor, 0 menores; documento con pago falso y timestamp del servidor |
| Público: Juan + María mayor + Pedro menor + Lucía menor | 4 personas, 2 mayores, 2 menores; código coincide con ID |
| Doble clic en confirmar | Un único documento en esa operación |
| Nombre vacío, una palabra o invitado incompleto | No permite enviar |
| 10 invitados / intento de invitado 11 | Admite 10; bloquea el 11 en interfaz y reglas |
| Público intenta `get` o `list` | `permission-denied`, aun con un código conocido |
| Público intenta `update`, `delete` o crear con `pagado: true` | Denegado |
| Público intenta campos extra o tipo incorrecto, incluido invitado inválido en posición 10 | Denegado |
| Crear con timestamp arbitrario o cambiar `fechaRegistro` | Denegado; alta válida usa serverTimestamp |
| Crear fuera de plazo con reloj local atrasado | Denegado por request.time |
| Abrir admin sin sesión | Solo login, sin listener ni tabla privada |
| Usuario autenticado con UID distinto | Cierra esa sesión y no accede a Firestore |
| Administrador correcto: login, recarga y logout | Acceso autorizado; sesión de pestaña restaurada; datos borrados de la interfaz al salir |
| Marcar/desmarcar pago | Persistencia inmediata, colores y tarjetas de personas actualizados |
| Editar titular/invitado/categoría, agregar y quitar invitado | Cambios persistidos, totales actualizados, fecha y pago conservados |
| Dos pestañas editan el mismo grupo | Detecta cambio concurrente de integrantes; pide reabrir el editor |
| Eliminar grupo: cancelar / aceptar | Cancelar conserva; aceptar borra y actualiza estadísticas |
| Alta manual del administrador luego del cierre | Permitida; alta pública denegada |
| Buscar invitado/titular y filtrar pagos, ordenar y exportar | Resultados correctos; CSV incluye las personas de esos grupos |
| GitHub Pages en subdirectorio | CSS, imports, login y escrituras sin errores 404 |
| Pantallas de 360 px y escritorio, teclado y zoom 200% | Campos legibles, botones accesibles, tabla desplazable, diálogos utilizables |
| Primer uso sin configuración | Público cerrado; administrador puede guardar el evento desde el panel |
| Cambiar lugar, nombre, fechas y ticket | Se guardan y se reflejan en la página pública sin volver a desplegar |
| Público/UID no autorizado intenta editar ajustes | Denegado por reglas |
| Cambiar plazo a pasado y luego a futuro | Cierra y reabre las altas en interfaz y reglas, sin tocar los asistentes |
| Dos pestañas editan ajustes simultáneamente | Conserva el borrador y exige recargar la configuración antes de sobrescribir |
| Versión sin App Check: comprobar configuración en Console | Firestore y Authentication no exigen App Check; reglas de seguridad siguen activas |

Para ensayar el cierre antes de la fecha real, ajustá las fechas desde **Configuración del evento** en un proyecto de prueba. No hace falta modificar las reglas. No alteres la configuración de producción para hacer pruebas. Para comprobar un usuario no autorizado, creá una segunda cuenta de prueba desde Console, nunca cambies su UID a administrador.

### Reglas: pruebas con el simulador

En Firestore → Reglas → Rules Playground probá crear, leer, actualizar y eliminar rutas `/inscripciones/AbCdEfGhIjKlMnOpQrSt` con sesión anónima, UID distinto y UID administrador. El proyecto de prueba debe tener un documento `configuracion/evento` válido y con plazo abierto para el alta pública. Para una creación válida, usá en `fechaRegistro` un timestamp igual al tiempo de la solicitud de prueba (si la herramienta permite configurarlo); en la aplicación real eso lo resuelve `serverTimestamp()`. El simulador no reemplaza la prueba del formulario ni prueba App Check.

Casos negativos adicionales: documento sin un campo, `pagado: 'false'`, `invitados: {}`, `tipo: 'adulto'`, invitado con campo extra, lista con 11 elementos y escritura a cualquier otra colección. Todos deben rechazarse. El permiso general denegado no es un reemplazo de la validación: probá también las posiciones 0 y 9 con datos inválidos.

**Verificado durante la implementación:**

- 640 comprobaciones estáticas aprobadas.
- 50 pruebas de lógica, fechas, precio y editor DOM aprobadas en Chromium.
- 76 comprobaciones aprobadas contra Firestore Emulator, incluidos los permisos del documento de ajustes, sus validaciones y el cierre/reapertura desde la configuración; además se comprobó la restauración de reglas al finalizar.
- Flujo público con el SDK real contra el emulador: grupo de cuatro personas, revisión, guardado, código y bloqueo de doble clic.
- Dashboard con SDK real y emulador: consulta, pago del grupo, quitar invitado, actualización en vivo, eliminación confirmada y limpieza al salir. **La frontera de Authentication fue simulada en esta prueba de interfaz**, no se comprobó un login de producción.
- Ajustes con SDK real y emulador: primer guardado, actualización de una página pública abierta, precio con decimales, plazos dinámicos, conservación de inscripciones, confirmación reabierta ante cambios y rechazo de edición concurrente. Revisión del formulario de ajustes a 360 y 1440 px, sin desbordes. No se realizaron escrituras en producción.
- Sin desbordes de página a 360, 768 y 1440 px; tabla con scroll propio y navegación desde un subdirectorio `/reunion-fin-ano/`. Revisión visual de la página pública en móvil y escritorio. Para sortear una limitación de red del navegador del entorno de pruebas, se sirvió una copia temporal del SDK oficial sin cambiar los archivos entregados.

**Pendiente de verificar con tu proyecto:** Authentication real (incluyendo recarga y UID no autorizado), persistencia/permisos en Firebase desplegado, desactivación de la exigencia de App Check si estaba habilitada y GitHub Pages remoto. No se dan por realizados sin tu configuración. No actives el enlace público hasta completar la matriz.

## Resolución rápida de problemas

- **Falta configurar Firebase / UID:** reemplazá marcadores en los archivos indicados.
- **`permission-denied` al inscribirse:** verificá que las reglas completas estén publicadas en el proyecto y base `(default)` usados por la app; revisá fecha del servidor y tipos/campos. Esta versión no usa App Check: si lo exigís desde Console, desactivá esa exigencia según el apartado 5.
- **`permission-denied` al administrar:** compará el UID de la cuenta con las reglas y `js/config.js`.
- **Credenciales inválidas:** revisá la cuenta creada manualmente y proveedor Email/Password. No publiques claves de acceso para depurar.
- **Carga infinita / red fallida:** revisá conectividad, bloqueo de gstatic/googleapis y dominios autorizados; no cierres una escritura pendiente sin verificarla luego en Console.
- **Cambiaste ajustes pero no se refleja:** confirmá que guardaste desde el panel y que se usa el mismo proyecto Firebase. Los cambios de nombre, fechas, lugar y ticket no requieren desplegar de nuevo. Para cambios de código, esperá el despliegue de Pages y recargá sin caché; para cambios de reglas, publicalas por separado en Console.

La retención y eliminación de nombres, el consentimiento aplicable y la distribución del CSV son responsabilidad de la organización. Eliminá los datos cuando ya no sean necesarios.
# reunionantel
