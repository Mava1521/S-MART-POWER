import { db } from "../config/firebaseAdmin.js";

/**
 * Devuelve las notificaciones dirigidas a la persona que pregunta: las de su ROL (broadcast,
 * ej. "alguien envió un cronograma") y, además, las dirigidas específicamente a SU uid
 * (ej. "tu cronograma fue aprobado" o "te toca revisar este cronograma"). Se combinan ambas
 * consultas porque Firestore no permite un OR directo entre campos distintos.
 */
export async function listNotifications(req, res, next) {
  try {
    const [byRoleSnap, byUidSnap] = await Promise.all([
      db.collection("notifications")
        .where("targetRoles", "array-contains", req.user.role)
        .orderBy("createdAt", "desc")
        .limit(50)
        .get(),
      db.collection("notifications")
        .where("targetUid", "==", req.user.uid)
        .orderBy("createdAt", "desc")
        .limit(50)
        .get(),
    ]);

    const seen = new Map();
    [...byRoleSnap.docs, ...byUidSnap.docs].forEach((d) => seen.set(d.id, { id: d.id, ...d.data() }));

    const merged = Array.from(seen.values())
      .sort((a, b) => (b.createdAt || "").localeCompare(a.createdAt || ""))
      .slice(0, 50);

    res.json(merged);
  } catch (err) {
    next(err);
  }
}

export async function markAsRead(req, res, next) {
  try {
    const { id } = req.params;
    await db.collection("notifications").doc(id).update({ read: true });
    res.json({ message: "Notificación marcada como leída" });
  } catch (err) {
    next(err);
  }
}
