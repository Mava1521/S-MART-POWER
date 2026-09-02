import { db } from "../config/firebaseAdmin.js";
import { logAudit } from "../services/auditService.js";

const LOCK_HOURS = 48;
const EDIT_CUTOFF_DAYS = 2;

const placementsRef = (eventId, zoneId) =>
  db.collection("events").doc(eventId).collection("zones").doc(zoneId).collection("placements");

const schedulesRef = (eventId, zoneId) =>
  db.collection("events").doc(eventId).collection("zones").doc(zoneId).collection("schedules");

/** Genera la lista fija de fechas del cronograma a partir de lo que definió el admin en el evento. */
function buildDatesFromEvent(event) {
  const dates = [];
  const start = new Date(event.scheduleStartDate + "T00:00:00");
  const days = event.scheduleDurationDays || 0;
  for (let i = 0; i < days; i++) {
    const d = new Date(start);
    d.setDate(d.getDate() + i);
    dates.push(d.toISOString().slice(0, 10));
  }
  return dates;
}

/** Cuenta cuántos puntos hay de cada electrodoméstico: esa es la cantidad "necesaria" (única fuente de verdad). */
async function computeTotalsByDevice(eventId, zoneId) {
  const snapshot = await placementsRef(eventId, zoneId).get();
  const totals = {};
  snapshot.docs.forEach((doc) => {
    const p = doc.data();
    if (!totals[p.deviceId]) totals[p.deviceId] = { deviceName: p.deviceName, color: p.color, total: 0 };
    totals[p.deviceId].total += 1;
  });
  return totals;
}

/** % de avance por electrodoméstico. SIEMPRE se calcula aquí, nunca se confía en un valor del cliente. */
function computeProgress(totals, days) {
  const scheduled = {};
  (days || []).forEach((day) => {
    Object.entries(day.allocations || {}).forEach(([deviceId, qty]) => {
      scheduled[deviceId] = (scheduled[deviceId] || 0) + Number(qty || 0);
    });
  });

  const progress = {};
  Object.entries(totals).forEach(([deviceId, info]) => {
    const scheduledQty = scheduled[deviceId] || 0;
    progress[deviceId] = {
      ...info,
      scheduled: scheduledQty,
      percent: info.total > 0 ? Math.min(100, Math.round((scheduledQty / info.total) * 100)) : 0,
    };
  });
  return progress;
}

/** Quita el % de la respuesta si quien pregunta es un "user" — el porcentaje es un dato solo para staff. */
function stripPercentIfUser(role, progress) {
  if (role !== "user") return progress;
  const clean = {};
  Object.entries(progress).forEach(([deviceId, info]) => {
    const { percent, ...rest } = info;
    clean[deviceId] = rest;
  });
  return clean;
}

function validateDays(totals, days) {
  const scheduled = {};
  for (const day of days || []) {
    for (const [deviceId, qty] of Object.entries(day.allocations || {})) {
      if (!totals[deviceId]) return `El electrodoméstico ${deviceId} no tiene puntos colocados en esta zona`;
      if (Number(qty) < 0) return "Las cantidades no pueden ser negativas";
      scheduled[deviceId] = (scheduled[deviceId] || 0) + Number(qty || 0);
    }
  }
  for (const [deviceId, qty] of Object.entries(scheduled)) {
    if (qty > totals[deviceId].total) {
      return `Programaste ${qty} de "${totals[deviceId].deviceName}" pero solo hay ${totals[deviceId].total} puntos colocados`;
    }
  }
  return null;
}

/** ¿Está bloqueado para edición? Por congelamiento manual, o porque ya pasaron 48h desde que se envió. */
function isLocked(scheduleData) {
  if (!scheduleData) return false;
  if (scheduleData.frozen) return true;
  if (scheduleData.status === "sent" && scheduleData.sentAt) {
    const hoursSinceSent = (Date.now() - new Date(scheduleData.sentAt).getTime()) / 3600000;
    return hoursSinceSent >= LOCK_HOURS;
  }
  return false;
}

/**
 * ¿Ya entramos en la ventana de "no más cambios de último momento"? Se bloquea la edición
 * desde EDIT_CUTOFF_DAYS (2 días) antes de que empiece la entrega (scheduleStartDate del
 * evento), sin importar si el usuario ya envió su cronograma o no — a diferencia de
 * isLocked(), que solo bloquea DESPUÉS de enviar. Esta regla existe para que nadie reciba
 * un cambio de cantidades a última hora, cuando ya no da tiempo de reaccionar.
 */
function isPastEditDeadline(event) {
  if (!event?.scheduleStartDate) return false;
  const cutoff = new Date(event.scheduleStartDate + "T00:00:00");
  cutoff.setDate(cutoff.getDate() - EDIT_CUTOFF_DAYS);
  return new Date() >= cutoff;
}

