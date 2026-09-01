import { db } from "../config/firebaseAdmin.js";

/** Historial de cambios de un evento/proyecto. Acceso ya filtrado por requireProjectAccess. */
export async function listAuditLogs(req, res, next) {
  try {
    const { id } = req.params;
    const snapshot = await db.collection("auditLogs")
      .where("eventId", "==", id)
      .orderBy("createdAt", "desc")
      .limit(200)
      .get();

    res.json(snapshot.docs.map((d) => ({ id: d.id, ...d.data() })));
  } catch (err) {
    next(err);
  }
}
