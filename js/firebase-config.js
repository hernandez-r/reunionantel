import { initializeApp } from 'https://www.gstatic.com/firebasejs/12.6.0/firebase-app.js';
import { getFirestore } from 'https://www.gstatic.com/firebasejs/12.6.0/firebase-firestore.js';
import { initializeAuth, browserSessionPersistence } from 'https://www.gstatic.com/firebasejs/12.6.0/firebase-auth.js';

// Copiar desde Firebase Console > Configuración del proyecto > Tus apps.
// Estos identificadores son públicos; la seguridad está en las reglas y Authentication.
 // Your web app's Firebase configuration

  // For Firebase JS SDK v7.20.0 and later, measurementId is optional

  const firebaseConfig = {

    apiKey: "AIzaSyBlCi24xaFtsJzgiqmbRFcvLVma1tRAvO8",

    authDomain: "antelreunion.firebaseapp.com",

    projectId: "antelreunion",

    storageBucket: "antelreunion.firebasestorage.app",

    messagingSenderId: "849834243531",

    appId: "1:849834243531:web:bfd33f54bbd03e0f46324e",

    measurementId: "G-LRGDGHQBF7"

  };


let services;
let adminAuth;

export function getFirebase() {
  if (services) return services;
  if (Object.values(firebaseConfig).some((value) => !value || value.includes('REEMPLAZAR'))) {
    throw new Error('Falta configurar Firebase en js/firebase-config.js. Consultá el README.');
  }
  const app = initializeApp(firebaseConfig);
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
