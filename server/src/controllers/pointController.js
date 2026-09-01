import { db } from "../config/firebaseAdmin.js";
import { isPointInPolygon } from "../utils/geometry.js";
import { colorForDevice } from "../utils/colors.js";
import { logAudit } from "../services/auditService.js";

const pointsRef = (eventId, zoneId) =>
  db.collection("events").doc(eventId).collection("zones").doc(zoneId).collection("points");

const placementsRef = (eventId, zoneId) =>
  db.collection("events").doc(eventId).collection("zones").doc(zoneId).collection("placements");

/**
 * Crea un "Punto" (una activación/ubicación con nombre propio dentro de la zona).
 * Nace "open": mientras esté así, cualquier usuario asignado a la zona lo puede seguir
 * editando (por eso otro productor puede "elegir un punto ya ubicado"), hasta que se cierre.
 */
const VALID_SIZES = ["small", "medium", "large"];

export async function createPoint(req, res, next) {
  try {
    const { eventId, zoneId } = req.params;
    const { name, x, y, size } = req.body;

    if (!name?.trim() || x === undefined || y === undefined) {
      return res.status(400).json({ error: "name, x e y son obligatorios" });
    }
    if (size !== undefined && !VALID_SIZES.includes(size)) {
      return res.status(400).json({ error: "size debe ser 'small', 'medium' o 'large'" });
    }

    const zoneSnap = await db.collection("events").doc(eventId).collection("zones").doc(zoneId).get();
    if (!zoneSnap.exists) return res.status(404).json({ error: "Zona no encontrada" });
    if (!isPointInPolygon(Number(x), Number(y), zoneSnap.data().coordinates)) {
      return res.status(400).json({ error: "El punto debe quedar dentro del área de tu zona" });
    }

    const ref = await pointsRef(eventId, zoneId).add({
      name: name.trim(),
      x, y,
      size: size || "medium",
      status: "open",
      suggestedLoadKva: null,
      createdBy: req.user.uid,
      createdAt: new Date().toISOString(),
    });

    res.status(201).json({ id: ref.id });

    logAudit({
      eventId, entityType: "point", entityId: ref.id, action: "create",
      actorUid: req.user.uid, actorEmail: req.user.email, actorRole: req.user.role,
      summary: `Creó el punto "${name.trim()}"`,
    });
  } catch (err) {
    next(err);
  }
}

/**
 * Cambia el tamaño visual (chico/mediano/grande) de un punto en el plano. Es puramente
 * estético — no depende de si el punto está abierto o cerrado, se puede ajustar siempre.
 */
export async function setPointSize(req, res, next) {
  try {
    const { eventId, zoneId, pointId } = req.params;
    const { size } = req.body;

    if (!VALID_SIZES.includes(size)) {
      return res.status(400).json({ error: "size debe ser 'small', 'medium' o 'large'" });
    }

    const pointRef = pointsRef(eventId, zoneId).doc(pointId);
    const pointSnap = await pointRef.get();
    if (!pointSnap.exists) return res.status(404).json({ error: "Punto no encontrado" });

    await pointRef.update({ size });
    res.json({ size });
  } catch (err) {
    next(err);
  }
}

/** Lista los puntos de la zona, cada uno con su listado de equipos ya agregado por cantidad. */
export async function listPoints(req, res, next) {
  try {
    const { eventId, zoneId } = req.params;
    const [pointsSnap, placementsSnap] = await Promise.all([
      pointsRef(eventId, zoneId).orderBy("createdAt", "asc").get(),
      placementsRef(eventId, zoneId).get(),
    ]);

    const devicesByPoint = {};
    placementsSnap.docs.forEach((doc) => {
      const p = doc.data();
      if (!p.pointId) return;
      if (!devicesByPoint[p.pointId]) devicesByPoint[p.pointId] = {};
      if (!devicesByPoint[p.pointId][p.deviceId]) {
        devicesByPoint[p.pointId][p.deviceId] = { deviceName: p.deviceName, color: p.color, quantity: 0 };
      }
      devicesByPoint[p.pointId][p.deviceId].quantity += 1;
    });

    const points = pointsSnap.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
      devices: Object.entries(devicesByPoint[doc.id] || {}).map(([deviceId, info]) => ({ deviceId, ...info })),
    }));

    res.json(points);
  } catch (err) {
    next(err);
  }
}

/**
 * Define la cantidad exacta de un electrodoméstico en un punto (crea o quita unidades
 * -placements- para que coincidan). Solo se puede editar mientras el punto esté "open".
 */
