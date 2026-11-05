import { onAuthStateChanged, signInWithEmailAndPassword, signOut } from 'https://www.gstatic.com/firebasejs/12.6.0/firebase-auth.js';
import { EVENTO } from './config.js';
import { getAdminAuth } from './firebase-config.js';

export function observarSesion({ onAdmin, onExit, onError }) {
  const auth = getAdminAuth();
  return onAuthStateChanged(auth, async (usuario) => {
    if (!usuario) { onExit(); return; }
    // Este control solo mejora la interfaz. La autorización real está en firestore.rules.
    if (usuario.uid !== EVENTO.adminUid) {
      onExit();
      try { await signOut(auth); } catch { /* Las reglas siguen bloqueando los datos. */ }
      onError('Esta cuenta no está autorizada para administrar el evento.');
      return;
    }
    onAdmin(usuario);
  }, () => onError('No se pudo comprobar la sesión. Recargá la página.'));
}

export async function iniciarSesion(correo, clave) {
  // No hay registro de usuarios en esta aplicación.
  return signInWithEmailAndPassword(getAdminAuth(), correo, clave);
}

export async function cerrarSesion() {
  return signOut(getAdminAuth());
}
