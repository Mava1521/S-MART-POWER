import admin from "firebase-admin";
import { env } from "./env.js";

// Se inicializa UNA sola vez. Este SDK tiene acceso total (ignora firestore.rules),
// por eso TODA la lógica de permisos vive aquí en el backend, nunca solo en el cliente.
if (!admin.apps.length) {
  // Asegura que los saltos de línea de la clave privada se procesen correctamente en Render
  const formattedPrivateKey = env.firebase.privateKey
    ? env.firebase.privateKey.replace(/\\n/g, "\n")
    : undefined;

  admin.initializeApp({
    credential: admin.credential.cert({
      projectId: env.firebase.projectId,
      clientEmail: env.firebase.clientEmail,
      privateKey: formattedPrivateKey,
    }),
  });
}

export const db = admin.firestore();
export const auth = admin.auth();
export default admin;