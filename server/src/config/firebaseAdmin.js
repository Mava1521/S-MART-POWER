import admin from "firebase-admin";
import { env } from "./env.js";

// Se inicializa UNA sola vez. Este SDK tiene acceso total (ignora firestore.rules),
// por eso TODA la lógica de permisos vive aquí en el backend, nunca solo en el cliente.
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert({
      projectId: env.firebase.projectId,
      clientEmail: env.firebase.clientEmail,
      privateKey: env.firebase.privateKey,
    }),
  });
}

export const db = admin.firestore();
export const auth = admin.auth();
export default admin;