/**
 * Contacto de ayuda para el usuario que envió el cronograma: SIEMPRE su productor si tiene
 * uno en la cadena de este cronograma; si no, el/los sub-admin(es) asignados a este evento.
 * Los datos del admin NUNCA se comparten con el usuario, aunque técnicamente sea quien lo
 * invitó — por eso esto se basa en la cadena de aprobación real (reviewChain), no en quién
 * generó su código de invitación.
 */
async function getScheduleContact(chain) {
  if (!Array.isArray(chain)) return null;
  const productorStep = chain.find((s) => s.role === "productor" && (s.allowedUids || []).length > 0);
  const subadminStep = chain.find((s) => s.role === "subadmin" && (s.allowedUids || []).length > 0);
  const uid = productorStep?.allowedUids?.[0] || subadminStep?.allowedUids?.[0];
  if (!uid) return null;

  const contactSnap = await db.collection("users").doc(uid).get();
  if (!contactSnap.exists) return null;
  const c = contactSnap.data();
  return { name: c.name || c.representativeName || null, email: c.email, phone: c.phone || null, role: c.role };
}

/** Compatibilidad: cronogramas enviados antes del cambio a `allowedUids` (arreglo) todavía
 *  tienen el paso guardado como `{ uid }` (uno solo). Esto los sigue leyendo bien. */
function normalizeAllowedUids(step) {
  if (Array.isArray(step.allowedUids)) return step.allowedUids;
  return step.uid ? [step.uid] : [];
}

/**
 * Repara cadenas guardadas ANTES de que el paso de sub-admin se calculara desde la asignación
 * real del evento (ver buildReviewChain). Esas cadenas viejas podían quedar sin ningún paso de
 * sub-admin — por eso el sub-admin asignado al evento no veía el botón de aprobar, aunque el
 * evento sí fuera suyo. Si detecta esa situación, inserta el paso de sub-admin que falta justo
 * antes del paso de admin, SIN tocar los pasos que ya estaban aprobados (no se pierde
 * aprobación de nadie). Si la cadena ya tiene un paso de sub-admin, no hace nada.
 */
async function repairChainIfNeeded(chain, eventId) {
  if (chain.some((s) => s.role === "subadmin")) return chain;

  const eventSnap = await db.collection("events").doc(eventId).get();
  const assignedSubadmins = eventSnap.exists ? (eventSnap.data().assignedSubadmins || []) : [];
  if (assignedSubadmins.length === 0) return chain; // nadie asignado todavía: no hay a quién insertar

  const subadminStep = { role: "subadmin", allowedUids: assignedSubadmins, status: "pending", note: null, reviewedBy: null, reviewedAt: null };
  const adminIndex = chain.findIndex((s) => s.role === "admin");
  if (adminIndex === -1) return [...chain, subadminStep];

  const repaired = [...chain];
  repaired.splice(adminIndex, 0, subadminStep);
  return repaired;
}

/**
 * Arma la cadena de aprobación de un cronograma: usuario -> productor que lo invitó ->
 * sub-admin(es) asignado(s) a ESE EVENTO -> admin.
 * El paso de productor sí sigue el grafo de invitaciones (quién invitó a este usuario),
 * porque refleja de verdad quién es su contacto/productor. Pero el paso de sub-admin usa la
 * asignación real del evento (`assignedSubadmins`, ver EventManager.jsx) y NO quién invitó a
 * quién — antes se armaba siguiendo el grafo de invitaciones, y eso podía no coincidir con el
 * sub-admin que el admin asignó realmente al evento (por eso el botón de aprobar no le
 * aparecía a ese sub-admin: no estaba en la cadena, aunque el evento sí fuera suyo).
 * Si el evento no tiene ningún sub-admin asignado todavía, ese paso simplemente se salta (para
 * no dejar el cronograma trabado esperando a alguien que no existe); el admin igual puede
 * aprobarlo al final. Si hay varios sub-admins asignados al evento, cualquiera de ellos puede
 * completar ese paso (el primero que lo haga).
 * Se recalcula cada vez que el usuario envía/reenvía el cronograma.
 */
async function buildReviewChain(ownerUid, eventId) {
  const step = (role, allowedUids) => ({ role, allowedUids: allowedUids || [], status: "pending", note: null, reviewedBy: null, reviewedAt: null });
  const chain = [];

  const [ownerSnap, eventSnap] = await Promise.all([
    db.collection("users").doc(ownerUid).get(),
    db.collection("events").doc(eventId).get(),
  ]);
  const creatorUid = ownerSnap.exists ? ownerSnap.data().createdBy : null;

  if (creatorUid) {
    const creatorSnap = await db.collection("users").doc(creatorUid).get();
    if (creatorSnap.exists && creatorSnap.data().role === "productor") {
      chain.push(step("productor", [creatorUid]));
    }
    // Si quien invitó fue un sub-admin o un admin directamente, no hay paso de productor.
  }

  const assignedSubadmins = eventSnap.exists ? (eventSnap.data().assignedSubadmins || []) : [];
  if (assignedSubadmins.length > 0) {
    chain.push(step("subadmin", assignedSubadmins));
  }

  chain.push(step("admin", [])); // paso final, siempre presente, lo puede aprobar cualquier admin
  return chain;
}

