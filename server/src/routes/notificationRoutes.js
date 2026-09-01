import { Router } from "express";
import { authMiddleware } from "../middlewares/authMiddleware.js";
import { requireRole } from "../middlewares/roleMiddleware.js";
import { listNotifications, markAsRead } from "../controllers/notificationController.js";

const router = Router();

router.get("/", authMiddleware, requireRole(["admin", "subadmin", "productor"]), listNotifications);
router.patch("/:id/read", authMiddleware, requireRole(["admin", "subadmin", "productor"]), markAsRead);

export default router;
