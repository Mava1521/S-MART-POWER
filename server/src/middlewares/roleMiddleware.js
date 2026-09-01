/**
 * Middleware de autorización por rol. Uso: requireRole(["admin"]) o requireRole(["admin","subadmin"])
 * Debe usarse siempre DESPUÉS de authMiddleware.
 */
export function requireRole(allowedRoles = []) {
  return (req, res, next) => {
    if (!req.user || !allowedRoles.includes(req.user.role)) {
      return res.status(403).json({ error: "No tienes permisos para esta acción" });
    }
    next();
  };
}
