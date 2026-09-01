import { auth, db } from "../config/firebaseAdmin.js";
import { redeemInvitationCode } from "../services/invitationService.js";
import { logAudit } from "../services/auditService.js";
/**
 * Registro de un USUARIO usando un código de invitación de un solo uso.
 * El cliente ya creó la cuenta en Firebase Auth (email/password) y nos manda el idToken;
 * aquí verificamos el código, marcamos el rol vía custom claim y guardamos el perfil.
 */
export async function registerUser(req, res, next) {
  try {
    const { code, representativeName, company } = req.body;
    const { uid } = req.user; // viene del token ya verificado (usuario recién creado en Auth)

    if (!code) {
      return res.status(400).json({ error: "El código de invitación es obligatorio" });
    }

    const codeData = await redeemInvitationCode(code, uid);
    const role = codeData.targetRole === "productor" ? "productor" : "user";

    if (role === "user" && (!representativeName || !company)) {
      return res.status(400).json({ error: "El nombre del representante y la empresa/proveedor son obligatorios" });
    }

    await auth.setCustomUserClaims(uid, { role });
    if (representativeName) await auth.updateUser(uid, { displayName: representativeName }).catch(() => {});

    const profile = {
      role,
      email: req.user.email,
      createdBy: codeData.createdBy,
      eventId: codeData.eventId || null,
      createdAt: new Date().toISOString(),
    };
    if (role === "user") {
      profile.representativeName = representativeName;
      profile.company = company;
    } else {
      profile.name = representativeName || null;
    }

    await db.collection("users").doc(uid).set(profile);

    res.status(201).json({ message: "Registrado correctamente", role });
  } catch (err) {
    next(err);
  }
}

/**
 * Crea una cuenta de "staff" (sub-admin o productor) de punta a punta: Auth + rol + perfil,
 * con contraseña temporal obligatoria (ver ForcePasswordChangeModal en el frontend).
 * Reutilizada por createSubadmin y createProductor para no duplicar la lógica.
 */
async function createStaffAccount({ role, email, password, name, createdBy }) {
  if (!email || !password) {
    const err = new Error("Faltan datos"); err.status = 400;
    err.publicMessage = "email y password son obligatorios"; throw err;
  }
  if (password.length < 6) {
    const err = new Error("Contraseña corta"); err.status = 400;
    err.publicMessage = "La contraseña debe tener al menos 6 caracteres"; throw err;
  }

  const userRecord = await auth.createUser({ email, password, displayName: name || undefined });
  await auth.setCustomUserClaims(userRecord.uid, { role });

  await db.collection("users").doc(userRecord.uid).set({
    role,
    email,
    name: name || null,
    mustChangePassword: true,
    createdBy,
    createdAt: new Date().toISOString(),
  });

  return { uid: userRecord.uid, email, name: name || null };
}

/** Solo admin. Sub-administrador con acceso amplio (ver roleMiddleware en la ruta). */
export async function createSubadmin(req, res, next) {
  try {
    const { email, password, name } = req.body;
    const result = await createStaffAccount({ role: "subadmin", email, password, name, createdBy: req.user.uid });
    res.status(201).json(result);
  } catch (err) {
    if (err.code === "auth/email-already-exists") { err.status = 409; err.publicMessage = "Ya existe una cuenta con ese correo"; }
    next(err);
  }
}

/**
 * Admin y sub-admin pueden crear PRODUCTORES: gestionan zonas/biblioteca y solo pueden
 * invitar usuarios (clientes) — nunca sub-admins ni otros productores.
 */
export async function createProductor(req, res, next) {
  try {
    const { email, password, name } = req.body;
    const result = await createStaffAccount({ role: "productor", email, password, name, createdBy: req.user.uid });
    res.status(201).json(result);
  } catch (err) {
    if (err.code === "auth/email-already-exists") { err.status = 409; err.publicMessage = "Ya existe una cuenta con ese correo"; }
    next(err);
  }
}

/** Lista usuarios por rol. Uso típico: ?role=subadmin o ?role=user (para asignar zonas). */
export async function listUsersByRole(req, res, next) {
  try {
    const { role } = req.query;
    let query = db.collection("users");
    if (role) query = query.where("role", "==", role);
    if (req.user.role === "productor") query = query.where("createdBy", "==", req.user.uid);
    const snapshot = await query.orderBy("createdAt", "desc").get();
    res.json(snapshot.docs.map((d) => ({ uid: d.id, ...d.data() })));
  } catch (err) {
    next(err);
  }
}

