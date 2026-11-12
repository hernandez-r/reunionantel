"""Verificaciones estáticas sin paquetes externos. Ejecutar desde cualquier directorio."""
from html.parser import HTMLParser
from pathlib import Path
import re
import sys

ROOT = Path(__file__).resolve().parents[1]
errores = []
comprobaciones = 0


def verificar(condicion, descripcion):
    global comprobaciones
    comprobaciones += 1
    if not condicion:
        errores.append(descripcion)


class Documento(HTMLParser):
    def __init__(self, archivo):
        super().__init__(convert_charrefs=True)
        self.archivo = archivo
        self.ids = set()
        self.referencias = []
        self.enlaces = []
        self.pila = []

    def handle_starttag(self, tag, attrs):
        datos = dict(attrs)
        if 'id' in datos:
            verificar(datos['id'] not in self.ids, f'{self.archivo}: ID duplicado {datos["id"]}')
            self.ids.add(datos['id'])
        if tag == 'label' and 'for' in datos:
            self.referencias.append(datos['for'])
        if 'aria-labelledby' in datos:
            self.referencias.extend(datos['aria-labelledby'].split())
        for atributo in ('src', 'href'):
            if atributo in datos:
                self.enlaces.append(datos[atributo])
        if tag not in {'area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link', 'meta', 'param', 'source', 'track', 'wbr'}:
            self.pila.append(tag)

    def handle_endtag(self, tag):
        verificar(bool(self.pila) and self.pila[-1] == tag, f'{self.archivo}: cierre HTML inesperado </{tag}>')
        if self.pila and self.pila[-1] == tag:
            self.pila.pop()


documentos = {}
for archivo in ROOT.rglob('*.html'):
    doc = Documento(archivo.relative_to(ROOT))
    doc.feed(archivo.read_text())
    verificar(not doc.pila, f'{archivo.name}: etiquetas sin cerrar {doc.pila}')
    for referencia in doc.referencias:
        verificar(referencia in doc.ids, f'{archivo.name}: referencia a ID inexistente {referencia}')
    for ruta in doc.enlaces:
        if ruta.startswith('#'):
            verificar(ruta[1:] in doc.ids, f'{archivo.name}: ancla inexistente {ruta}')
        elif not ruta.startswith(('https://', 'http://', 'mailto:')):
            verificar(not ruta.startswith('/'), f'{archivo.name}: ruta absoluta incompatible con Pages {ruta}')
            verificar((archivo.parent / ruta).is_file(), f'{archivo.name}: archivo inexistente {ruta}')
    documentos[str(archivo.relative_to(ROOT))] = doc

versiones = set()
for archivo in ROOT.joinpath('js').glob('*.js'):
    texto = archivo.read_text()
    for ruta in re.findall(r"from\s+['\"]([^'\"]+)['\"]", texto):
        if ruta.startswith('.'):
            verificar((archivo.parent / ruta).is_file(), f'{archivo.name}: import inexistente {ruta}')
        else:
            version = re.search(r'gstatic.com/firebasejs/([^/]+)/', ruta)
            verificar(bool(version), f'{archivo.name}: dependencia no prevista {ruta}')
            if version:
                versiones.add(version.group(1))
    verificar(not re.search(r'localStorage\s*\.', texto), f'{archivo.name}: escritura/lectura en localStorage')
    verificar('enableIndexedDbPersistence(' not in texto, f'{archivo.name}: caché persistente no prevista')
    verificar('createUserWithEmailAndPassword' not in texto, f'{archivo.name}: creación de cuentas no prevista')
    verificar('.innerHTML' not in texto, f'{archivo.name}: inserción de HTML no prevista')
    pagina = 'admin.html' if archivo.name in {'admin.js', 'auth.js', 'configuracion-admin.js'} else 'index.html' if archivo.name == 'registro.js' else None
    if pagina:
        for selector in re.findall(r"(?:querySelector|\$)\(['\"]#([a-zA-Z][\w-]*)['\"]\)", texto):
            verificar(selector in documentos[pagina].ids, f'{archivo.name}: ID #{selector} no existe en {pagina}')

verificar(len(versiones) == 1, f'Versiones de Firebase inconsistentes: {versiones}')
firebase = ROOT.joinpath('js/firebase-config.js').read_text()
verificar('firebase-app-check.js' not in firebase, 'App Check no debe cargarse en esta versión')
verificar('initializeAppCheck' not in firebase, 'App Check no debe inicializarse en esta versión')
verificar('appCheckSiteKey' not in firebase, 'Quedó configuración obsoleta de App Check')
reglas = ROOT.joinpath('firestore.rules').read_text()
config = ROOT.joinpath('js/config.js').read_text()
verificar('allow read, write: if true' not in reglas, 'Permisos globales abiertos')
for posicion in range(10):
    verificar(f'invitadoEnPosicionValido(invitados, {posicion})' in reglas, f'Invitado {posicion} sin validar')
verificar('get(ruta).data.limiteConfirmacion' in reglas and "duration.value(1, 'd')" in reglas,
          'El cierre debe depender de la configuración guardada, no de una fecha fija')
verificar('match /configuracion/evento' in reglas and 'esAdmin() && configuracionValida' in reglas,
          'La configuración debe tener reglas propias y edición privada')
uids_config = re.search(r'adminUids:\s*Object\.freeze\(\s*\[([^\]]*)\]', config)
uids_reglas = re.search(r'request.auth.uid in\s*\[([^\]]*)\]', reglas)
verificar(bool(uids_config and uids_reglas), 'Falta la lista de UID administradores')
if uids_config and uids_reglas:
    extraer = lambda texto: re.findall(r'''['"]([^'"]*)['"]''', texto)
    lista_config = extraer(uids_config.group(1))
    lista_reglas = extraer(uids_reglas.group(1))
    verificar(bool(lista_config) and all(uid and uid == uid.strip() and len(uid) <= 128
              and 'REEMPLAZAR' not in uid and not uid.startswith('UID_REAL_')
              for uid in lista_config), 'Hay UID vacíos, inválidos o sin completar')
    verificar(len(set(lista_config)) == len(lista_config), 'Hay UID administradores duplicados')
    verificar(len(set(lista_reglas)) == len(lista_reglas), 'Hay UID duplicados en las reglas')
    verificar(set(lista_config) == set(lista_reglas), 'Las listas de UID de JavaScript y reglas están desincronizadas')
max_config = re.search(r'maxInvitados:\s*(\d+)', config)
max_reglas = re.search(r'function maxInvitados\(\)\s*\{[^}]*return (\d+);', reglas)
verificar(bool(max_config and max_reglas) and max_config.group(1) == max_reglas.group(1)
          and 0 <= int(max_config.group(1)) <= 10, 'Límite de invitados inválido o desincronizado')
verificar('request.resource.data.fechaRegistro == request.time' in reglas, 'Falta timestamp del servidor')
verificar('request.resource.data.fechaRegistro == resource.data.fechaRegistro' in reglas, 'Fecha mutable')
verificar(ROOT.joinpath('.nojekyll').is_file(), 'Falta .nojekyll')

if errores:
    print('\n'.join(f'ERROR: {error}' for error in errores))
    print(f'{len(errores)} errores en {comprobaciones} verificaciones.')
    sys.exit(1)
print(f'{comprobaciones} verificaciones estáticas aprobadas.')
print('Este chequeo estático no sustituye las pruebas de navegador ni la integración con Firebase.')
