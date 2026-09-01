import { Navigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

/** Restringe una ruta a ciertos roles. Uso: <RoleRoute allowed={["admin"]}>...</RoleRoute> */
export default function RoleRoute({ allowed, children }) {
  const { profile, loading } = useAuth();

  if (loading) return <p>Cargando...</p>;
  if (!profile || !allowed.includes(profile.role)) {
    return <Navigate to="/" replace />;
  }

  return children;
}
