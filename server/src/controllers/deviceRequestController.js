import { db } from "../config/firebaseAdmin.js";

const requestsCollection = db.collection("deviceRequests");

/** Notifica a: el productor que invitó al usuario (si tiene), TODOS los sub-admins asignados
 *  al evento del usuario, y todos los admins. Misma fuente de verdad que la cadena de
 *  aprobación de cronogramas (assignedSubadmins del evento), para que el aviso llegue
 *  exactamente a quien de verdad gestiona ese evento. */
async function notifyAboutRequest(userData, requesterEmail, requestId, link, message) {
  let productorUid = null;
  if (userData.createdBy) {
    const creatorSnap = await db.collection("users").doc(userData.createdBy).get();
    if (creatorSnap.exists && creatorSnap.data().role === "productor") productorUid = userData.createdBy;
  }

  let subadminUids = [];
  if (userData.eventId) {
    const eventSnap = await db.collection("events").doc(userData.eventId).get();
    if (eventSnap.exists) subadminUids = eventSnap.data().assignedSubadmins || [];
  }

  const notifyTargets = [...new Set([...(productorUid ? [productorUid] : []), ...subadminUids])];

  await Promise.all([
    ...notifyTargets.map((uid) => db.collection("notifications").add({
      type: "device_request",
      targetRoles: [],
      targetUid: uid,
      relatedId: requestId,
      message,
      read: false,
      createdAt: new Date().toISOString(),
    })),
    db.collection("notifications").add({
      type: "device_request",
      targetRoles: ["admin"],
      relatedId: requestId,
      message,
      read: false,
      createdAt: new Date().toISOString(),
    }),
  ]);
}

/**
 * Un usuario final ya no puede agregar ítems directamente a la biblioteca. En su lugar, manda
 * un link (y una nota opcional) con el producto que quiere. Le llega a su productor, a los
 * sub-admins de su evento, y a cualquier admin.
 */
export async function createDeviceRequest(req, res, next) {
  try {
    const { link, note } = req.body;
    if (!link?.trim()) return res.status(400).json({ error: "Pega el link del producto que necesitas" });
    try { new URL(link.trim()); } catch { return res.status(400).json({ error: "Ese link no parece válido" }); }

    const userSnap = await db.collection("users").doc(req.user.uid).get();
    const userData = userSnap.exists ? userSnap.data() : {};

    const ref = await requestsCollection.add({
      link: link.trim(),
      note: note?.trim() || "",
      requestedBy: req.user.uid,
      requestedByEmail: req.user.email,
      eventId: userData.eventId || null,
      status: "pending",
      rejectionReason: null,
      resolutionComment: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    res.status(201).json({ id: ref.id, message: "Enviado. Te avisaremos cuando lo revisen." });

    await notifyAboutRequest(userData, req.user.email, ref.id, link.trim(),
      `${req.user.email} pidió agregar un producto a la biblioteca: ${link.trim()}`);
  } catch (err) {
    next(err);
  }
}

/**
 * El usuario ve su/sus solicitud(es) más reciente(s) — para saber si sigue pendiente, si la
 * rechazaron (y por qué), o si ya la agregaron.
 */
export async function listMyDeviceRequests(req, res, next) {
  try {
    const snapshot = await requestsCollection
      .where("requestedBy", "==", req.user.uid)
      .orderBy("createdAt", "desc")
      .limit(5)
      .get();
    res.json(snapshot.docs.map((d) => ({ id: d.id, ...d.data() })));
  } catch (err) {
    next(err);
  }
}

/**
 * El usuario reenvía un link nuevo sobre una solicitud que le rechazaron — actualiza la MISMA
 * solicitud (no crea una duplicada), vuelve a quedar "pending" y se les vuelve a avisar a
 * productor/sub-admins/admin.
 */
export async function resendDeviceRequest(req, res, next) {
  try {
    const { id } = req.params;
    const { link, note } = req.body;
    if (!link?.trim()) return res.status(400).json({ error: "Pega el link del producto que necesitas" });
    try { new URL(link.trim()); } catch { return res.status(400).json({ error: "Ese link no parece válido" }); }

    const ref = requestsCollection.doc(id);
    const snap = await ref.get();
    if (!snap.exists) return res.status(404).json({ error: "Solicitud no encontrada" });
    const data = snap.data();
    if (data.requestedBy !== req.user.uid) return res.status(403).json({ error: "Esta solicitud no es tuya" });
    if (data.status !== "rejected") return res.status(400).json({ error: "Solo puedes reenviar una solicitud que fue rechazada" });

    await ref.update({
      link: link.trim(),
      note: note?.trim() || "",
      status: "pending",
      rejectionReason: null,
      updatedAt: new Date().toISOString(),
    });

    res.json({ message: "Reenviado. Te avisaremos cuando lo revisen." });

    const userSnap = await db.collection("users").doc(req.user.uid).get();
    await notifyAboutRequest(userSnap.exists ? userSnap.data() : {}, req.user.email, id, link.trim(),
      `${req.user.email} reenvió un producto corregido: ${link.trim()}`);
  } catch (err) {
    next(err);
  }
}

/** Admin y sub-admin ven las solicitudes pendientes para decidir si las agregan a la biblioteca. */
export async function listDeviceRequests(req, res, next) {
  try {
    const { status } = req.query;
    let query = requestsCollection.orderBy("createdAt", "desc");
    if (status) query = query.where("status", "==", status);
    const snapshot = await query.get();
    res.json(snapshot.docs.map((d) => ({ id: d.id, ...d.data() })));
  } catch (err) {
    next(err);
  }
}

/**
 * Aprueba (ya se agregó a la biblioteca) o rechaza una solicitud. Si se rechaza, el motivo es
 * obligatorio y le llega al usuario (no solo como notificación pasajera: puede verlo y
 * reenviar un link nuevo corrigiendo lo que haga falta, ver resendDeviceRequest).
 */
export async function resolveDeviceRequest(req, res, next) {
  try {
    const { id } = req.params;
    const { status, comment } = req.body; // "added" | "rejected" | "dismissed"
    if (!["added", "rejected", "dismissed"].includes(status)) {
      return res.status(400).json({ error: "status debe ser 'added', 'rejected' o 'dismissed'" });
    }
    if (status === "rejected" && !comment?.trim()) {
      return res.status(400).json({ error: "Escribe el motivo del rechazo para que el usuario sepa qué corregir" });
    }

    const ref = requestsCollection.doc(id);
    const snap = await ref.get();
    if (!snap.exists) return res.status(404).json({ error: "Solicitud no encontrada" });
    const data = snap.data();

    await ref.update({
      status,
      rejectionReason: status === "rejected" ? comment.trim() : null,
      resolutionComment: status !== "rejected" ? (comment?.trim() || null) : null,
      resolvedBy: req.user.uid,
      resolvedAt: new Date().toISOString(),
    });
    res.json({ message: "Actualizado" });

    if (status === "rejected") {
      await db.collection("notifications").add({
        type: "device_request_rejected",
        targetRoles: [],
        targetUid: data.requestedBy,
        relatedId: id,
        message: `Tu solicitud de producto para la biblioteca fue rechazada: ${comment.trim()}`,
        read: false,
        createdAt: new Date().toISOString(),
      });
    } else if (status === "added") {
      await db.collection("notifications").add({
        type: "device_request_added",
        targetRoles: [],
        targetUid: data.requestedBy,
        relatedId: id,
        message: "El producto que pediste ya está disponible en la biblioteca.",
        read: false,
        createdAt: new Date().toISOString(),
      });
    }
  } catch (err) {
    next(err);
  }
}
