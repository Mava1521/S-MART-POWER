import { useState } from "react";
import { updatePassword } from "firebase/auth";
import { auth } from "../../services/firebase";
import api from "../../services/api";
import { useAuth } from "../../context/AuthContext";

/**
 * Bloquea toda la interfaz hasta que un sub-admin con contraseña temporal la cambie.
 * Firebase permite updatePassword sin pedir "recent login" porque el inicio de sesión
 * que lo trajo hasta aquí acaba de ocurrir (token todavía "fresco").
 */
export default function ForcePasswordChangeModal() {
  const { refreshProfile } = useAuth();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    if (password.length < 6) { setError("La contraseña debe tener al menos 6 caracteres"); return; }
    if (password !== confirm) { setError("Las contraseñas no coinciden"); return; }

    setLoading(true);
    try {
      await updatePassword(auth.currentUser, password);
      await api.put("/auth/me/password-changed");
      await refreshProfile();
    } catch (err) {
      if (err.code === "auth/requires-recent-login") {
        setError("Por seguridad, cierra sesión y vuelve a entrar antes de cambiar la contraseña.");
      } else {
        setError("No se pudo actualizar la contraseña. Intenta de nuevo.");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 100, background: "rgba(0,0,0,0.6)",
      display: "flex", alignItems: "center", justifyContent: "center", padding: "var(--space-4)",
    }}>
      <div className="auth-card" style={{ maxWidth: 380 }}>
        <h1>Cambia tu contraseña</h1>
        <p className="auth-subtitle">Por seguridad, debes definir una contraseña propia antes de continuar.</p>

        {error && <div className="error-message">{error}</div>}

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="label" htmlFor="new-password">Nueva contraseña</label>
            <input
              id="new-password"
              className="input"
              type="password"
              autoComplete="new-password"
              minLength={6}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>
          <div className="form-group">
            <label className="label" htmlFor="confirm-password">Confirmar contraseña</label>
            <input
              id="confirm-password"
              className="input"
              type="password"
              autoComplete="new-password"
              minLength={6}
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              required
            />
          </div>
          <button type="submit" className="btn btn-primary btn-block" disabled={loading}>
            {loading ? "Guardando..." : "Guardar y continuar"}
          </button>
        </form>
      </div>
    </div>
  );
}
