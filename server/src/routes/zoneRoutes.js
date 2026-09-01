import { Router } from "express";
import { authMiddleware } from "../middlewares/authMiddleware.js";
import { requireRole } from "../middlewares/roleMiddleware.js";
import { requireZoneAccess } from "../middlewares/zoneAccess.js";
import { requireProjectAccess } from "../middlewares/projectAccess.js";
import { createZone, listZones, getZoneDetail, assignZone, listZoneAssignments, myZones, duplicateZone, deleteZone } from "../controllers/zoneController.js";
import { listPlacements, createPlacement, deletePlacement } from "../controllers/placementController.js";
import { createPoint, listPoints, setPointDeviceQuantity, closePoint, setPointSize, deletePoint } from "../controllers/pointController.js";
import {
  getMySchedule, upsertMySchedule, setMyAllocation, listZoneSchedules,
  updateDeliveries, reviewSchedule, setScheduleFrozen,
} from "../controllers/scheduleController.js";

const router = Router({ mergeParams: true });

// Dibujar/duplicar/eliminar zonas: admin y sub-admin (dentro de los eventos que tenga
// asignados). El sub-admin tiene las mismas herramientas de gestión de zonas que el admin.
router.post("/", authMiddleware, requireRole(["admin", "subadmin"]), requireProjectAccess(), createZone);
router.post("/:zoneId/duplicate", authMiddleware, requireRole(["admin", "subadmin"]), requireProjectAccess(), duplicateZone);
router.delete("/:zoneId", authMiddleware, requireRole(["admin", "subadmin"]), requireProjectAccess(), deleteZone);
router.get("/", authMiddleware, requireRole(["admin", "subadmin", "productor"]), requireProjectAccess(), listZones);
router.get("/mine", authMiddleware, myZones);
router.post("/:zoneId/assign", authMiddleware, requireRole(["admin", "subadmin", "productor"]), requireProjectAccess(), assignZone);
router.get("/:zoneId/assignments", authMiddleware, requireRole(["admin", "subadmin", "productor"]), listZoneAssignments);

router.get("/:zoneId", authMiddleware, requireZoneAccess(), getZoneDetail);

router.get("/:zoneId/placements", authMiddleware, requireZoneAccess(), listPlacements);
router.post("/:zoneId/placements", authMiddleware, requireZoneAccess(), createPlacement);
router.delete("/:zoneId/placements/:placementId", authMiddleware, requireZoneAccess(), deletePlacement);

router.get("/:zoneId/points", authMiddleware, requireZoneAccess(), listPoints);
router.post("/:zoneId/points", authMiddleware, requireZoneAccess(), createPoint);
router.put("/:zoneId/points/:pointId/devices", authMiddleware, requireZoneAccess(), setPointDeviceQuantity);
router.patch("/:zoneId/points/:pointId/size", authMiddleware, requireZoneAccess(), setPointSize);
router.patch("/:zoneId/points/:pointId/close", authMiddleware, requireZoneAccess(), closePoint);
router.delete("/:zoneId/points/:pointId", authMiddleware, requireZoneAccess(), deletePoint);

router.get("/:zoneId/schedules/mine", authMiddleware, requireZoneAccess(), getMySchedule);
router.put("/:zoneId/schedules/mine", authMiddleware, requireZoneAccess(), upsertMySchedule);
router.put("/:zoneId/schedules/mine/allocation", authMiddleware, requireZoneAccess(), setMyAllocation);
router.get("/:zoneId/schedules", authMiddleware, requireRole(["admin", "subadmin", "productor"]), requireProjectAccess(), listZoneSchedules);
// El productor no hace entregas — solo aprueba/pide cambios (ver reviewSchedule más abajo).
router.put("/:zoneId/schedules/:uid/deliveries", authMiddleware, requireRole(["admin", "subadmin"]), requireProjectAccess(), updateDeliveries);
router.patch("/:zoneId/schedules/:uid/review", authMiddleware, requireRole(["admin", "subadmin", "productor"]), requireProjectAccess(), reviewSchedule);
router.patch("/:zoneId/schedules/:uid/freeze", authMiddleware, requireRole(["admin", "subadmin", "productor"]), requireProjectAccess(), setScheduleFrozen);

export default router;
