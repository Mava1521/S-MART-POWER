import { auth } from "../config/firebaseAdmin.js";

/**
 * Verifica el ID token de Firebase enviado en el header Authorization: Bearer <token>.
 * Nunca confiamos en un uid/rol enviado desde el cliente en el body: siempre se saca
 * del token verificado por el Admin SDK.
 */
export async function authMiddleware(req, res, next) {
  try {
    const header = req.headers.authorization || "";
    const token = header.startsWith("Bearer ") ? header.slice(7) : null;

    if (!token) {
      return res.status(401).json({ error: "Token no proporcionado" });
    }

    const decoded = await auth.verifyIdToken(token);
    req.user = {
      uid: decoded.uid,
      email: decoded.email,
      role: decoded.role || null, // Custom claim asignado al crear/registrar el usuario
    };

    next();
  } catch (err) {
    return res.status(401).json({ error: "Token inválido o expirado" });
  }
}
