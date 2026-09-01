import { db } from "../config/firebaseAdmin.js";
import cloudinary from "../config/cloudinary.js";
import { logAudit } from "../services/auditService.js";

const eventsCollection = db.collection("events");

/** Admin crea un evento y sube el plano del estadio (a Cloudinary, URL en Firestore). */
export async function createEvent(req, res, next) {
  try {
    const { name, scheduleStartDate, scheduleDurationDays, grayscale } = req.body;
    if (!name) return res.status(400).json({ error: "El nombre del evento es obligatorio" });
    if (!scheduleStartDate || !scheduleDurationDays) {
      return res.status(400).json({ error: "La fecha de inicio y la duración del cronograma son obligatorias" });
    }

    let venueImageUrl = null;
    if (req.file) {
      const uploadResult = await new Promise((resolve, reject) => {
        const stream = cloudinary.uploader.upload_stream(
          { folder: "eventos-venues" },
          (error, result) => (error ? reject(error) : resolve(result))
        );
        stream.end(req.file.buffer);
      });
      // "q_auto,f_auto" comprime automáticamente sin perder nitidez; "e_grayscale" es opcional
      // (reduce aún más el peso, sin quitar ningún detalle del plano, solo el color).
      const transform = grayscale === "true" || grayscale === true ? "e_grayscale,q_auto,f_auto" : "q_auto,f_auto";
      venueImageUrl = uploadResult.secure_url.replace("/upload/", `/upload/${transform}/`);
    }

    const ref = await eventsCollection.add({
      name,
      status: "active",
      venueImageUrl,
      assignedSubadmins: [],
      assignedProductores: [],
      scheduleStartDate,
      scheduleDurationDays: Number(scheduleDurationDays),
      createdBy: req.user.uid,
      createdAt: new Date().toISOString(),
    });

    await logAudit({
      eventId: ref.id, entityType: "event", entityId: ref.id, action: "create",
      actorUid: req.user.uid, actorEmail: req.user.email, actorRole: req.user.role,
      summary: `Creó el evento "${name}"`,
    });

    res.status(201).json({ id: ref.id });
  } catch (err) {
    next(err);
  }
}

/** Un solo evento por id (para la pantalla de zonas de ese evento). */
export async function getEvent(req, res, next) {
  try {
    const { id } = req.params;
    const docSnap = await eventsCollection.doc(id).get();
    if (!docSnap.exists) return res.status(404).json({ error: "Evento no encontrado" });
    res.json({ id: docSnap.id, ...docSnap.data() });
  } catch (err) {
    next(err);
  }
}

/**
 * Lista eventos. Admin ve todos. Sub-admin y productor solo ven los proyectos que el admin
 * les asignó explícitamente (ver EventManager.jsx). Un evento recién creado no es visible
 * para nadie más que el admin hasta que se asigne — así nunca "aparece solo" para nadie.
 */
export async function listEvents(req, res, next) {
  try {
    const { status } = req.query;
    let query = eventsCollection.orderBy("createdAt", "desc");
    if (status) query = query.where("status", "==", status);
    const snapshot = await query.get();
    let events = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));

    if (req.user.role === "subadmin") {
      events = events.filter((ev) => {
        const assigned = ev.assignedSubadmins || [];
        return assigned.includes(req.user.uid);
      });
    }

    if (req.user.role === "productor") {
      events = events.filter((ev) => {
        const assigned = ev.assignedProductores || [];
        return assigned.includes(req.user.uid);
      });
    }

    res.json(events);
  } catch (err) {
    next(err);
  }
}

