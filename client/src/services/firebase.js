import { initializeApp } from "firebase/app";
import { getAuth, setPersistence, browserSessionPersistence } from "firebase/auth";

// Solo Auth. NO se inicializa Storage (evitamos plan Blaze) ni se usa aquí Firestore
// directamente para datos sensibles: todo pasa por el backend, que valida roles.
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);

// Sesión de navegador, no permanente: por defecto Firebase guarda la sesión en localStorage
// y la mantiene indefinidamente (por eso "siempre aparecía logueado como admin", incluso
// días después). Con browserSessionPersistence, la sesión se borra al cerrar la pestaña o
// el navegador, y hay que volver a iniciar sesión. Recargar la página (F5) NO cierra sesión
// — eso es el comportamiento normal de cualquier sitio y no tiene que ver con el problema.
setPersistence(auth, browserSessionPersistence);

export default app;