/**
 * Asigna (o quita) el evento de un usuario final desde el panel de "Equipo del evento", sin
 * depender de que vuelva a usar un código de invitación. Admin puede hacerlo con cualquier
 * evento; un sub-admin solo con eventos que tenga asignados.
 * Al cambiar de evento se limpian sus zonas asignadas (pertenecían al evento anterior y ya
 * no tienen sentido ahí) — el admin/sub-admin tendrá que asignarle zonas nuevas en el evento nuevo.
 */
export async function setUserEvent(req, res, next) {
  try {
    const { uid } = req.params;
    const { eventId } = req.body; // null/"" = quitarlo del evento

    const targetSnap = await db.collection("users").doc(uid).get();
    if (!targetSnap.exists) return res.status(404).json({ error: "Usuario no encontrado" });
    if (targetSnap.data().role !== "user") return res.status(400).json({ error: "Solo se puede asignar evento a usuarios finales" });

    if (eventId) {
      const eventSnap = await db.collection("events").doc(eventId).get();
      if (!eventSnap.exists) return res.status(404).json({ error: "Evento no encontrado" });
      if (req.user.role === "subadmin" && !(eventSnap.data().assignedSubadmins || []).includes(req.user.uid)) {
        return res.status(403).json({ error: "No tienes este evento asignado" });
      }
    }

    await db.collection("users").doc(uid).update({ eventId: eventId || null, zoneAssignments: {} });
    res.json({ message: "Evento actualizado" });

    logAudit({
      eventId: eventId || null, entityType: "user", entityId: uid, action: "update",
      actorUid: req.user.uid, actorEmail: req.user.email, actorRole: req.user.role,
      summary: eventId ? `Asignó el usuario ${uid} a este evento` : `Quitó al usuario ${uid} de su evento`,
    });
  } catch (err) {
    next(err);
  }
}

/**
 * Reasigna quién gestiona a un productor o a un usuario (su `createdBy`), sin tener que
 * recrear la cuenta ni pasar por un código de invitación de nuevo. Permite, por ejemplo, que
 * el admin le asigne productores y/o usuarios a un sub-admin directamente desde su ficha.
 * Solo admin. Valida que la jerarquía tenga sentido: un productor solo puede depender de un
 * sub-admin (o de nadie/admin); un usuario puede depender de un productor o de un sub-admin.
 */
export async function setUserManager(req, res, next) {
  try {
    const { uid } = req.params;
    const { managerUid } = req.body; // null/"" = sin gestor directo (queda a cargo del admin)

    const targetSnap = await db.collection("users").doc(uid).get();
    if (!targetSnap.exists) return res.status(404).json({ error: "Cuenta no encontrada" });
    const targetRole = targetSnap.data().role;

    let managerRole = null;
    if (managerUid) {
      const managerSnap = await db.collection("users").doc(managerUid).get();
      if (!managerSnap.exists) return res.status(404).json({ error: "El gestor elegido no existe" });
      managerRole = managerSnap.data().role;
    }

    if (targetRole === "productor" && managerUid && managerRole !== "subadmin") {
      return res.status(400).json({ error: "Un productor solo puede depender de un sub-administrador" });
    }
    if (targetRole === "user" && managerUid && !["productor", "subadmin"].includes(managerRole)) {
      return res.status(400).json({ error: "Un usuario solo puede depender de un productor o un sub-administrador" });
    }
    if (!["productor", "user"].includes(targetRole)) {
      return res.status(400).json({ error: "Solo se puede reasignar el gestor de productores o usuarios" });
    }

    // Un sub-admin puede armar SU equipo (productores que dependan de él, y usuarios que
    // dependan de él o de uno de SUS productores), pero nunca puede tocar sub-admins ni
    // asignar a alguien fuera de su propia cadena.
    if (req.user.role === "subadmin") {
      let allowedManagerUid = managerUid === req.user.uid;
      if (!allowedManagerUid && managerUid && targetRole === "user") {
        const managerSnap2 = await db.collection("users").doc(managerUid).get();
        allowedManagerUid = managerSnap2.exists && managerSnap2.data().role === "productor" && managerSnap2.data().createdBy === req.user.uid;
      }
      if (managerUid && !allowedManagerUid) {
        return res.status(403).json({ error: "Como sub-admin, solo puedes asignar dentro de tu propio equipo" });
      }
      if (!managerUid) {
        const current = targetSnap.data().createdBy;
        const wasMine = current === req.user.uid;
        let wasUnderMyProductor = false;
        if (!wasMine && current) {
          const currentManagerSnap = await db.collection("users").doc(current).get();
          wasUnderMyProductor = currentManagerSnap.exists && currentManagerSnap.data().createdBy === req.user.uid;
        }
        if (!wasMine && !wasUnderMyProductor) {
          return res.status(403).json({ error: "Solo puedes quitar de tu equipo a quien ya dependía de ti" });
        }
      }
    }

    await db.collection("users").doc(uid).update({ createdBy: managerUid || null });
    res.json({ message: "Gestor actualizado" });

    logAudit({
      eventId: null, entityType: "user", entityId: uid, action: "update",
      actorUid: req.user.uid, actorEmail: req.user.email, actorRole: req.user.role,
      summary: managerUid ? `Reasignó a ${uid} bajo ${managerUid}` : `Quitó el gestor directo de ${uid}`,
    });
  } catch (err) {
    next(err);
  }
}

