import { db } from "../config/firebaseAdmin.js";

/**
 * Restringe acciones dentro de un evento (proyecto) a los sub-administradores y productores
 * asignados EXPLÍCITAMENTE por el admin. Admin siempre pasa. Un evento recién creado no tiene
 * a nadie asignado todavía, así que por defecto NO es visible ni gestionable para ningún
 * sub-admin/productor hasta que el admin lo asigne explícitamente (ver EventManager.jsx,
 * botones "Sub-admins" / "Productores"). Esto evita que cuentas nuevas, o eventos recién
 * creados, terminen visibles para gente a la que nunca se le asignaron.
 */
export function requireProjectAccess() {
  return async (req, res, next) => {
    if (!["subadmin", "productor"].includes(req.user.role)) return next();

    try {
      const eventId = req.params.eventId || req.params.id;
      const eventSnap = await db.collection("events").doc(eventId).get();
      if (!eventSnap.exists) return res.status(404).json({ error: "Evento no encontrado" });

      const field = req.user.role === "subadmin" ? "assignedSubadmins" : "assignedProductores";
      const assigned = eventSnap.data()[field] || [];
      if (!assigned.includes(req.user.uid)) {
        return res.status(403).json({ error: "No tienes este proyecto asignado" });
      }
      next();
    } catch (err) {
      next(err);
    }
  };
}
