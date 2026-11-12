"""Prueba reglas REALES contra un emulador Firestore local, sin SDK ni Node.js.

Requiere el emulador en 127.0.0.1:8787 (README). Nunca apunta a producción.
Carga la configuración en el emulador para probar plazos editables y permisos.
"""
import base64
import copy
from datetime import datetime, timezone
import json
from pathlib import Path
import re
import secrets
import time
from urllib.error import HTTPError
from urllib.request import Request, urlopen

HOST = 'http://127.0.0.1:8787'
PROYECTO = 'demo-reunion-test'
BASE = f'{HOST}/v1/projects/{PROYECTO}/databases/(default)/documents'
NOMBRE_BASE = f'projects/{PROYECTO}/databases/(default)/documents'
ORIGINALES = Path(__file__).resolve().parents[1].joinpath('firestore.rules').read_text()
LISTA_UID = re.search(r'request.auth.uid in\s*\[([^\]]*)\]', ORIGINALES)
UIDS_CONFIGURADOS = re.findall(r'''['"]([^'"]+)['"]''', LISTA_UID.group(1))
UID_ADMIN = UIDS_CONFIGURADOS[0]
# Estos dos UID ficticios se habilitan SOLO en la memoria del emulador.
UIDS_PRUEBA = list(dict.fromkeys([*UIDS_CONFIGURADOS, 'admin-adicional-prueba-2', 'admin-adicional-prueba-3']))
REGLAS_PRUEBA = re.sub(r'request.auth.uid in\s*\[[^\]]*\]',
                      'request.auth.uid in ' + json.dumps(UIDS_PRUEBA), ORIGINALES, count=1)
creados = []
aprobadas = 0


def token(uid):
    def codificar(valor):
        return base64.urlsafe_b64encode(json.dumps(valor).encode()).decode().rstrip('=')
    ahora = int(time.time())
    return codificar({'alg': 'none', 'typ': 'JWT'}) + '.' + codificar({
        'iss': f'https://securetoken.google.com/{PROYECTO}', 'aud': PROYECTO,
        'auth_time': ahora, 'user_id': uid, 'sub': uid, 'iat': ahora, 'exp': ahora + 3600,
        'firebase': {'identities': {}, 'sign_in_provider': 'password'},
    }) + '.'


def solicitar(metodo, url, datos=None, uid=None, propietario_emulador=False):
    headers = {'Content-Type': 'application/json'}
    if uid:
        headers['Authorization'] = 'Bearer ' + token(uid)
    if propietario_emulador:
        # Bypass exclusivo del emulador local para limpiar sus fixtures de configuración.
        headers['Authorization'] = 'Bearer owner'
    request = Request(url, data=json.dumps(datos).encode() if datos is not None else None,
                      headers=headers, method=metodo)
    try:
        with urlopen(request, timeout=30) as respuesta:
            contenido = respuesta.read()
            return respuesta.status, json.loads(contenido) if contenido else {}
    except HTTPError as error:
        return error.code, json.loads(error.read())


def comprobar(nombre, respuesta, esperado=200):
    global aprobadas
    estado, contenido = respuesta
    if estado != esperado:
        raise AssertionError(f'{nombre}: esperado HTTP {esperado}, recibido {estado}: {contenido}')
    aprobadas += 1
    print(f'✓ {nombre}')
    return contenido


def cargar_reglas(texto):
    comprobar('Compilación de reglas en emulador', solicitar('PUT',
        f'{HOST}/emulator/v1/projects/{PROYECTO}:securityRules',
        {'rules': {'files': [{'name': 'firestore.rules', 'content': texto}]}}))


def valor(dato):
    if isinstance(dato, bool):
        return {'booleanValue': dato}
    if isinstance(dato, str):
        return {'stringValue': dato}
    if isinstance(dato, datetime):
        return {'timestampValue': dato.isoformat().replace('+00:00', 'Z')}
    if isinstance(dato, list):
        return {'arrayValue': {'values': [valor(item) for item in dato]}}
    if isinstance(dato, dict):
        return {'mapValue': {'fields': {clave: valor(item) for clave, item in dato.items()}}}
    if isinstance(dato, int):
        return {'integerValue': str(dato)}
    if isinstance(dato, float):
        return {'doubleValue': dato}
    return {'nullValue': None}


