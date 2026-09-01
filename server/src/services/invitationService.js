import { db } from "../config/firebaseAdmin.js";
import { generateInvitationCode } from "../utils/codeGenerator.js";

const codesCollection = db.collection("invitationCodes");

/**
 * Crea un código de invitación de un solo uso, con rol destino (usuario o productor) y
 * vencimiento opcional. createdByRole permite limitar cuántos códigos activos puede tener
 * un sub-admin, y forzar que un productor SOLO pueda invitar usuarios (nunca productores).
 */
export async function createInvitationCode({ createdBy, createdByRole, eventId, targetRole, expiresInHours }) {
  if (createdByRole === "subadmin") {
    const activeSnapshot = await codesCollection
      .where("createdBy", "==", createdBy)
      .where("used", "==", false)
      .get();

    const MAX_ACTIVE_CODES_SUBADMIN = 10;
    if (activeSnapshot.size >= MAX_ACTIVE_CODES_SUBADMIN) {
      const err = new Error("Límite de códigos activos alcanzado");
      err.status = 400;
      err.publicMessage = `Los sub-administradores solo pueden tener ${MAX_ACTIVE_CODES_SUBADMIN} códigos sin usar a la vez`;
      throw err;
    }
  }

  // El productor SOLO puede invitar usuarios (clientes), nunca otros productores ni staff.
  const finalTargetRole = createdByRole === "productor" ? "user" : (targetRole === "productor" ? "productor" : "user");

  const code = generateInvitationCode();
  const ref = codesCollection.doc();

  const expiresAt = expiresInHours
    ? new Date(Date.now() + Number(expiresInHours) * 3600000).toISOString()
    : null;

  await ref.set({
    code,
    used: false,
    usedBy: null,
    createdBy,
    eventId: eventId || null,
    targetRole: finalTargetRole,
    expiresAt,
    createdAt: new Date().toISOString(),
  });

  return { id: ref.id, code, targetRole: finalTargetRole, expiresAt };
}

/**
 * Valida y consume un código dentro de una TRANSACCIÓN, para evitar que dos
 * personas registrándose al mismo tiempo usen el mismo código (condición de carrera).
 * También revisa que no esté vencido.
 */
export async function redeemInvitationCode(code, usedByUid) {
  const query = await codesCollection.where("code", "==", code).limit(1).get();

  if (query.empty) {
    const err = new Error("Código inválido");
    err.status = 400;
    err.publicMessage = "El código de invitación no existe";
    throw err;
  }

  const docRef = query.docs[0].ref;

  return db.runTransaction(async (tx) => {
    const snap = await tx.get(docRef);
    const data = snap.data();

    if (data.used) {
      const err = new Error("Código ya usado");
      err.status = 400;
      err.publicMessage = "Este código ya fue utilizado";
      throw err;
    }

    if (data.expiresAt && new Date(data.expiresAt).getTime() < Date.now()) {
      const err = new Error("Código vencido");
      err.status = 400;
      err.publicMessage = "Este código venció. Pide uno nuevo a quien te invitó.";
      throw err;
    }

    tx.update(docRef, {
      used: true,
      usedBy: usedByUid,
      usedAt: new Date().toISOString(),
    });

    return data;
  });
}
