import { db } from "../config/firebaseAdmin.js";

/**
 * Registra una entrada en el historial de cambios de un evento (proyecto).
 * eventId puede ser null para acciones globales (ej. biblioteca, que no pertenece a un evento).
 * Se llama "en caliente" desde cada controlador que modifica algo importante — no bloquea la
 * respuesta al usuario si falla (un fallo de auditoría no debe tumbar la acción real).
 */
export async function logAudit({ eventId = null, entityType, entityId, action, actorUid, actorEmail, actorRole, summary }) {
  try {
    await db.collection("auditLogs").add({
      eventId,
      entityType,   // "event" | "zone" | "point" | "schedule" | "device"
      entityId,
      action,       // "create" | "update" | "delete"
      actorUid,
      actorEmail: actorEmail || null,
      actorRole,
      summary,
      createdAt: new Date().toISOString(),
    });
  } catch (err) {
    console.error("No se pudo registrar el historial de cambios:", err.message);
  }
}