def nueva(datos=None, uid=None, servidor=True, coleccion='inscripciones', identificador=None):
    identificador = identificador or secrets.token_hex(10)
    ruta = f'{coleccion}/{identificador}'
    documento = {'name': f'{NOMBRE_BASE}/{ruta}', 'fields': {
        clave: valor(item) for clave, item in (datos or {'titular': 'Juan Pérez', 'invitados': [], 'pagado': False}).items()
    }}
    escritura = {'update': documento, 'currentDocument': {'exists': False}}
    if servidor:
        escritura['updateTransforms'] = [{'fieldPath': 'fechaRegistro', 'setToServerValue': 'REQUEST_TIME'}]
    else:
        documento['fields']['fechaRegistro'] = {'timestampValue': '2020-01-01T00:00:00Z'}
    respuesta = solicitar('POST', BASE + ':commit', {'writes': [escritura]}, uid)
    if respuesta[0] == 200:
        creados.append(ruta)
    return respuesta, ruta


def editar(ruta, datos, uid=None):
    return solicitar('PATCH', f'{BASE}/{ruta}?' + '&'.join(f'updateMask.fieldPaths={clave}' for clave in datos),
                     {'fields': {clave: valor(item) for clave, item in datos.items()}}, uid)


def datos_evento(anio=2099):
    return {
        'nombre': 'Encuentro de prueba', 'lugar': 'Club Social',
        'fecha': datetime(anio, 12, 4, 3, tzinfo=timezone.utc),
        'limiteConfirmacion': datetime(anio, 11, 27, 3, tzinfo=timezone.utc),
        'limitePago': datetime(anio, 12, 1, 3, tzinfo=timezone.utc),
        'ticketCentavos': 100000,
    }


def configurar(datos=None, uid=UID_ADMIN, servidor=True):
    campos = {clave: valor(item) for clave, item in (datos if datos is not None else datos_evento()).items()}
    escritura = {'update': {'name': NOMBRE_BASE + '/configuracion/evento', 'fields': campos}}
    if servidor:
        escritura['updateTransforms'] = [{'fieldPath': 'actualizadoEn', 'setToServerValue': 'REQUEST_TIME'}]
    else:
        campos['actualizadoEn'] = {'timestampValue': '2020-01-01T00:00:00Z'}
    return solicitar('POST', BASE + ':commit', {'writes': [escritura]}, uid)