/** Admin puede reprogramar las fechas del cronograma del evento (afecta a todos los usuarios del evento). */
export async function updateScheduleDates(req, res, next) {
  try {
    const { id } = req.params;
    const { scheduleStartDate, scheduleDurationDays } = req.body;
    if (!scheduleStartDate || !scheduleDurationDays) {
      return res.status(400).json({ error: "La fecha de inicio y la duración son obligatorias" });
    }
    await eventsCollection.doc(id).update({
      scheduleStartDate,
      scheduleDurationDays: Number(scheduleDurationDays),
    });
    await logAudit({
      eventId: id, entityType: "event", entityId: id, action: "update",
      actorUid: req.user.uid, actorEmail: req.user.email, actorRole: req.user.role,
      summary: `Cambió las fechas del cronograma (inicio ${scheduleStartDate}, ${scheduleDurationDays} días)`,
    });
    res.json({ scheduleStartDate, scheduleDurationDays: Number(scheduleDurationDays) });
  } catch (err) {
    next(err);
  }
}

/** Admin asigna (o quita) sub-administradores a este evento/proyecto. Sin asignar, nadie más que el admin lo ve. */
export async function assignSubadmins(req, res, next) {
  try {
    const { id } = req.params;
    const { subadminIds } = req.body;

    if (!Array.isArray(subadminIds)) {
      return res.status(400).json({ error: "subadminIds debe ser un arreglo" });
    }

    await eventsCollection.doc(id).update({ assignedSubadmins: subadminIds });

    await logAudit({
      eventId: id, entityType: "event", entityId: id, action: "update",
      actorUid: req.user.uid, actorEmail: req.user.email, actorRole: req.user.role,
      summary: `Actualizó los sub-administradores asignados a este proyecto (${subadminIds.length})`,
    });

    res.json({ assignedSubadmins: subadminIds });
  } catch (err) {
    next(err);
  }
}

/**
 * Admin asigna (o quita) productores a este evento/proyecto. Un evento sin productores
 * asignados (lista vacía) no es visible para NINGÚN productor hasta que se asigne al menos
 * uno explícitamente — evita que proyectos nuevos "se filtren" a cuentas que no deberían verlos.
 */
export async function assignProductores(req, res, next) {
  try {
    const { id } = req.params;
    const { productorIds } = req.body;

    if (!Array.isArray(productorIds)) {
      return res.status(400).json({ error: "productorIds debe ser un arreglo" });
    }

    await eventsCollection.doc(id).update({ assignedProductores: productorIds });

    await logAudit({
      eventId: id, entityType: "event", entityId: id, action: "update",
      actorUid: req.user.uid, actorEmail: req.user.email, actorRole: req.user.role,
      summary: `Actualizó los productores asignados a este proyecto (${productorIds.length})`,
    });

    res.json({ assignedProductores: productorIds });
  } catch (err) {
    next(err);
  }
}

/** Desarchivar: vuelve a status "active", queda editable/con zonas de nuevo en el panel de Eventos. */
export async function unarchiveEvent(req, res, next) {
  try {
    const { id } = req.params;
    await eventsCollection.doc(id).update({ status: "active", archivedAt: null });
    await logAudit({
      eventId: id, entityType: "event", entityId: id, action: "update",
      actorUid: req.user.uid, actorEmail: req.user.email, actorRole: req.user.role,
      summary: "Restauró el evento (desarchivado)",
    });
    res.json({ message: "Evento restaurado" });
  } catch (err) {
    next(err);
  }
}

/**
 * Archivar evento: SOLO admin. Queda como "carpeta" consultable a futuro (status: archived),
 * bloqueado para edición. No se borra, para poder reutilizar la distribución en otro evento.
 */
export async function archiveEvent(req, res, next) {
  try {
    const { id } = req.params;
    await eventsCollection.doc(id).update({ status: "archived", archivedAt: new Date().toISOString() });
    await logAudit({
      eventId: id, entityType: "event", entityId: id, action: "update",
      actorUid: req.user.uid, actorEmail: req.user.email, actorRole: req.user.role,
      summary: "Archivó el evento",
    });
    res.json({ message: "Evento archivado" });
  } catch (err) {
    next(err);
  }
}
