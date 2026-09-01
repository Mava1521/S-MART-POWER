import { Router } from "express";
import { authMiddleware } from "../middlewares/authMiddleware.js";
import { requireRole } from "../middlewares/roleMiddleware.js";
import { requireProjectAccess } from "../middlewares/projectAccess.js";
import { upload } from "../middlewares/upload.js";
import { createEvent, listEvents, getEvent, archiveEvent, unarchiveEvent, assignSubadmins, assignProductores, updateScheduleDates } from "../controllers/eventController.js";
import { listAuditLogs } from "../controllers/auditController.js";
import { getEventDeliverySummary } from "../controllers/scheduleController.js";

const router = Router();

router.post("/", authMiddleware, requireRole(["admin"]), upload.single("venueImage"), createEvent);
router.get("/", authMiddleware, requireRole(["admin", "subadmin", "productor"]), listEvents);
// Un evento puntual: también lo puede leer un "user" (necesita el nombre del evento de SU zona asignada).
// No expone nada sensible (solo nombre y plano) y el id no es adivinable/enumerable desde el listado.
router.get("/:id", authMiddleware, getEvent);
router.patch("/:id/archive", authMiddleware, requireRole(["admin"]), archiveEvent);
router.patch("/:id/unarchive", authMiddleware, requireRole(["admin"]), unarchiveEvent);
// Sub-admins de un evento: solo admin decide esto (es la estructura de mando, no el día a día).
router.put("/:id/subadmins", authMiddleware, requireRole(["admin"]), assignSubadmins);
// Productores de un evento: admin siempre; sub-admin también, pero solo en SUS eventos asignados.
router.put("/:id/productores", authMiddleware, requireRole(["admin", "subadmin"]), requireProjectAccess(), assignProductores);
router.put("/:id/schedule-dates", authMiddleware, requireRole(["admin"]), updateScheduleDates);
router.get("/:id/audit-logs", authMiddleware, requireRole(["admin", "subadmin"]), requireProjectAccess(), listAuditLogs);
router.get("/:id/delivery-summary", authMiddleware, requireRole(["admin"]), getEventDeliverySummary);

export default router;
