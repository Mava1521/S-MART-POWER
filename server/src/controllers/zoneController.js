import admin, { db } from "../config/firebaseAdmin.js";
import { logAudit } from "../services/auditService.js";
const { FieldValue } = admin.firestore;

/**
 * Detalle de UNA zona para el espacio de trabajo (plano + info de la zona).
 * El middleware requireZoneAccess ya validó que quien pregunta puede verla.
 */
export async function getZoneDetail(req, res, next) {
  try {
    const { eventId, zoneId } = req.params;
    const [eventSnap, zoneSnap] = await Promise.all([
      db.collection("events").doc(eventId).get(),
      db.collection("events").doc(eventId).collection("zones").doc(zoneId).get(),
    ]);

    if (!eventSnap.exists || !zoneSnap.exists) {
      return res.status(404).json({ error: "Zona o evento no encontrado" });
    }

    res.json({
      event: { id: eventSnap.id, name: eventSnap.data().name, venueImageUrl: eventSnap.data().venueImageUrl },
      zone: { id: zoneSnap.id, ...zoneSnap.data() },
    });
  } catch (err) {
    next(err);
  }
}

/** Admin crea zonas sobre el plano (coordenadas + color). */
export async function createZone(req, res, next) {
  try {
    const { eventId } = req.params;
    const { name, color, coordinates } = req.body;

    if (!name || !color || !coordinates) {
      return res.status(400).json({ error: "name, color y coordinates son obligatorios" });
    }

    const ref = await db
      .collection("events").doc(eventId)
      .collection("zones").add({
        name,
        color,
        coordinates, // [{x, y}, ...]
        createdBy: req.user.uid,
        createdAt: new Date().toISOString(),
      });

    res.status(201).json({ id: ref.id });

    logAudit({
      eventId, entityType: "zone", entityId: ref.id, action: "create",
      actorUid: req.user.uid, actorEmail: req.user.email, actorRole: req.user.role,
      summary: `Creó la zona "${name}"`,
    });
  } catch (err) {
    next(err);
  }
}

/**
 * Duplica una zona (con sus puntos y electrodomésticos) en otro lugar del plano — del mismo
 * evento o de uno distinto. Útil para reutilizar una distribución de un evento archivado.
 * Los puntos nacen "open" de nuevo (hay que volver a verificarlos en el nuevo lugar).
 */
export async function duplicateZone(req, res, next) {
  try {
    const { eventId, zoneId } = req.params;
    const { targetEventId, x, y, name } = req.body;

    if (!targetEventId || x === undefined || y === undefined) {
      return res.status(400).json({ error: "targetEventId, x e y son obligatorios" });
    }

    const sourceZoneRef = db.collection("events").doc(eventId).collection("zones").doc(zoneId);
    const sourceZoneSnap = await sourceZoneRef.get();
    if (!sourceZoneSnap.exists) return res.status(404).json({ error: "Zona de origen no encontrada" });
    const sourceZone = sourceZoneSnap.data();

    const targetEventSnap = await db.collection("events").doc(targetEventId).get();
    if (!targetEventSnap.exists) return res.status(404).json({ error: "Evento destino no encontrado" });

    // Un sub-admin solo puede duplicar HACIA un evento que también tenga asignado (no puede
    // usar esto para meter zonas en un proyecto que no gestiona).
    if (req.user.role === "subadmin") {
      const targetAssigned = targetEventSnap.data().assignedSubadmins || [];
      if (!targetAssigned.includes(req.user.uid)) {
        return res.status(403).json({ error: "No tienes asignado el evento destino" });
      }
    }

    const n = sourceZone.coordinates.length;
    const centroidX = sourceZone.coordinates.reduce((s, p) => s + p.x, 0) / n;
    const centroidY = sourceZone.coordinates.reduce((s, p) => s + p.y, 0) / n;
    const dx = x - centroidX;
    const dy = y - centroidY;
    const clamp = (v) => Math.max(0, Math.min(100, Math.round(v * 10) / 10));
    const translatedCoords = sourceZone.coordinates.map((p) => ({ x: clamp(p.x + dx), y: clamp(p.y + dy) }));

    const newZoneRef = await db.collection("events").doc(targetEventId).collection("zones").add({
      name: (name?.trim() || `${sourceZone.name} (copia)`),
      color: sourceZone.color,
      coordinates: translatedCoords,
      createdBy: req.user.uid,
      createdAt: new Date().toISOString(),
      duplicatedFrom: { eventId, zoneId },
    });

    const pointsSnap = await sourceZoneRef.collection("points").get();
    const placementsSnap = await sourceZoneRef.collection("placements").get();

    const placementsByPoint = {};
    placementsSnap.docs.forEach((doc) => {
      const p = doc.data();
      if (!p.pointId) return;
      if (!placementsByPoint[p.pointId]) placementsByPoint[p.pointId] = [];
      placementsByPoint[p.pointId].push(p);
    });

    let copiedPoints = 0;
    let copiedDevices = 0;
    for (const pointDoc of pointsSnap.docs) {
      const point = pointDoc.data();
      const newPointRef = await newZoneRef.collection("points").add({
        name: point.name,
        x: clamp(point.x + dx),
        y: clamp(point.y + dy),
        status: "open",
        suggestedLoadKva: null,
        createdBy: req.user.uid,
        createdAt: new Date().toISOString(),
      });
      copiedPoints++;

      const devicesAtPoint = placementsByPoint[pointDoc.id] || [];
      for (const p of devicesAtPoint) {
        await newZoneRef.collection("placements").add({
          deviceId: p.deviceId,
          deviceName: p.deviceName,
          color: p.color,
          x: clamp(point.x + dx),
          y: clamp(point.y + dy),
          pointId: newPointRef.id,
          createdBy: req.user.uid,
          createdAt: new Date().toISOString(),
        });
        copiedDevices++;
      }
    }

    await logAudit({
      eventId: targetEventId, entityType: "zone", entityId: newZoneRef.id, action: "create",
      actorUid: req.user.uid, actorEmail: req.user.email, actorRole: req.user.role,
      summary: `Duplicó la zona "${sourceZone.name}" desde otro evento/ubicación (${copiedPoints} puntos, ${copiedDevices} electrodomésticos)`,
    });

    res.status(201).json({ id: newZoneRef.id, copiedPoints, copiedDevices });
  } catch (err) {
    next(err);
  }
}

