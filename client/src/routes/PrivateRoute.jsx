import { Navigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export default function PrivateRoute({ children }) {
  const { firebaseUser, loading } = useAuth();

  if (loading) return <p>Cargando...</p>;
  if (!firebaseUser) return <Navigate to="/login" replace />;

  return children;
}
