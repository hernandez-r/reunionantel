# Reunión de fin de año

Aplicación estática en HTML, CSS y JavaScript Vanilla. Formulario público, administración privada con Firebase Authentication y datos en Cloud Firestore. Sin Node.js, frameworks, compilación, servidor de aplicación ni dependencias instalables.

**Antes de usarla:** completar Firebase y el UID, publicar las reglas y realizar las pruebas contra tu proyecto. El repositorio no incluye credenciales reales ni una conexión a un proyecto de producción.

## Qué incluye

- Titular mayor de edad y hasta 10 invitados Mayor/Menor; resumen y revisión antes de enviar.
- Código de inscripción = ID aleatorio de Firestore, `serverTimestamp()` y pago pendiente. Bloqueo de doble clic e ID reutilizado en reintentos de la misma página.
- Cierre público al finalizar el **27 de noviembre de 2026, hora de Uruguay**. El servidor impide nuevas altas fuera de plazo, aunque se cambie el reloj o JavaScript.
- Login privado por correo/contraseña, validación de sesión al recargar y autorización por UID en las reglas.
- Dashboard en tiempo real, alta manual después del cierre, edición, invitados, eliminación con confirmación y pagos del grupo reversibles.
- Búsqueda sin distinción de tildes, filtro de pagos, orden A–Z/Z–A, conteo y CSV de los resultados filtrados (un renglón por persona).
- Interfaz responsive, etiquetas accesibles, diálogos nativos y mensajes de espera/error.

## Estructura