/** El usuario consulta SU cronograma para esta zona (o una plantilla vacía si aún no ha creado uno). */
export async function getMySchedule(req, res, next) {
  try {
    const { eventId, zoneId } = req.params;
    const [eventSnap, totals, docSnap] = await Promise.all([
      db.collection("events").doc(eventId).get(),
      computeTotalsByDevice(eventId, zoneId),
      schedulesRef(eventId, zoneId).doc(req.user.uid).get(),
    ]);

    if (!eventSnap.exists) return res.status(404).json({ error: "Evento no encontrado" });
    const eventData = eventSnap.data();
    const fixedDates = buildDatesFromEvent(eventData);
    const savedData = docSnap.exists ? docSnap.data() : {};
    const savedByDate = Object.fromEntries((savedData.days || []).map((d) => [d.date, d.allocations || {}]));
    const days = fixedDates.map((date) => ({ date, allocations: savedByDate[date] || {} }));

    const deliveries = savedData.deliveries || [];
    const deadlinePassed = isPastEditDeadline(eventData);
    const locked = isLocked(savedData) || deadlinePassed;

    let contact = null;
    if (req.user.role === "user" && (locked || savedData.reviewStatus === "approved")) {
      contact = await getScheduleContact(savedData.reviewChain);
    }

    res.json({
      dates: fixedDates,
      days,
      status: savedData.status || "draft",
      reviewStatus: savedData.reviewStatus || null,
      reviewNote: savedData.reviewNote || null,
      reviewChain: savedData.reviewChain || null,
      frozen: !!savedData.frozen,
      sentAt: savedData.sentAt || null,
      approvedAt: savedData.approvedAt || null,
      locked,
      lockReason: locked ? (deadlinePassed ? "deadline" : "sent_48h") : null,
      editCutoffDays: EDIT_CUTOFF_DAYS,
      contact,
      totals,
      progress: stripPercentIfUser(req.user.role, computeProgress(totals, days)),
      deliveryProgress: stripPercentIfUser(req.user.role, computeProgress(totals, deliveries)),
    });
  } catch (err) {
    next(err);
  }
}

/** Crear/actualizar el cronograma propio. Si status pasa a "sent", notifica a admin/subadmin/productor. */
export async function upsertMySchedule(req, res, next) {
  try {
    const { eventId, zoneId } = req.params;
    const { days, status } = req.body;

    if (!Array.isArray(days) || days.length === 0) {
      return res.status(400).json({ error: "Debes tener al menos un día" });
    }

    const docRef = schedulesRef(eventId, zoneId).doc(req.user.uid);
    const [existingSnap, eventSnap] = await Promise.all([
      docRef.get(),
      db.collection("events").doc(eventId).get(),
    ]);
    const existingData = existingSnap.exists ? existingSnap.data() : null;

    if (isLocked(existingData)) {
      return res.status(423).json({ error: "Este cronograma ya está bloqueado y no se puede editar. Contacta a tu superior." });
    }
    if (isPastEditDeadline(eventSnap.data())) {
      return res.status(423).json({
        error: `Ya no se puede editar: faltan menos de ${EDIT_CUTOFF_DAYS} días para que empiece la entrega. Contacta a tu superior si necesitas un cambio.`,
      });
    }

    const totals = await computeTotalsByDevice(eventId, zoneId);
    if (Object.keys(totals).length === 0) {
      return res.status(400).json({ error: "Primero coloca puntos de electrodomésticos en la zona" });
    }

    const validationError = validateDays(totals, days);
    if (validationError) return res.status(400).json({ error: validationError });

    const finalStatus = status === "sent" ? "sent" : "draft";
    const wasAlreadySent = existingData?.status === "sent";
    const isFirstSend = finalStatus === "sent" && !wasAlreadySent;
    // Se recalcula la cadena de aprobación cada vez que se envía: así refleja quién es el
    // productor/sub-admin actual del usuario. Nota: cuando se piden cambios, el cronograma
    // vuelve a status "draft" (ver reviewSchedule), así que un reenvío también cae aquí.
    const reviewChain = isFirstSend ? await buildReviewChain(req.user.uid, eventId) : undefined;

    await docRef.set({
      days,
      status: finalStatus,
      ...(isFirstSend ? { reviewStatus: "pending", reviewNote: null, reviewChain, approvedAt: null } : {}),
      ...(isFirstSend ? { sentAt: new Date().toISOString() } : {}),
      updatedAt: new Date().toISOString(),
      updatedBy: req.user.uid,
    }, { merge: true });

    if (isFirstSend) {
      const [eventSnap, zoneSnap] = await Promise.all([
        db.collection("events").doc(eventId).get(),
        db.collection("events").doc(eventId).collection("zones").doc(zoneId).get(),
      ]);
      const message = `Cronograma enviado para la zona "${zoneSnap.data()?.name}" del evento "${eventSnap.data()?.name}"`;

      // Solo le llega a quien de verdad le toca revisarlo (productor/sub-admin de ESTE
      // evento, según la cadena recién armada) — no a todo el mundo con ese rol.
      const notifyUids = new Set();
      reviewChain.forEach((step) => {
        if (step.role !== "admin") (step.allowedUids || []).forEach((u) => notifyUids.add(u));
      });

      await Promise.all([
        ...[...notifyUids].map((uid) => db.collection("notifications").add({
          type: "schedule_sent", targetRoles: [], targetUid: uid, relatedId: zoneId, eventId, message, read: false, createdAt: new Date().toISOString(),
        })),
        db.collection("notifications").add({
          type: "schedule_sent", targetRoles: ["admin"], relatedId: zoneId, eventId, message, read: false, createdAt: new Date().toISOString(),
        }),
      ]);
      logAudit({
        eventId, entityType: "schedule", entityId: req.user.uid, action: "update",
        actorUid: req.user.uid, actorEmail: req.user.email, actorRole: req.user.role,
        summary: `Envió el cronograma de la zona "${zoneSnap.data()?.name}"`,
      });
    }

    res.json({
      days, status: finalStatus, totals,
      progress: stripPercentIfUser(req.user.role, computeProgress(totals, days)),
      sentAt: isFirstSend ? new Date().toISOString() : existingData?.sentAt || null,
      lockHours: LOCK_HOURS,
    });
  } catch (err) {
    next(err);
  }
}

