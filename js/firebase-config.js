import { initializeApp } from 'https://www.gstatic.com/firebasejs/12.6.0/firebase-app.js';
import { getFirestore } from 'https://www.gstatic.com/firebasejs/12.6.0/firebase-firestore.js';
import { initializeAuth, browserSessionPersistence } from 'https://www.gstatic.com/firebasejs/12.6.0/firebase-auth.js';
import { initializeAppCheck, ReCaptchaV3Provider } from 'https://www.gstatic.com/firebasejs/12.6.0/firebase-app-check.js';

// Copiar desde Firebase Console > Configuración del proyecto > Tus apps.
// Estos identificadores son públicos; la seguridad está en las reglas y Authentication.
export const firebaseConfig = {
  apiKey: 'REEMPLAZAR_API_KEY',
  authDomain: 'REEMPLAZAR_PROYECTO.firebaseapp.com',
  projectId: 'REEMPLAZAR_PROYECTO',
  storageBucket: 'REEMPLAZAR_PROYECTO.firebasestorage.app',
  messagingSenderId: 'REEMPLAZAR_SENDER_ID',
  appId: 'REEMPLAZAR_APP_ID',
};

// Opcional: clave PÚBLICA de sitio reCAPTCHA v3 registrada en App Check.
export const appCheckSiteKey = '';

let services;
let adminAuth;

export function getFirebase() {
  if (services) return services;
  if (Object.values(firebaseConfig).some((value) => !value || value.includes('REEMPLAZAR'))) {
    throw new Error('Falta configurar Firebase en js/firebase-config.js. Consultá el README.');
  }
  const app = initializeApp(firebaseConfig);
  if (appCheckSiteKey) {
    initializeAppCheck(app, {
      provider: new ReCaptchaV3Provider(appCheckSiteKey),
      isTokenAutoRefreshEnabled: true,
    });
  }
  // Sin caché persistente de Firestore: no almacenamos inscripciones en localStorage/IndexedDB.
  services = { app, db: getFirestore(app) };
  return services;
}

export function getAdminAuth() {
  if (!adminAuth) {
    // La sesión sobrevive a recargas en esta pestaña, no al cierre de la misma.
    // Solo el token de Authentication usa sessionStorage, nunca las inscripciones.
    adminAuth = initializeAuth(getFirebase().app, { persistence: browserSessionPersistence });
  }
  return adminAuth;
}