/** Editar datos de un usuario/sub-admin (admin). El correo no se cambia aquí (lo maneja Firebase Auth aparte). */
export async function updateUserProfile(req, res, next) {
  try {
    const { uid } = req.params;
    const { name, representativeName, company, phone } = req.body;

    const docRef = db.collection("users").doc(uid);
    const docSnap = await docRef.get();
    if (!docSnap.exists) return res.status(404).json({ error: "Usuario no encontrado" });
    if (req.user.role === "productor" && docSnap.data().createdBy !== req.user.uid) {
      return res.status(403).json({ error: "Solo puedes gestionar a los usuarios que tú invitaste" });
    }

    const updates = { updatedAt: new Date().toISOString() };
    if (name !== undefined) updates.name = name || null;
    if (representativeName !== undefined) updates.representativeName = representativeName || null;
    if (company !== undefined) updates.company = company || null;
    if (phone !== undefined) updates.phone = phone || null;

    await docRef.update(updates);
    const displayName = representativeName || name;
    if (displayName) await auth.updateUser(uid, { displayName }).catch(() => {});

    res.json({ message: "Usuario actualizado" });
  } catch (err) {
    next(err);
  }
}

/** Eliminar cuenta (Auth + Firestore). No se puede eliminar a otro administrador desde aquí. */
export async function deleteUserAccount(req, res, next) {
  try {
    const { uid } = req.params;
    const docRef = db.collection("users").doc(uid);
    const docSnap = await docRef.get();
    if (!docSnap.exists) return res.status(404).json({ error: "Usuario no encontrado" });
    if (docSnap.data().role === "admin") {
      return res.status(403).json({ error: "No se puede eliminar a un administrador desde aquí" });
    }
    if (req.user.role === "productor" && docSnap.data().createdBy !== req.user.uid) {
      return res.status(403).json({ error: "Solo puedes gestionar a los usuarios que tú invitaste" });
    }

    await docRef.delete();
    await auth.deleteUser(uid).catch(() => {}); // si ya no existe en Auth, no bloqueamos el borrado del perfil

    res.json({ message: "Cuenta eliminada" });
  } catch (err) {
    next(err);
  }
}

/** Cada quien puede definir su propio teléfono de contacto (usado como contacto de escalamiento). */
export async function updateMyContact(req, res, next) {
  try {
    const { phone } = req.body;
    await db.collection("users").doc(req.user.uid).update({ phone: phone || null });
    res.json({ phone: phone || null });
  } catch (err) {
    next(err);
  }
}

/** El propio usuario confirma que ya cambió su contraseña temporal (limpia el flag que obliga el modal). */
export async function markPasswordChanged(req, res, next) {
  try {
    await db.collection("users").doc(req.user.uid).update({ mustChangePassword: false });
    res.json({ message: "Contraseña actualizada" });
  } catch (err) {
    next(err);
  }
}

/** Devuelve el perfil (rol incluido) del usuario autenticado. Útil para que el frontend sepa qué mostrar. */
export async function getProfile(req, res, next) {
  try {
    const docSnap = await db.collection("users").doc(req.user.uid).get();
    if (!docSnap.exists) {
      return res.status(404).json({ error: "Perfil no encontrado" });
    }
    res.json({ uid: req.user.uid, ...docSnap.data() });
  } catch (err) {
    next(err);
  }
}