/**
 * Guarda de una sola vez la cantidad de UN electrodoméstico en UN día — pensado para usarse
 * justo al lado de cada electrodoméstico en el momento de colocarlo (sin abrir el cronograma
 * completo). Internamente actualiza el mismo documento que usa el cronograma general.
 */
export async function setMyAllocation(req, res, next) {
  try {
    const { eventId, zoneId } = req.params;
    const { deviceId, date, quantity } = req.body;

    if (!deviceId || !date || quantity === undefined) {
      return res.status(400).json({ error: "deviceId, date y quantity son obligatorios" });
    }

    const docRef = schedulesRef(eventId, zoneId).doc(req.user.uid);
    const [existingSnap, eventSnap] = await Promise.all([
      docRef.get(),
      db.collection("events").doc(eventId).get(),
    ]);
    const existingData = existingSnap.exists ? existingSnap.data() : null;

    if (isLocked(existingData)) {
      return res.status(423).json({ error: "Este cronograma ya está bloqueado y no se puede editar. Contacta a tu superior." });
    }
    if (isPastEditDeadline(eventSnap.data())) {
      return res.status(423).json({
        error: `Ya no se puede editar: faltan menos de ${EDIT_CUTOFF_DAYS} días para que empiece la entrega. Contacta a tu superior si necesitas un cambio.`,
      });
    }

    const totals = await computeTotalsByDevice(eventId, zoneId);
    const days = existingData?.days || [];
    const dayIndex = days.findIndex((d) => d.date === date);
    const nextDays = [...days];
    if (dayIndex >= 0) {
      nextDays[dayIndex] = { ...nextDays[dayIndex], allocations: { ...nextDays[dayIndex].allocations, [deviceId]: Number(quantity) } };
    } else {
      nextDays.push({ date, allocations: { [deviceId]: Number(quantity) } });
    }

    const validationError = validateDays(totals, nextDays);
    if (validationError) return res.status(400).json({ error: validationError });

    await docRef.set({
      days: nextDays,
      status: existingData?.status || "draft",
      updatedAt: new Date().toISOString(),
      updatedBy: req.user.uid,
    }, { merge: true });

    res.json({ progress: stripPercentIfUser(req.user.role, computeProgress(totals, nextDays)) });
  } catch (err) {
    next(err);
  }
}

/**
 * Admin/sub-admin/productor aprueban el cronograma o piden cambios con un comentario
 * que el propio usuario verá para poder corregir.
 */
/**
 * Aprueba o pide cambios en un cronograma, respetando el protocolo de aprobación en cadena:
 * usuario -> productor -> sub-admin -> admin. Solo se puede aprobar el eslabón que está
 * "de turno" (el primero que aún no está aprobado); nadie puede saltarse a otro. Cuando
 * TODOS los eslabones aprueban, el cronograma queda oficialmente aprobado. Si cualquier
 * eslabón pide cambios, se reinicia toda la cadena y el cronograma vuelve a manos del usuario.
 */
