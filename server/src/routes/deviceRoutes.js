import { Router } from "express";
import { authMiddleware } from "../middlewares/authMiddleware.js";
import { requireRole } from "../middlewares/roleMiddleware.js";
import { upload } from "../middlewares/upload.js";
import {
  listDevices,
  createDevice,
  updateDevice,
  deleteDevice,
} from "../controllers/deviceController.js";
import { listCategories, createCategory, updateCategory, deleteCategory } from "../controllers/deviceCategoryController.js";

const router = Router();

// Los 4 roles pueden ver/buscar
router.get("/", authMiddleware, listDevices);

// Solo admin, sub-admin y productor crean ítems reales. El usuario final ya no puede agregar
// directamente — puede enviar un link con lo que necesita (ver deviceRequestRoutes.js).
router.post("/", authMiddleware, requireRole(["admin", "subadmin", "productor"]), upload.single("photo"), createDevice);

// admin, sub-admin y productor editan
router.put("/:id", authMiddleware, requireRole(["admin", "subadmin", "productor"]), upload.single("photo"), updateDevice);

// Solo admin elimina
router.delete("/:id", authMiddleware, requireRole(["admin"]), deleteDevice);

// Categorías: todos pueden ver la lista (para elegir una); solo admin/sub-admin crean nuevas.
router.get("/categories", authMiddleware, listCategories);
router.post("/categories", authMiddleware, requireRole(["admin", "subadmin"]), createCategory);
router.patch("/categories/:id", authMiddleware, requireRole(["admin", "subadmin"]), updateCategory);
router.delete("/categories/:id", authMiddleware, requireRole(["admin"]), deleteCategory);

export default router;