```text
index.html                 Formulario público
admin.html                 Acceso y panel privado
css/styles.css             Diseño compartido, sin librerías
js/config.js               Evento, plazos, límite y UID público del admin
js/firebase-config.js      SDK modular, configuración pública y App Check
js/registro.js             Alta pública y confirmación
js/auth.js                 Sesión de Authentication y comprobación de UID
js/admin.js                Suscripción en vivo, tabla y operaciones
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
3. No es necesario crear `inscripciones` manualmente: se crea con la primera inscripción válida.
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

Editá `js/config.js` para cambiar nombre, lugar, fecha, confirmación, pago, ticket y límite. El importe de referencia se informa para mayores. **No se calcula un total a pagar ni se asigna un precio a menores**, porque ese criterio aún no está definido.

Hay tres valores que, por seguridad, tienen su equivalente independiente en `firestore.rules`:

| Configuración de interfaz | Reglas del servidor |
| --- | --- |
| `EVENTO.adminUid` | `esAdmin()` |
| `EVENTO.maxInvitados` (entero entre 0 y 10) | `maxInvitados()` |
| `EVENTO.cierreInscripciones` | `inscripcionAbierta()` |

**Mantenelos sincronizados y volvé a publicar las reglas al cambiarlos.** `limiteConfirmacion` es el texto de fecha visible: debe concordar con el instante de cierre. El valor inicial `2026-11-28T03:00:00Z` equivale a la medianoche que inicia el 28/11 en Uruguay. Las inscripciones se admiten antes de ese instante, no en ese instante. Las fechas de pago y del evento son informativas, no bloquean al administrador.

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
- No puede leer ni siquiera un documento conociendo el código, listar, actualizar o borrar.
- El administrador puede leer, crear después del cierre, editar, eliminar y cambiar pagos.
- Cada nombre requiere al menos dos palabras, entre 3 y 120 caracteres, sin espacios iniciales/finales ni duplicados. Se permiten acentos, apóstrofes, guiones y nombres internacionales. No se puede comprobar que un nombre sea real.
- Invitados: lista de hasta el máximo configurado; cada elemento debe ser un mapa con **solo** `nombre` y `tipo`, tipo `mayor`/`menor`.
- El documento tiene **exactamente** `titular`, `invitados`, `pagado`, `fechaRegistro`. Pago booleano, timestamp del servidor al crear y fecha de registro inmutable al editar.
- El ID de alta debe ser alfanumérico de 20 caracteres, como el generado por `doc(collection(...))`.
- Todo el resto (incluidas subcolecciones) queda denegado. No hay permisos globales ni lecturas públicas.

## 5. Reducir abuso con App Check

Un formulario anónimo puede recibir nombres falsos y altas automatizadas. La validación y el plazo no son un control de identidad ni un límite de solicitudes. **App Check reduce abuso, no lo elimina** ni sustituye las reglas.

1. Registrá una clave de sitio **reCAPTCHA v3** en la consola de reCAPTCHA, para `usuario.github.io` y los dominios necesarios. La clave del sitio es pública; la clave secreta no se publica.
2. En **Firebase Console → App Check**, seleccioná la app web y configurá el proveedor reCAPTCHA v3 con los datos solicitados por la consola (la clave secreta va allí, no en el código).
3. Poné **solo la clave pública del sitio** en `appCheckSiteKey` de `js/firebase-config.js`.
4. Publicá la aplicación, probala y revisá las métricas de solicitudes verificadas en App Check.
5. Cuando funcione, activá **Enforcement / Exigir** para **Cloud Firestore**. Con enforcement, los clientes sin un token válido de App Check serán rechazados incluso si satisfacen las reglas.
6. Para desarrollo local, seguí la [documentación del proveedor de depuración](https://firebase.google.com/docs/app-check/web/debug-provider): la bandera `self.FIREBASE_APPCHECK_DEBUG_TOKEN = true` debe configurarse **localmente antes de inicializar App Check**, y el token generado debe registrarse en la consola. No publiques esa bandera, un token de depuración ni una variante de producción que omita App Check.
7. Consultá la disponibilidad de protección de Authentication con App Check para tu proyecto antes de exigirla; requiere configuración/compatibilidad adicional. El paso necesario aquí es proteger Firestore.

También revisá cuotas, uso y alertas de presupuesto. Las alertas no son un tope de gasto. Una protección fuerte contra spam, límites por IP o unicidad real requieren un backend confiable y quedan fuera del alcance estático de este proyecto. Restringí APIs/dominios según las recomendaciones de Firebase sin bloquear los servicios necesarios.

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
6. Agregá `usuario.github.io` a los dominios autorizados de Authentication y al proveedor reCAPTCHA, si corresponde.
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
- `pagado` describe el **grupo**, no cada persona. No se guardan importes ni se supone que menores y mayores pagan lo mismo. A futuro pueden diseñarse pagos por persona con IDs estables y una colección/subcolección propia; requerirá migración y reglas nuevas. Hoy esa subcolección no tiene permisos.
- `onSnapshot` actualiza estadísticas y lista automáticamente. Las tarjetas pagadas/pendientes cuentan **personas**, no grupos ni dinero.
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

La prueba usa exclusivamente `127.0.0.1:8787` y el proyecto ficticio `demo-reunion-test`. Verifica compilación de las reglas originales, altas anónimas, todos los invitados, límites, campos inesperados, lecturas prohibidas, pago público denegado, permisos del admin y fecha inmutable. Carga variantes del plazo **en la memoria del emulador** para probar abierto/cerrado de forma determinista y restaura las reglas originales al terminar; nunca edita `firestore.rules` ni accede a producción. Los tokens ficticios que construye solo son aceptados por el emulador, no por Firebase real. No uses este emulador como servidor de la aplicación publicada.

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
| App Check exigido: cliente válido / sin token | Cliente válido funciona; petición sin token rechazada |

Para ensayar el cierre antes de la fecha real, ajustá temporalmente **ambos plazos** en un proyecto de prueba. No alteres la fecha de producción para hacer pruebas. Para comprobar un usuario no autorizado, creá una segunda cuenta de prueba desde Console, nunca cambies su UID a administrador.

### Reglas: pruebas con el simulador

En Firestore → Reglas → Rules Playground probá crear, leer, actualizar y eliminar rutas `/inscripciones/AbCdEfGhIjKlMnOpQrSt` con sesión anónima, UID distinto y UID administrador. Para una creación válida, usá en `fechaRegistro` un timestamp igual al tiempo de la solicitud de prueba (si la herramienta permite configurarlo); en la aplicación real eso lo resuelve `serverTimestamp()`. El simulador no reemplaza la prueba del formulario ni prueba App Check.

Casos negativos adicionales: documento sin un campo, `pagado: 'false'`, `invitados: {}`, `tipo: 'adulto'`, invitado con campo extra, lista con 11 elementos y escritura a cualquier otra colección. Todos deben rechazarse. El permiso general denegado no es un reemplazo de la validación: probá también las posiciones 0 y 9 con datos inválidos.

**Verificado durante la implementación:**

- 538 comprobaciones estáticas aprobadas.
- 34 pruebas de lógica y editor DOM aprobadas en Chromium.
- 51 comprobaciones aprobadas contra Firestore Emulator, incluidas la compilación de las reglas originales y las variantes abierto/cerrado; además se comprobó la restauración de reglas al finalizar.
- Flujo público con el SDK real contra el emulador: grupo de cuatro personas, revisión, guardado, código y bloqueo de doble clic.
- Dashboard con SDK real y emulador: consulta, pago del grupo, quitar invitado, actualización en vivo, eliminación confirmada y limpieza al salir. **La frontera de Authentication fue simulada en esta prueba de interfaz**, no se comprobó un login de producción.
- Sin desbordes de página a 360, 768 y 1440 px; tabla con scroll propio y navegación desde un subdirectorio `/reunion-fin-ano/`. Revisión visual de la página pública en móvil y escritorio. Para sortear una limitación de red del navegador del entorno de pruebas, se sirvió una copia temporal del SDK oficial sin cambiar los archivos entregados.

**Pendiente de verificar con tu proyecto:** Authentication real (incluyendo recarga y UID no autorizado), persistencia/permisos en Firebase desplegado, App Check y GitHub Pages remoto. No se dan por realizados sin tu configuración. No actives el enlace público hasta completar la matriz.

## Resolución rápida de problemas

- **Falta configurar Firebase / UID:** reemplazá marcadores en los archivos indicados.
- **`permission-denied` al inscribirse:** revisá fecha del servidor, reglas publicadas, tipos/campos y App Check.
- **`permission-denied` al administrar:** compará el UID de la cuenta con las reglas y `js/config.js`.
- **Credenciales inválidas:** revisá la cuenta creada manualmente y proveedor Email/Password. No publiques claves de acceso para depurar.
- **Carga infinita / red fallida:** revisá conectividad, bloqueo de gstatic/googleapis/reCAPTCHA y dominios autorizados; no cierres una escritura pendiente sin verificarla luego en Console.
- **Cambiaste configuración pero no se refleja:** esperá el despliegue de Pages y recargá sin caché. Cambiar un archivo local no actualiza ni Pages ni las reglas publicadas.

La retención y eliminación de nombres, el consentimiento aplicable y la distribución del CSV son responsabilidad de la organización. Eliminá los datos cuando ya no sean necesarios.
# reunionantel