export async function reviewSchedule(req, res, next) {
  try {
    const { eventId, zoneId, uid } = req.params;
    const { status, note } = req.body;

    if (!["approved", "changes_requested"].includes(status)) {
      return res.status(400).json({ error: "status debe ser 'approved' o 'changes_requested'" });
    }
    if (status === "changes_requested" && !note?.trim()) {
      return res.status(400).json({ error: "Escribe qué debe corregir el usuario" });
    }

    const docRef = schedulesRef(eventId, zoneId).doc(uid);
    const docSnap = await docRef.get();
    if (!docSnap.exists) return res.status(404).json({ error: "Este usuario no tiene un cronograma para esta zona" });
    const scheduleData = docSnap.data();

    // Compatibilidad: cronogramas enviados antes de que existiera la cadena de aprobación.
    let chain = scheduleData.reviewChain;
    if (!Array.isArray(chain) || chain.length === 0) {
      chain = await buildReviewChain(uid, eventId);
    } else {
      chain = await repairChainIfNeeded(chain, eventId);
    }

    const currentIndex = chain.findIndex((s) => s.status !== "approved");
    if (currentIndex === -1) {
      return res.status(400).json({ error: "Este cronograma ya está totalmente aprobado" });
    }
    const currentStep = chain[currentIndex];

    const isMyTurn = currentStep.role === "admin"
      ? req.user.role === "admin"
      : req.user.role === currentStep.role && normalizeAllowedUids(currentStep).includes(req.user.uid);

    if (!isMyTurn) {
      const ROLE_LABEL = { productor: "el productor asignado", subadmin: "el sub-administrador correspondiente", admin: "el administrador" };
      return res.status(409).json({
        error: `Este cronograma está esperando la aprobación de ${ROLE_LABEL[currentStep.role]}. No puedes aprobarlo todavía tú.`,
      });
    }

    let update;
    let summary;

    if (status === "approved") {
      chain = chain.map((s, i) => i === currentIndex
        ? { ...s, status: "approved", reviewedBy: req.user.uid, reviewedAt: new Date().toISOString(), note: null }
        : s);
      const allApproved = chain.every((s) => s.status === "approved");

      update = {
        reviewChain: chain,
        reviewStatus: allApproved ? "approved" : "pending",
        reviewNote: null,
        ...(allApproved ? { approvedAt: new Date().toISOString() } : {}),
      };
      summary = allApproved
        ? `Aprobó el cronograma de ${uid} (aprobación final — queda completamente aprobado)`
        : `Aprobó su eslabón (${currentStep.role}) del cronograma de ${uid}`;
    } else {
      // Pedir cambios reinicia TODA la cadena: el usuario debe corregir y todos vuelven a revisar.
      chain = chain.map((s) => ({ ...s, status: "pending", reviewedBy: null, reviewedAt: null, note: null }));
      update = {
        reviewChain: chain,
        reviewStatus: "changes_requested",
        reviewNote: note.trim(),
        status: "draft", // se desbloquea para que el usuario pueda corregir y reenviar
        approvedAt: null,
      };
      summary = `Pidió cambios (como ${currentStep.role}) al cronograma de ${uid}: "${note.trim()}"`;
    }

    await docRef.update(update);
    res.json({ message: "Revisión guardada", reviewChain: chain, reviewStatus: update.reviewStatus });

    // Solo le llega a quien de verdad tiene que ver esto: el resto de la cadena de ESTE
    // evento (productor/sub-admin asignados) + admin. Nunca se le manda al usuario dueño del
    // cronograma por esta vía — su rol no tiene acceso a la bandeja de avisos, así que solo
    // vería su estado directamente en su cronograma.
    const chainStaffUids = new Set();
    chain.forEach((s) => { if (s.role !== "admin") (s.allowedUids || []).forEach((u) => chainStaffUids.add(u)); });

    const notifyChainAndAdmin = (type, message) => Promise.all([
      ...[...chainStaffUids].map((u) => db.collection("notifications").add({
        type, targetRoles: [], targetUid: u, relatedId: zoneId, eventId, message, read: false, createdAt: new Date().toISOString(),
      })),
      db.collection("notifications").add({
        type, targetRoles: ["admin"], relatedId: zoneId, eventId, message, read: false, createdAt: new Date().toISOString(),
      }),
    ]);

    if (status === "approved") {
      const allApproved = chain.every((s) => s.status === "approved");
      if (allApproved) {
        await notifyChainAndAdmin("schedule_approved", `Un cronograma quedó aprobado por completo (usuario ${uid}).`);
      } else {
        const nextStep = chain[currentIndex + 1];
        const targets = nextStep.role === "admin" ? [] : (nextStep.allowedUids || []);
        await Promise.all([
          ...targets.map((u) => db.collection("notifications").add({
            type: "schedule_review_pending", targetRoles: [], targetUid: u, relatedId: zoneId, eventId,
            message: `Un cronograma quedó pendiente de tu aprobación (ya lo aprobó ${currentStep.role}).`,
            read: false, createdAt: new Date().toISOString(),
          })),
          ...(nextStep.role === "admin" ? [db.collection("notifications").add({
            type: "schedule_review_pending", targetRoles: ["admin"], relatedId: zoneId, eventId,
            message: `Un cronograma quedó pendiente de tu aprobación (ya lo aprobó ${currentStep.role}).`,
            read: false, createdAt: new Date().toISOString(),
          })] : []),
        ]);
      }
    } else {
      await notifyChainAndAdmin("schedule_changes_requested", `Se pidieron cambios en un cronograma (usuario ${uid}): "${note.trim()}"`);
    }

    logAudit({
      eventId, entityType: "schedule", entityId: uid, action: "update",
      actorUid: req.user.uid, actorEmail: req.user.email, actorRole: req.user.role,
      summary,
    });
  } catch (err) {
    next(err);
  }
}