/**
 * Elimina una zona por completo: la zona, sus puntos, sus electrodomésticos colocados
 * (placements), las asignaciones de usuarios (zoneAssignments) y el registro correspondiente
 * dentro de cada users/{uid}.zoneAssignments. También borra los cronogramas asociados,
 * para no dejar basura huérfana en Firestore.
 * Solo admin (ver zoneRoutes.js). Se bloquea si algún cronograma de la zona ya fue enviado,
 * salvo que se pida ?force=true explícitamente, para evitar borrados accidentales de trabajo
 * que el usuario ya entregó.
 */
export async function deleteZone(req, res, next) {
  try {
    const { eventId, zoneId } = req.params;
    const force = req.query.force === "true";

    const zoneRef = db.collection("events").doc(eventId).collection("zones").doc(zoneId);
    const zoneSnap = await zoneRef.get();
    if (!zoneSnap.exists) return res.status(404).json({ error: "Zona no encontrada" });
    const zoneData = zoneSnap.data();

    const [pointsSnap, placementsSnap, assignmentsSnap, schedulesSnap] = await Promise.all([
      zoneRef.collection("points").get(),
      zoneRef.collection("placements").get(),
      zoneRef.collection("zoneAssignments").get(),
      zoneRef.collection("schedules").get(),
    ]);

    const hasSentSchedule = schedulesSnap.docs.some((d) => d.data().status === "sent");
    if (hasSentSchedule && !force) {
      return res.status(409).json({
        error: "Esta zona tiene cronogramas ya enviados por al menos un usuario. Confirma que quieres eliminarla de todas formas.",
        requiresForce: true,
      });
    }

    const batch = db.batch();
    pointsSnap.docs.forEach((d) => batch.delete(d.ref));
    placementsSnap.docs.forEach((d) => batch.delete(d.ref));
    schedulesSnap.docs.forEach((d) => batch.delete(d.ref));
    assignmentsSnap.docs.forEach((d) => {
      batch.delete(d.ref);
      batch.update(db.collection("users").doc(d.id), {
        [`zoneAssignments.${zoneId}`]: FieldValue.delete(),
      });
    });
    batch.delete(zoneRef);

    await batch.commit();

    res.json({ message: "Zona eliminada correctamente" });

    logAudit({
      eventId, entityType: "zone", entityId: zoneId, action: "delete",
      actorUid: req.user.uid, actorEmail: req.user.email, actorRole: req.user.role,
      summary: `Eliminó la zona "${zoneData.name}"`,
    });
  } catch (err) {
    next(err);
  }
}

export async function listZones(req, res, next) {
  try {
    const { eventId } = req.params;
    const snapshot = await db.collection("events").doc(eventId).collection("zones").get();
    res.json(snapshot.docs.map((d) => ({ id: d.id, ...d.data() })));
  } catch (err) {
    next(err);
  }
}

