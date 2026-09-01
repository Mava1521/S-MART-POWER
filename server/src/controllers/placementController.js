import { db } from "../config/firebaseAdmin.js";
import { isPointInPolygon } from "../utils/geometry.js";

const placementsRef = (eventId, zoneId) =>
  db.collection("events").doc(eventId).collection("zones").doc(zoneId).collection("placements");

/** Lista los puntos (electrodomésticos colocados) de una zona. Acceso ya validado por requireZoneAccess. */
export async function listPlacements(req, res, next) {
  try {
    const { eventId, zoneId } = req.params;
    const snapshot = await placementsRef(eventId, zoneId).orderBy("createdAt", "asc").get();
    res.json(snapshot.docs.map((d) => ({ id: d.id, ...d.data() })));
  } catch (err) {
    next(err);
  }
}

/**
 * Coloca una unidad de un electrodoméstico. Si viene con pointId, queda agrupada bajo ese
 * "Punto" (ver pointController) — así el punto muestra su listado de equipos, y el cronograma
 * sigue contando estas mismas unidades sin cambios.
 */
export async function createPlacement(req, res, next) {
  try {
    const { eventId, zoneId } = req.params;
    const { deviceId, x, y, color, pointId } = req.body;

    if (!deviceId || x === undefined || y === undefined || !color) {
      return res.status(400).json({ error: "deviceId, x, y y color son obligatorios" });
    }
    if (x < 0 || x > 100 || y < 0 || y > 100) {
      return res.status(400).json({ error: "Las coordenadas deben estar entre 0 y 100" });
    }

    const deviceSnap = await db.collection("devices").doc(deviceId).get();
    if (!deviceSnap.exists) return res.status(404).json({ error: "Electrodoméstico no encontrado" });

    const zoneSnap = await db.collection("events").doc(eventId).collection("zones").doc(zoneId).get();
    if (!zoneSnap.exists) return res.status(404).json({ error: "Zona no encontrada" });
    if (!isPointInPolygon(Number(x), Number(y), zoneSnap.data().coordinates)) {
      return res.status(400).json({ error: "El punto debe quedar dentro del área de tu zona" });
    }

    const ref = await placementsRef(eventId, zoneId).add({
      deviceId,
      deviceName: deviceSnap.data().product || deviceSnap.data().item,
      color,
      x, y,
      pointId: pointId || null,
      createdBy: req.user.uid,
      createdAt: new Date().toISOString(),
    });

    res.status(201).json({ id: ref.id });
  } catch (err) {
    next(err);
  }
}

/** Quitar un punto de electrodoméstico (por si el usuario se equivocó). */
export async function deletePlacement(req, res, next) {
  try {
    const { eventId, zoneId, placementId } = req.params;
    await placementsRef(eventId, zoneId).doc(placementId).delete();
    res.json({ message: "Punto eliminado" });
  } catch (err) {
    next(err);
  }
}