/** Congela/descongela un cronograma: mientras esté congelado, el usuario no lo puede editar aunque no hayan pasado las 48h. */
export async function setScheduleFrozen(req, res, next) {
  try {
    const { eventId, zoneId, uid } = req.params;
    const { frozen } = req.body;

    const docRef = schedulesRef(eventId, zoneId).doc(uid);
    const docSnap = await docRef.get();
    if (!docSnap.exists) return res.status(404).json({ error: "Este usuario no tiene un cronograma para esta zona" });

    await docRef.update({ frozen: !!frozen });

    res.json({ frozen: !!frozen });

    logAudit({
      eventId, entityType: "schedule", entityId: uid, action: "update",
      actorUid: req.user.uid, actorEmail: req.user.email, actorRole: req.user.role,
      summary: frozen ? `Congeló el cronograma de ${uid}` : `Descongeló el cronograma de ${uid}`,
    });
  } catch (err) {
    next(err);
  }
}

/** Admin/sub-admin/productor: ver los cronogramas de TODOS los usuarios en esta zona. */
export async function listZoneSchedules(req, res, next) {
  try {
    const { eventId, zoneId } = req.params;
    const totals = await computeTotalsByDevice(eventId, zoneId);
    const snapshot = await schedulesRef(eventId, zoneId).get();

    const results = await Promise.all(
      snapshot.docs.map(async (doc) => {
        const userSnap = await db.collection("users").doc(doc.id).get();
        const data = doc.data();

        // ¿A quién le toca aprobar ahora, y le toca a quien está pidiendo esta lista?
        let chain = Array.isArray(data.reviewChain) ? data.reviewChain : null;
        if (chain) {
          const repaired = await repairChainIfNeeded(chain, eventId);
          if (repaired !== chain) {
            chain = repaired;
            doc.ref.update({ reviewChain: chain }).catch(() => {}); // autocorrección silenciosa, no bloquea la respuesta
          }
        }
        const currentIndex = chain ? chain.findIndex((s) => s.status !== "approved") : -1;
        const currentStep = currentIndex >= 0 ? chain[currentIndex] : null;
        const canReview = !!(
          data.status === "sent" && currentStep &&
          (currentStep.role === "admin"
            ? req.user.role === "admin"
            : req.user.role === currentStep.role && normalizeAllowedUids(currentStep).includes(req.user.uid))
        );

        return {
          uid: doc.id,
          userEmail: userSnap.exists ? userSnap.data().email : null,
          userName: userSnap.exists ? (userSnap.data().representativeName || userSnap.data().name) : null,
          ...data,
          reviewChain: chain || data.reviewChain,
          locked: isLocked(data),
          progress: computeProgress(totals, data.days),
          deliveryProgress: computeProgress(totals, data.deliveries || []),
          canReview,
          currentApproverRole: currentStep?.role || null,
        };
      })
    );

    res.json({ totals, schedules: results });
  } catch (err) {
    next(err);
  }
}

/**
 * Resume, en UNA sola llamada, todas las zonas (de todos los eventos visibles para quien
 * pregunta) que tienen al menos un cronograma enviado. Antes, la pantalla de "Cronogramas"
 * hacía esto con un loop secuencial en el navegador (un request por evento, y luego uno por
 * cada zona de cada evento, uno detrás de otro) — con varios eventos y zonas eso son decenas
 * de viajes de ida y vuelta seguidos, y por eso tardaba tanto en cargar.
 * Aquí se pide todo de una vez y Firestore resuelve las lecturas en paralelo del lado del
 * servidor, que es mucho más rápido que encadenar peticiones HTTP desde el navegador.
 * Se usa un conteo liviano (solo se leen los cronogramas, sin traer usuarios ni placements)
 * porque en esta vista solo hacen falta los totales, no el detalle completo de cada uno.
 */
