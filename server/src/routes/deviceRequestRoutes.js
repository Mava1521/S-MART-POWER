import { Router } from "express";
import { authMiddleware } from "../middlewares/authMiddleware.js";
import { requireRole } from "../middlewares/roleMiddleware.js";
import {
  createDeviceRequest, listMyDeviceRequests, resendDeviceRequest,
  listDeviceRequests, resolveDeviceRequest,
} from "../controllers/deviceRequestController.js";

const router = Router();

// Cualquier usuario final puede pedir que se agregue un producto (por link), ver el estado
// de sus propias solicitudes, y reenviar una corregida si se la rechazaron.
router.post("/", authMiddleware, requireRole(["user"]), createDeviceRequest);
router.get("/mine", authMiddleware, requireRole(["user"]), listMyDeviceRequests);
router.put("/:id/resend", authMiddleware, requireRole(["user"]), resendDeviceRequest);

// Solo admin/sub-admin gestionan las solicitudes.
router.get("/", authMiddleware, requireRole(["admin", "subadmin"]), listDeviceRequests);
router.patch("/:id/resolve", authMiddleware, requireRole(["admin", "subadmin"]), resolveDeviceRequest);

export default router;
