import { Navigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

/**
 * "/" no tiene una vista propia: redirige a cada quien a SU panel según su rol.
 * Antes esta ruta mostraba siempre "Mis zonas" (la vista de cliente), incluso para admin/subadmin.
 */
export default function Home() {
  const { profile, loading } = useAuth();

  if (loading) return <p style={{ padding: "var(--space-6)" }}>Cargando...</p>;

  if (profile?.role === "admin") return <Navigate to="/admin" replace />;
  if (profile?.role === "subadmin") return <Navigate to="/subadmin" replace />;
  if (profile?.role === "productor") return <Navigate to="/productor" replace />;
  return <Navigate to="/my-zones" replace />;
}
