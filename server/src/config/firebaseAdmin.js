import admin from "firebase-admin";
import { env } from "./env.js";

if (!admin.apps.length) {
  // 1. Obtener la clave
  let rawKey = env.firebase.privateKey || "";

  // 2. Si viene envuelta en comillas extra en Render, quitárselas
  if (rawKey.startsWith('"') && rawKey.endsWith('"')) {
    rawKey = rawKey.substring(1, rawKey.length - 1);
  }

  // 3. Reemplazar saltos de línea dobles o simples escapados por saltos de línea reales
  const formattedPrivateKey = rawKey.replace(/\\n/g, "\n");

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