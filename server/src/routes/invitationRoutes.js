import { Router } from "express";
import { authMiddleware } from "../middlewares/authMiddleware.js";
import { requireRole } from "../middlewares/roleMiddleware.js";
import { generateCode, listCodes } from "../controllers/invitationController.js";

const router = Router();

router.post("/", authMiddleware, requireRole(["admin", "subadmin", "productor"]), generateCode);
router.get("/", authMiddleware, requireRole(["admin", "subadmin", "productor"]), listCodes);

export default router;