export async function setPointDeviceQuantity(req, res, next) {
  try {
    const { eventId, zoneId, pointId } = req.params;
    const { deviceId, quantity } = req.body;

    if (!deviceId || quantity === undefined || Number(quantity) < 0) {
      return res.status(400).json({ error: "deviceId y quantity (>= 0) son obligatorios" });
    }

    const pointSnap = await pointsRef(eventId, zoneId).doc(pointId).get();
    if (!pointSnap.exists) return res.status(404).json({ error: "Punto no encontrado" });
    if (pointSnap.data().status === "closed") {
      return res.status(400).json({ error: "Este punto ya está cerrado y no se puede editar" });
    }

    const deviceSnap = await db.collection("devices").doc(deviceId).get();
    if (!deviceSnap.exists) return res.status(404).json({ error: "Electrodoméstico no encontrado" });

    const existingSnap = await placementsRef(eventId, zoneId)
      .where("pointId", "==", pointId)
      .where("deviceId", "==", deviceId)
      .get();

    const current = existingSnap.size;
    const target = Math.floor(Number(quantity));
    const point = pointSnap.data();
    const batch = db.batch();

    if (target > current) {
      for (let i = 0; i < target - current; i++) {
        batch.set(placementsRef(eventId, zoneId).doc(), {
          deviceId,
          deviceName: deviceSnap.data().product || deviceSnap.data().item,
          color: colorForDevice(deviceId),
          x: point.x, y: point.y,
          pointId,
          createdBy: req.user.uid,
          createdAt: new Date().toISOString(),
        });
      }
    } else if (target < current) {
      existingSnap.docs.slice(0, current - target).forEach((doc) => batch.delete(doc.ref));
    }

    await batch.commit();
    res.json({ deviceId, quantity: target });
  } catch (err) {
    next(err);
  }
}

/**
 * Elimina un punto (y sus electrodomésticos colocados). Solo tiene sentido para un usuario
 * arreglando su propio trabajo, así que se bloquea en cuanto SU productor ya aprobó su
 * cronograma de esta zona — borrar un punto después de esa aprobación invalidaría lo que el
 * productor ya revisó. Antes de esa aprobación (o si el usuario ni siquiera ha enviado
 * cronograma todavía), se puede borrar libremente, esté el punto abierto o cerrado.
 */
export async function deletePoint(req, res, next) {
  try {
    const { eventId, zoneId, pointId } = req.params;

    const pointRef = pointsRef(eventId, zoneId).doc(pointId);
    const pointSnap = await pointRef.get();
    if (!pointSnap.exists) return res.status(404).json({ error: "Punto no encontrado" });

    if (req.user.role === "user") {
      const scheduleSnap = await db.collection("events").doc(eventId).collection("zones").doc(zoneId)
        .collection("schedules").doc(req.user.uid).get();
      const chain = scheduleSnap.exists ? scheduleSnap.data().reviewChain : null;
      const productorStep = Array.isArray(chain) ? chain.find((s) => s.role === "productor") : null;
      if (productorStep?.status === "approved") {
        return res.status(400).json({ error: "Tu productor ya aprobó tu cronograma, así que ya no puedes eliminar puntos. Pídele que solicite una corrección si necesitas cambiar algo." });
      }
    }

    const placementsSnap = await placementsRef(eventId, zoneId).where("pointId", "==", pointId).get();
    const batch = db.batch();
    placementsSnap.docs.forEach((d) => batch.delete(d.ref));
    batch.delete(pointRef);
    await batch.commit();

    res.json({ message: "Punto eliminado" });

    logAudit({
      eventId, entityType: "point", entityId: pointId, action: "delete",
      actorUid: req.user.uid, actorEmail: req.user.email, actorRole: req.user.role,
      summary: `Eliminó el punto "${pointSnap.data().name}"`,
    });
  } catch (err) {
    next(err);
  }
}

/** Cierra el punto ("Verificado"): ya no se puede editar, y opcionalmente guarda el estimado propio del productor. */
export async function closePoint(req, res, next) {
  try {
    const { eventId, zoneId, pointId } = req.params;
    const { suggestedLoadKva } = req.body;

    const pointRef = pointsRef(eventId, zoneId).doc(pointId);
    const pointSnap = await pointRef.get();
    if (!pointSnap.exists) return res.status(404).json({ error: "Punto no encontrado" });

    const placementsSnap = await placementsRef(eventId, zoneId).where("pointId", "==", pointId).limit(1).get();
    if (placementsSnap.empty) {
      return res.status(400).json({ error: "Agrega al menos un electrodoméstico antes de cerrar el punto" });
    }

    await pointRef.update({
      status: "closed",
      suggestedLoadKva: suggestedLoadKva !== undefined && suggestedLoadKva !== "" ? Number(suggestedLoadKva) : null,
      closedAt: new Date().toISOString(),
      closedBy: req.user.uid,
    });

    res.json({ message: "Punto cerrado" });

    logAudit({
      eventId, entityType: "point", entityId: pointId, action: "update",
      actorUid: req.user.uid, actorEmail: req.user.email, actorRole: req.user.role,
      summary: `Cerró el punto "${pointSnap.data().name}"`,
    });
  } catch (err) {
    next(err);
  }
}
