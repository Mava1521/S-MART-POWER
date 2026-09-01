import express from "express";
import cors from "cors";
import { env } from "./config/env.js";
import { errorHandler } from "./middlewares/errorHandler.js";
import { authMiddleware } from "./middlewares/authMiddleware.js";
import { requireRole } from "./middlewares/roleMiddleware.js";
import { getSchedulesOverview, getGlobalAgenda } from "./controllers/scheduleController.js";

import authRoutes from "./routes/authRoutes.js";
import invitationRoutes from "./routes/invitationRoutes.js";
import deviceRoutes from "./routes/deviceRoutes.js";
import eventRoutes from "./routes/eventRoutes.js";
import zoneRoutes from "./routes/zoneRoutes.js";
import notificationRoutes from "./routes/notificationRoutes.js";
import deviceRequestRoutes from "./routes/deviceRequestRoutes.js";

const app = express();

app.use(cors({ origin: env.clientUrl }));
app.use(express.json());

app.get("/health", (req, res) => res.json({ ok: true }));

app.use("/api/auth", authRoutes);
app.use("/api/invitations", invitationRoutes);
app.use("/api/devices", deviceRoutes);
app.use("/api/events", eventRoutes);
// Rutas de zonas anidadas bajo un evento: /api/events/:eventId/zones
app.use("/api/events/:eventId/zones", zoneRoutes);
app.use("/api/notifications", notificationRoutes);
app.use("/api/device-requests", deviceRequestRoutes);
// Resumen liviano de todos los cronogramas (para la pantalla "Cronogramas" del panel de staff).
app.get("/api/schedules-overview", authMiddleware, requireRole(["admin", "subadmin", "productor"]), getSchedulesOverview);
// Agenda global de entregas (organizada por fecha, cruzando todos los eventos) — solo admin.
app.get("/api/schedules-agenda", authMiddleware, requireRole(["admin"]), getGlobalAgenda);

app.use(errorHandler);

export default app;
