import { db } from "../config/firebaseAdmin.js";

/**
 * Autoriza el acceso a una zona específica (params :eventId/:zoneId):
 * admin, sub-admin y productor siempre pueden; un "user" solo si esa zona está en su lista
 * de asignaciones (subcolección zoneAssignments). Reutilizable en placements y cronograma.
 */
export function requireZoneAccess() {
  return async (req, res, next) => {
    if (["admin", "subadmin", "productor"].includes(req.user.role)) return next();

    try {
      const { eventId, zoneId } = req.params;
      const snap = await db
        .collection("events").doc(eventId)
        .collection("zones").doc(zoneId)
        .collection("zoneAssignments").doc(req.user.uid)
        .get();

      if (!snap.exists) {
        return res.status(403).json({ error: "No tienes esta zona asignada" });
      }
      next();
    } catch (err) {
      next(err);
    }
  };
}
