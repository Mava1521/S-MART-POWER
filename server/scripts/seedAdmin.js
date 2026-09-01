/**
 * Script único de arranque: crea el PRIMER administrador.
 * No existe ninguna ruta HTTP para crear admins (a propósito, por seguridad),
 * así que este script se corre UNA vez manualmente desde la terminal:
 *
 *   node scripts/seedAdmin.js correo@ejemplo.com contraseñaSegura123
 */
import "dotenv/config";
import admin from "../src/config/firebaseAdmin.js";
import { db, auth } from "../src/config/firebaseAdmin.js";

const [, , email, password] = process.argv;

if (!email || !password) {
  console.error("Uso: node scripts/seedAdmin.js correo@ejemplo.com contraseña");
  process.exit(1);
}

const user = await auth.createUser({ email, password });
await auth.setCustomUserClaims(user.uid, { role: "admin" });
await db.collection("users").doc(user.uid).set({
  role: "admin",
  email,
  createdAt: new Date().toISOString(),
});

console.log(`Administrador creado: ${email} (uid: ${user.uid})`);
process.exit(0);
