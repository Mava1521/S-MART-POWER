import { createInvitationCode } from "../services/invitationService.js";
import { db } from "../config/firebaseAdmin.js";

/**
 * Lista los códigos de invitación. Admin ve TODOS; sub-admin/productor ven solo los
 * que ellos mismos generaron.
 */
export async function listCodes(req, res, next) {
  try {
    let query = db.collection("invitationCodes").orderBy("createdAt", "desc");
    if (req.user.role !== "admin") {
      query = db.collection("invitationCodes")
        .where("createdBy", "==", req.user.uid)
        .orderBy("createdAt", "desc");
    }
    const snapshot = await query.get();
    res.json(snapshot.docs.map((d) => ({ id: d.id, ...d.data() })));
  } catch (err) {
    next(err);
  }
}

/** Genera un código. targetRole: "user" o "productor" (el productor solo puede generar "user"). */
export async function generateCode(req, res, next) {
  try {
    const { eventId, targetRole, expiresInHours } = req.body;
    const result = await createInvitationCode({
      createdBy: req.user.uid,
      createdByRole: req.user.role,
      eventId,
      targetRole,
      expiresInHours,
    });
    res.status(201).json(result);
  } catch (err) {
    next(err);
  }
}
