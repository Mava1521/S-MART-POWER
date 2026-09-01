import { Router } from "express";
import { authMiddleware } from "../middlewares/authMiddleware.js";
import { requireRole } from "../middlewares/roleMiddleware.js";
import {
  registerUser,
  createSubadmin,
  createProductor,
  listUsersByRole,
  updateUserProfile,
  deleteUserAccount,
  markPasswordChanged,
  updateMyContact,
  getProfile,
  setUserManager,
  setUserEvent,
} from "../controllers/authController.js";

const router = Router();

router.post("/register-user", authMiddleware, registerUser);

// Solo admin crea sub-administradores
router.post("/subadmins", authMiddleware, requireRole(["admin"]), createSubadmin);

// Admin y sub-admin crean productores (el productor solo puede invitar usuarios, nunca staff)
router.post("/productores", authMiddleware, requireRole(["admin", "subadmin"]), createProductor);

router.get("/users", authMiddleware, requireRole(["admin", "subadmin", "productor"]), listUsersByRole);
router.put("/users/:uid", authMiddleware, requireRole(["admin", "subadmin", "productor"]), updateUserProfile);
// Reasignar de qué sub-admin/productor depende un productor/usuario (armar el "Equipo del evento").
// Admin puede reasignar a cualquiera; un sub-admin solo dentro de su propio equipo (ver controller).
router.put("/users/:uid/manager", authMiddleware, requireRole(["admin", "subadmin"]), setUserManager);
// Asignar/quitar el evento de un usuario final desde el panel de Equipo del evento.
router.put("/users/:uid/event", authMiddleware, requireRole(["admin", "subadmin"]), setUserEvent);
router.delete("/users/:uid", authMiddleware, requireRole(["admin", "subadmin", "productor"]), deleteUserAccount);
router.put("/me/password-changed", authMiddleware, markPasswordChanged);
router.put("/me/contact", authMiddleware, updateMyContact);
router.get("/profile", authMiddleware, getProfile);

export default router;
