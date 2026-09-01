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

// Opciones de CORS mejoradas para Vercel + Localhost
const allowedOrigins = [
  env.clientUrl,
  "https://s-mart-power.vercel.app",
  "http://localhost:5173",
  "http://localhost:3000"
].filter(Boolean);

app.use(
  cors({
    origin: (origin, callback) => {
      // Permitir peticiones sin origen (como Postman o Server-to-Server)
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error("No permitido por CORS"));
      }
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"]
  })
);

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