/**
 * Asignar (o reasignar) una zona a UNO O VARIOS usuarios.
 * Se guarda en DOS lugares (denormalizado a propósito, patrón normal en Firestore):
 *  1) subcolección zoneAssignments -> para saber rápido "quién tiene esta zona"
 *  2) campo zoneAssignments en el propio users/{uid} -> para saber rápido "qué zonas tiene este usuario"
 * Admin: puede asignar cualquier zona. Sub-admin: solo reasignar zonas ya existentes
 * (la ruta ya filtra esto con roleMiddleware, aquí solo la lógica de datos).
 */
export async function assignZone(req, res, next) {
  try {
    const { eventId, zoneId } = req.params;
    const { userIds } = req.body; // array de uids

    if (!Array.isArray(userIds) || userIds.length === 0) {
      return res.status(400).json({ error: "userIds debe ser un arreglo con al menos un usuario" });
    }

    const zoneRef = db.collection("events").doc(eventId).collection("zones").doc(zoneId);
    const zoneSnap = await zoneRef.get();
    if (!zoneSnap.exists) return res.status(404).json({ error: "Zona no encontrada" });
    const zoneData = zoneSnap.data();

    const assignmentsRef = zoneRef.collection("zoneAssignments");
    const previous = await assignmentsRef.get();
    const previousUids = previous.docs.map((d) => d.id);

    const batch = db.batch();

    // Reemplazo completo de la subcolección de asignaciones de esta zona
    previous.docs.forEach((doc) => batch.delete(doc.ref));
    userIds.forEach((uid) => {
      batch.set(assignmentsRef.doc(uid), { uid, assignedAt: new Date().toISOString(), assignedBy: req.user.uid });
    });

    // Quitar esta zona del registro de los usuarios que ya no la tienen
    const removedUids = previousUids.filter((uid) => !userIds.includes(uid));
    removedUids.forEach((uid) => {
      batch.update(db.collection("users").doc(uid), {
        [`zoneAssignments.${zoneId}`]: FieldValue.delete(),
      });
    });

    // Agregar/actualizar el registro en los usuarios que sí la tienen ahora
    userIds.forEach((uid) => {
      batch.set(db.collection("users").doc(uid), {
        zoneAssignments: {
          [zoneId]: {
            eventId,
            zoneName: zoneData.name,
            color: zoneData.color,
            assignedAt: new Date().toISOString(),
            assignedBy: req.user.uid,
          },
        },
      }, { merge: true });
    });

    await batch.commit();

    res.json({ message: "Zona asignada correctamente", assignedTo: userIds });

    logAudit({
      eventId, entityType: "zone", entityId: zoneId, action: "update",
      actorUid: req.user.uid, actorEmail: req.user.email, actorRole: req.user.role,
      summary: `Asignó la zona "${zoneData.name}" a ${userIds.length} usuario(s)`,
    });
  } catch (err) {
    next(err);
  }
}

/** Devuelve quién está asignado a una zona (uid + email), para mostrarlo en la lista y precargar el panel de asignación. */
export async function listZoneAssignments(req, res, next) {
  try {
    const { eventId, zoneId } = req.params;
    const assignmentsSnap = await db
      .collection("events").doc(eventId)
      .collection("zones").doc(zoneId)
      .collection("zoneAssignments").get();

    const uids = assignmentsSnap.docs.map((d) => d.id);
    if (uids.length === 0) return res.json([]);

    const userDocs = await Promise.all(uids.map((uid) => db.collection("users").doc(uid).get()));
    const result = userDocs
      .filter((d) => d.exists)
      .map((d) => ({ uid: d.id, email: d.data().email, name: d.data().name || null }));

    res.json(result);
  } catch (err) {
    next(err);
  }
}

/** El usuario autenticado consulta SOLO sus zonas asignadas en un evento (collectionGroup query). */
export async function myZones(req, res, next) {
  try {
    const { eventId } = req.params;
    const { uid } = req.user;

    const zonesSnapshot = await db.collection("events").doc(eventId).collection("zones").get();

    const results = [];
    for (const zoneDoc of zonesSnapshot.docs) {
      const assignmentSnap = await zoneDoc.ref.collection("zoneAssignments").doc(uid).get();
      if (assignmentSnap.exists) {
        results.push({ id: zoneDoc.id, ...zoneDoc.data() });
      }
    }

    res.json(results);
  } catch (err) {
    next(err);
  }
}
