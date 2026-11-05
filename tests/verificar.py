"""Verificaciones estáticas sin paquetes externos. Ejecutar desde cualquier directorio."""
from html.parser import HTMLParser
from pathlib import Path
from datetime import datetime, timedelta, timezone
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
    pagina = 'admin.html' if archivo.name in {'admin.js', 'auth.js'} else 'index.html' if archivo.name == 'registro.js' else None
    if pagina:
        for selector in re.findall(r"(?:querySelector|\$)\(['\"]#([a-zA-Z][\w-]*)['\"]\)", texto):
            verificar(selector in documentos[pagina].ids, f'{archivo.name}: ID #{selector} no existe en {pagina}')

verificar(len(versiones) == 1, f'Versiones de Firebase inconsistentes: {versiones}')
reglas = ROOT.joinpath('firestore.rules').read_text()
config = ROOT.joinpath('js/config.js').read_text()
verificar('allow read, write: if true' not in reglas, 'Permisos globales abiertos')
for posicion in range(10):
    verificar(f'invitadoEnPosicionValido(invitados, {posicion})' in reglas, f'Invitado {posicion} sin validar')
fecha_config = re.search(r"cierreInscripciones:\s*'([^']+)'", config)
fecha_reglas = re.search(r"timestamp.date\((\d+),\s*(\d+),\s*(\d+)\)\s*\+\s*duration.value\((\d+), 'h'\)", reglas)
verificar(bool(fecha_config and fecha_reglas), 'No se pudo analizar la configuración del cierre')
if fecha_config and fecha_reglas:
    anio, mes, dia, horas = map(int, fecha_reglas.groups())
    cierre_reglas = datetime(anio, mes, dia, tzinfo=timezone.utc) + timedelta(hours=horas)
    verificar(datetime.fromisoformat(fecha_config.group(1).replace('Z', '+00:00')) == cierre_reglas,
              'Plazo de reglas y configuración desincronizado')
uid_config = re.search(r"adminUid:\s*'([^']+)'", config)
uid_reglas = re.search(r"request.auth.uid == '([^']+)'", reglas)
verificar(bool(uid_config and uid_reglas) and uid_config.group(1) == uid_reglas.group(1), 'UID desincronizado')
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