export async function getSchedulesOverview(req, res, next) {
  try {
    let eventsSnap = await db.collection("events").where("status", "==", "active").get();
    let events = eventsSnap.docs.map((d) => ({ id: d.id, ...d.data() }));

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

    // Todos los eventos en paralelo; dentro de cada uno, todas sus zonas en paralelo;
    // dentro de cada zona, su conteo de cronogramas. Nada se espera uno detrás de otro.
    const perEvent = await Promise.all(events.map(async (ev) => {
      const zonesSnap = await db.collection("events").doc(ev.id).collection("zones").get();
      const zoneRows = await Promise.all(zonesSnap.docs.map(async (zoneDoc) => {
        const zone = zoneDoc.data();
        const schedulesSnap = await zoneDoc.ref.collection("schedules").get();
        if (schedulesSnap.empty) return null;

        let pending = 0, approved = 0;
        schedulesSnap.docs.forEach((s) => {
          const rs = s.data().reviewStatus;
          if (rs === "approved") approved++;
          else pending++;
        });

        return {
          eventId: ev.id, eventName: ev.name,
          zoneId: zoneDoc.id, zoneName: zone.name, zoneColor: zone.color,
          count: schedulesSnap.size, pending, approved,
        };
      }));
      return zoneRows.filter(Boolean);
    }));

    res.json(perEvent.flat());
  } catch (err) {
    next(err);
  }
}

/**
 * Agenda global de entregas para el admin: TODOS los cronogramas enviados, de TODOS los
 * eventos, organizados por fecha — como un organizador. No importa de qué evento o zona sea,
 * lo que se entrega más pronto aparece primero, para que no se le olvide nada al admin.
 * También calcula el % de avance de cada evento por separado, para tener el panorama completo.
 * Todo se resuelve en paralelo (como getSchedulesOverview) para que cargue rápido aunque
 * haya varios eventos con varias zonas cada uno.
 */
export async function getGlobalAgenda(req, res, next) {
  try {
    const eventsSnap = await db.collection("events").where("status", "==", "active").get();

    const perEvent = await Promise.all(eventsSnap.docs.map(async (eventDoc) => {
      const eventId = eventDoc.id;
      const eventName = eventDoc.data().name;
      const zonesSnap = await db.collection("events").doc(eventId).collection("zones").get();

      let eventTotalUnits = 0;
      let eventDeliveredUnits = 0;
      const items = []; // entregas por día, planas, para agrupar después

      await Promise.all(zonesSnap.docs.map(async (zoneDoc) => {
        const zoneId = zoneDoc.id;
        const [totals, schedulesSnap] = await Promise.all([
          computeTotalsByDevice(eventId, zoneId),
          schedulesRef(eventId, zoneId).where("status", "==", "sent").get(),
        ]);

        schedulesSnap.docs.forEach((scheduleDoc) => {
          const data = scheduleDoc.data();
          const deliveredByDate = {};
          (data.deliveries || []).forEach((d) => { deliveredByDate[d.date] = d.allocations || {}; });

          (data.days || []).forEach((day) => {
            const scheduledEntries = Object.entries(day.allocations || {}).filter(([, qty]) => Number(qty) > 0);
            if (scheduledEntries.length === 0) return;

            const devices = scheduledEntries.map(([deviceId, qty]) => {
              const scheduled = Number(qty) || 0;
              const delivered = Number(deliveredByDate[day.date]?.[deviceId] || 0);
              eventTotalUnits += scheduled;
              eventDeliveredUnits += Math.min(delivered, scheduled);
              return { deviceId, deviceName: totals[deviceId]?.deviceName || deviceId, scheduled, delivered };
            });

            items.push({
              date: day.date,
              eventId, eventName,
              zoneId, zoneName: zoneDoc.data().name, zoneColor: zoneDoc.data().color,
              ownerUid: scheduleDoc.id,
              reviewStatus: data.reviewStatus || "pending",
              devices,
              fullyDelivered: devices.every((d) => d.delivered >= d.scheduled),
            });
          });
        });
      }));

      return {
        summary: {
          eventId, eventName,
          percent: eventTotalUnits > 0 ? Math.min(100, Math.round((eventDeliveredUnits / eventTotalUnits) * 100)) : 0,
        },
        items,
      };
    }));

    const events = perEvent.map((e) => e.summary);
    const allItems = perEvent.flatMap((e) => e.items);

    // Le añadimos los nombres de quién entrega (para que se lea claro en la agenda).
    const uniqueUids = [...new Set(allItems.map((i) => i.ownerUid))];
    const userDocs = await Promise.all(uniqueUids.map((uid) => db.collection("users").doc(uid).get()));
    const nameByUid = {};
    userDocs.forEach((snap) => { if (snap.exists) nameByUid[snap.id] = snap.data().representativeName || snap.data().name || snap.data().email; });
    allItems.forEach((i) => { i.ownerName = nameByUid[i.ownerUid] || i.ownerUid; });

    // Agrupa por fecha y ordena cronológicamente: lo que se entrega primero, sin importar
    // de qué evento sea, aparece primero — así es un verdadero organizador.
    const byDate = {};
    allItems.forEach((item) => {
      if (!byDate[item.date]) byDate[item.date] = [];
      byDate[item.date].push(item);
    });
    const todayISO = new Date().toISOString().slice(0, 10);
    const days = Object.keys(byDate).sort().map((date) => ({
      date,
      isPast: date < todayISO,
      isToday: date === todayISO,
      items: byDate[date],
    }));

    res.json({ events, days });
  } catch (err) {
    next(err);
  }
}