try:
    # Compila primero los archivos tal como se entregan, sin modificar producción.
    cargar_reglas(ORIGINALES)
    cargar_reglas(REGLAS_PRUEBA)
    solicitar('DELETE', BASE + '/configuracion/evento', propietario_emulador=True)
    comprobar('Sin configuración no se puede crear una inscripción pública', nueva()[0], 403)
    comprobar('Administrador puede registrar manualmente sin configuración', nueva(uid=UID_ADMIN)[0])
    comprobar('Público no puede crear configuración', configurar(uid=None), 403)
    comprobar('UID distinto no puede crear configuración', configurar(uid='no-autorizado'), 403)
    comprobar('Administrador crea configuración del evento', configurar())
    comprobar('Público puede leer solamente el documento del evento', solicitar('GET', BASE + '/configuracion/evento'))
    comprobar('Público no puede listar la colección de configuración', solicitar('GET', BASE + '/configuracion'), 403)
    comprobar('Público no puede leer otro documento de configuración', solicitar('GET', BASE + '/configuracion/privada'), 403)
    comprobar('Público no puede modificar el ticket', configurar({**datos_evento(), 'ticketCentavos': 1}, uid=None), 403)
    comprobar('UID distinto no puede modificar la configuración', configurar(uid='no-autorizado'), 403)
    comprobar('Administrador no puede borrar la configuración', solicitar('DELETE', BASE + '/configuracion/evento', uid=UID_ADMIN), 403)
    comprobar('Configuración rechaza campo extra', configurar({**datos_evento(), 'adminUid': 'intruso'}), 403)
    comprobar('La configuración del evento no permite cambiar la lista de administradores', configurar({**datos_evento(), 'adminUids': ['intruso']}), 403)
    comprobar('Configuración rechaza campo faltante', configurar({clave: dato for clave, dato in datos_evento().items() if clave != 'nombre'}), 403)
    comprobar('Configuración rechaza título vacío', configurar({**datos_evento(), 'nombre': ''}), 403)
    comprobar('Configuración rechaza lugar demasiado largo', configurar({**datos_evento(), 'lugar': 'x' * 181}), 403)
    comprobar('Configuración rechaza ticket negativo', configurar({**datos_evento(), 'ticketCentavos': -1}), 403)
    comprobar('Configuración rechaza centavos fraccionarios', configurar({**datos_evento(), 'ticketCentavos': 100.5}), 403)
    comprobar('Configuración rechaza importe excesivo', configurar({**datos_evento(), 'ticketCentavos': 100000001}), 403)
    comprobar('Configuración rechaza fecha como texto', configurar({**datos_evento(), 'fecha': '2099-12-04'}), 403)
    comprobar('Configuración exige medianoche de Uruguay', configurar({**datos_evento(), 'fecha': datetime(2099, 12, 4, tzinfo=timezone.utc)}), 403)
    comprobar('Configuración rechaza confirmación posterior al pago', configurar({**datos_evento(), 'limiteConfirmacion': datetime(2099, 12, 2, 3, tzinfo=timezone.utc)}), 403)
    comprobar('Configuración rechaza pago posterior al evento', configurar({**datos_evento(), 'limitePago': datetime(2099, 12, 5, 3, tzinfo=timezone.utc)}), 403)
    comprobar('Actualización del evento exige timestamp del servidor', configurar(servidor=False), 403)
    respuesta, ruta = nueva()
    comprobar('Público crea titular solo con serverTimestamp', respuesta)
    invitado = {'nombre': 'María López', 'tipo': 'mayor'}
    grupo = {'titular': 'Juan Pérez', 'invitados': [invitado,
        {'nombre': 'Pedro Pérez', 'tipo': 'menor'}, {'nombre': 'Lucía Pérez', 'tipo': 'menor'}], 'pagado': False}
    comprobar('Público crea titular y tres invitados', nueva(grupo)[0])
    comprobar('Público no puede leer un documento', solicitar('GET', BASE + '/' + ruta), 403)
    comprobar('Público no puede listar', solicitar('GET', BASE + '/inscripciones'), 403)
    comprobar('Público no puede marcar pago', editar(ruta, {'pagado': True}), 403)
    comprobar('Público no puede editar nombre', editar(ruta, {'titular': 'Otra Persona'}), 403)
    comprobar('Público no puede borrar', solicitar('DELETE', BASE + '/' + ruta), 403)
    comprobar('UID distinto no puede listar', solicitar('GET', BASE + '/inscripciones', uid='no-autorizado'), 403)
    comprobar('UID distinto no puede leer documento', solicitar('GET', BASE + '/' + ruta, uid='no-autorizado'), 403)
    comprobar('UID distinto no puede editar', editar(ruta, {'pagado': True}, 'no-autorizado'), 403)
    comprobar('Público no puede crearse pagado', nueva({**grupo, 'pagado': True})[0], 403)
    comprobar('Público no puede escribir en otra colección', nueva(coleccion='secretos')[0], 403)
    comprobar('ID de alta inválido rechazado', nueva(identificador='id-corto')[0], 403)
    comprobar('Timestamp arbitrario rechazado', nueva(servidor=False)[0], 403)
    comprobar('Campo extra de documento rechazado', nueva({**grupo, 'admin': True})[0], 403)
    comprobar('Campo faltante rechazado', nueva({'titular': 'Juan Pérez', 'pagado': False})[0], 403)
    comprobar('Nombre de una palabra rechazado', nueva({**grupo, 'titular': 'Juan'})[0], 403)
    comprobar('Nombre demasiado largo rechazado', nueva({**grupo, 'titular': 'Juan ' + 'x' * 120})[0], 403)
    comprobar('Tipo de titular inválido rechazado', nueva({**grupo, 'titular': 25})[0], 403)
    comprobar('Pago no booleano rechazado', nueva({**grupo, 'pagado': 'false'})[0], 403)
    comprobar('Invitados debe ser lista', nueva({**grupo, 'invitados': {}})[0], 403)
    for posicion in range(10):
        invitados = [copy.deepcopy(invitado) for _ in range(10)]
        invitados[posicion]['tipo'] = 'adulto'
        comprobar(f'Invitado inválido en posición {posicion + 1} rechazado', nueva({**grupo, 'invitados': invitados})[0], 403)
    comprobar('Campo extra de invitado rechazado', nueva({**grupo, 'invitados': [{**invitado, 'pagado': True}]})[0], 403)
    comprobar('Invitado no mapa rechazado', nueva({**grupo, 'invitados': ['Persona Invitada']})[0], 403)
    comprobar('Lista con 10 invitados aceptada', nueva({**grupo, 'invitados': [invitado] * 10})[0])
    comprobar('Lista con 11 invitados rechazada', nueva({**grupo, 'invitados': [invitado] * 11})[0], 403)
    documento = comprobar('Administrador puede leer', solicitar('GET', BASE + '/' + ruta, uid=UID_ADMIN))
    fecha = documento['fields']['fechaRegistro']['timestampValue']
    comprobar('Administrador puede listar', solicitar('GET', BASE + '/inscripciones', uid=UID_ADMIN))
    comprobar('Administrador marca pago', editar(ruta, {'pagado': True}, UID_ADMIN))
    comprobar('Administrador desmarca pago', editar(ruta, {'pagado': False}, UID_ADMIN))
    comprobar('Administrador edita participantes', editar(ruta, {'titular': 'Ana López', 'invitados': [invitado]}, UID_ADMIN))
    comprobar('Administrador quita invitado', editar(ruta, {'invitados': []}, UID_ADMIN))
    modificado = comprobar('Fecha original se conserva al editar', solicitar('GET', BASE + '/' + ruta, uid=UID_ADMIN))
    assert modificado['fields']['fechaRegistro']['timestampValue'] == fecha
    escritura = {'update': {'name': NOMBRE_BASE + '/' + ruta, 'fields': {}},
                 'updateMask': {'fieldPaths': ['fechaRegistro']},
                 'updateTransforms': [{'fieldPath': 'fechaRegistro', 'setToServerValue': 'REQUEST_TIME'}]}
    comprobar('Administrador no cambia fechaRegistro', solicitar('POST', BASE + ':commit', {'writes': [escritura]}, UID_ADMIN), 403)
    comprobar('Administrador no agrega campos extra', editar(ruta, {'total': 15}, UID_ADMIN), 403)
    for indice, uid in enumerate(UIDS_PRUEBA[1:], start=2):
        comprobar(f'Administrador {indice} puede listar inscripciones', solicitar('GET', BASE + '/inscripciones', uid=uid))
        comprobar(f'Administrador {indice} puede editar participantes', editar(ruta, {'titular': 'Grupo Compartido'}, uid))
        comprobar(f'Administrador {indice} puede marcar pagos', editar(ruta, {'pagado': True}, uid))
        comprobar(f'Administrador {indice} puede desmarcar pagos', editar(ruta, {'pagado': False}, uid))
        comprobar(f'Administrador {indice} puede guardar ajustes', configurar(uid=uid))
        respuesta_extra, ruta_extra = nueva(uid=uid)
        comprobar(f'Administrador {indice} puede crear inscripciones', respuesta_extra)
        comprobar(f'Administrador {indice} puede eliminar inscripciones', solicitar('DELETE', BASE + '/' + ruta_extra, uid=uid))
    comprobar('Administrador cambia lugar y precio', configurar({**datos_evento(), 'lugar': 'Otro Club', 'ticketCentavos': 125050}))
    comprobar('Administrador cambia el plazo a un evento pasado', configurar(datos_evento(2020)))
    comprobar('Cierre rechaza alta pública válida', nueva(grupo)[0], 403)
    comprobar('Cierre también rechaza UID no autorizado', nueva(grupo, uid='no-autorizado')[0], 403)
    comprobar('Administrador puede crear después del cierre', nueva(grupo, uid=UID_ADMIN)[0])
    for indice, uid in enumerate(UIDS_PRUEBA[1:], start=2):
        comprobar(f'Administrador {indice} puede registrar manualmente fuera de plazo', nueva(grupo, uid=uid)[0])
    comprobar('Administrador reabre el plazo desde la configuración', configurar())
    comprobar('Reabrir el plazo permite nuevamente el registro público', nueva()[0])
    comprobar('Administrador puede borrar', solicitar('DELETE', BASE + '/' + ruta, uid=UID_ADMIN))
    print(f'\n{aprobadas} pruebas de reglas aprobadas contra Firestore Emulator.')
finally:
    # Solo este proyecto demo del emulador, nunca producción. Restaurar reglas originales.
    for ruta_creada in creados:
        solicitar('DELETE', BASE + '/' + ruta_creada, uid=UID_ADMIN)
    solicitar('DELETE', BASE + '/configuracion/evento', propietario_emulador=True)
    cargar_reglas(ORIGINALES)