export async function updateDeliveries(req, res, next) {
  try {
    const { eventId, zoneId, uid } = req.params;
    const { deliveries } = req.body;

    if (!Array.isArray(deliveries)) {
      return res.status(400).json({ error: "deliveries debe ser un arreglo" });
    }

    const totals = await computeTotalsByDevice(eventId, zoneId);
    const validationError = validateDays(totals, deliveries);
    if (validationError) return res.status(400).json({ error: validationError });

    const docRef = schedulesRef(eventId, zoneId).doc(uid);
    const docSnap = await docRef.get();
    if (!docSnap.exists) return res.status(404).json({ error: "Este usuario todavía no tiene un cronograma para esta zona" });

    await docRef.update({
      deliveries,
      deliveriesUpdatedAt: new Date().toISOString(),
      deliveriesUpdatedBy: req.user.uid,
    });

    res.json({ deliveries, deliveryProgress: computeProgress(totals, deliveries) });

    logAudit({
      eventId, entityType: "schedule", entityId: uid, action: "update",
      actorUid: req.user.uid, actorEmail: req.user.email, actorRole: req.user.role,
      summary: `Marcó entregas para el cronograma de ${uid}`,
    });
  } catch (err) {
    next(err);
  }
}

/**
 * SOLO admin: % de avance de entregas por zona y del evento completo, ordenado por la zona
 * cuya próxima entrega pendiente está más cerca en el tiempo.
 */
export async function getEventDeliverySummary(req, res, next) {
  try {
    const { id: eventId } = req.params;
    const zonesSnap = await db.collection("events").doc(eventId).collection("zones").get();

    const zoneSummaries = [];
    for (const zoneDoc of zonesSnap.docs) {
      const zoneId = zoneDoc.id;
      const totals = await computeTotalsByDevice(eventId, zoneId);
      const totalUnits = Object.values(totals).reduce((s, t) => s + t.total, 0);
      if (totalUnits === 0) continue;

      const schedulesSnap = await schedulesRef(eventId, zoneId).get();
      let deliveredUnits = 0;
      let nearestPendingDate = null;

      schedulesSnap.docs.forEach((doc) => {
        const data = doc.data();
        (data.deliveries || []).forEach((day) => {
          Object.values(day.allocations || {}).forEach((qty) => { deliveredUnits += Number(qty) || 0; });
        });
        (data.days || []).forEach((day) => {
          const scheduledThatDay = Object.values(day.allocations || {}).reduce((s, q) => s + (Number(q) || 0), 0);
          if (scheduledThatDay > 0 && (!nearestPendingDate || day.date < nearestPendingDate)) {
            nearestPendingDate = day.date;
          }
        });
      });

      zoneSummaries.push({
        zoneId,
        zoneName: zoneDoc.data().name,
        zoneColor: zoneDoc.data().color,
        totalUnits,
        deliveredUnits,
        percent: Math.min(100, Math.round((deliveredUnits / totalUnits) * 100)),
        nearestPendingDate,
      });
    }

    zoneSummaries.sort((a, b) => {
      if (!a.nearestPendingDate) return 1;
      if (!b.nearestPendingDate) return -1;
      return a.nearestPendingDate.localeCompare(b.nearestPendingDate);
    });

    const totalUnitsAll = zoneSummaries.reduce((s, z) => s + z.totalUnits, 0);
    const deliveredUnitsAll = zoneSummaries.reduce((s, z) => s + z.deliveredUnits, 0);
    const eventPercent = totalUnitsAll > 0 ? Math.min(100, Math.round((deliveredUnitsAll / totalUnitsAll) * 100)) : 0;

    res.json({ eventPercent, zones: zoneSummaries });
  } catch (err) {
    next(err);
  }
}
