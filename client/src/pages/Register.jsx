import { useState } from "react";
import { createUserWithEmailAndPassword } from "firebase/auth";
import { Link, useNavigate } from "react-router-dom";
import { auth } from "../services/firebase";
import api from "../services/api";
import { useAuth } from "../context/AuthContext";

import bannerBg from "../assets/Imagenes/Imagen_S-MART_POWER.png";

export default function Register() {
  const [representativeName, setRepresentativeName] = useState("");
  const [company, setCompany] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  // El modal se muestra de entrada
  const [showInfoModal, setShowInfoModal] = useState(true);

  const navigate = useNavigate();
  const { refreshProfile } = useAuth();

  // Función para cerrar el modal al presionar "Entiendo"
  const handleUnderstand = () => {
    setShowInfoModal(false);
  };

  // Función de envío del formulario al backend
  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    if (!email || !password || !code) {
      setError("Por favor completa los campos requeridos.");
      return;
    }

    setLoading(true);
    try {
      await createUserWithEmailAndPassword(auth, email, password);
      await api.post("/auth/register-user", { code, representativeName, company });
      await refreshProfile();
      navigate("/");
    } catch (err) {
      setError(err.response?.data?.error || "No se pudo completar el registro");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-page">
      <div
        className="auth-background"
        style={{ backgroundImage: `url(${bannerBg})` }}
        aria-hidden="true"
      />

      {/* Modal Emergente - Réplica Exacta Mockup Foto 1 */}
      {showInfoModal && (
        <div className="auth-modal-overlay">
          <div className="auth-modal-card">
            <div className="auth-modal-icon">
              <svg 
                xmlns="http://www.w3.org/2000/svg" 
                width="64" 
                height="64" 
                viewBox="0 0 24 24" 
                fill="none" 
                strokeWidth="2" 
                strokeLinecap="round" 
                strokeLinejoin="round" 
                className="lucide lucide-info-icon lucide-info"
              >
                {/* Círculo en naranja/rojo */}
                <circle cx="12" cy="12" r="10" stroke="#E5533D" />
                
                {/* La "i" interna en color negro/oscuro */}
                <path d="M12 16v-4" stroke="#111827" strokeWidth="2.5" />
                <path d="M12 8h.01" stroke="#111827" strokeWidth="3" />
              </svg>
            </div>

            <p className="auth-modal-text-main">
              Necesitas el código de invitación que te compartió tu administrador.
            </p>

            <p className="auth-modal-text-sub">
              El nombre y la empresa solo son obligatorios si tu código es de cliente; si te invitaron como proveedor, puedes dejarlos en blanco.
            </p>

            <button
              type="button"
              className="btn btn-primary auth-modal-btn"
              onClick={handleUnderstand}
            >
              Entiendo
            </button>
          </div>
        </div>
      )}

      {/* Tarjeta del Formulario */}
      <div className="auth-card">
        <div className="auth-header-row">
          <div className="auth-avatar-icon">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#FF4B0B" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" />
              <circle cx="12" cy="7" r="4" />
            </svg>
          </div>
          <h1 className="auth-title-inline">Crear Cuenta</h1>
        </div>

        {error && (
          <div className="error-message" role="alert">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="auth-form" noValidate>
          <div className="form-group">
            <label htmlFor="rep-name" className="label">
              Nombre (del representante, si aplica)
            </label>
            <div className="input-wrapper">
              <span className="input-icon" aria-hidden="true">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#FF4B0B" strokeWidth="2">
                  <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" />
                  <circle cx="12" cy="7" r="4" />
                </svg>
              </span>
              <input
                id="rep-name"
                type="text"
                className="input"
                placeholder="Ingresa el nombre completo"
                value={representativeName}
                onChange={(e) => setRepresentativeName(e.target.value)}
                disabled={loading}
              />
            </div>
          </div>

          <div className="form-group">
            <label htmlFor="company" className="label">
              Empresa / proveedor (si aplica)
            </label>
            <div className="input-wrapper">
              <span className="input-icon" aria-hidden="true">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#FF4B0B" strokeWidth="2">
                  <rect x="2" y="7" width="20" height="14" rx="2" ry="2" />
                  <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" />
                </svg>
              </span>
              <input
                id="company"
                type="text"
                className="input"
                placeholder="Ingresa el nombre de la empresa"
                value={company}
                onChange={(e) => setCompany(e.target.value)}
                disabled={loading}
              />
            </div>
          </div>

          <div className="form-group">
            <label htmlFor="email" className="label">
              Correo Electronico
            </label>
            <div className="input-wrapper">
              <span className="input-icon" aria-hidden="true">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#FF4B0B" strokeWidth="2">
                  <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
                  <polyline points="22,6 12,13 2,6" />
                </svg>
              </span>
              <input
                id="email"
                type="email"
                className="input"
                placeholder="Ingresa tu correo electrónico"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                disabled={loading}
              />
            </div>
          </div>

          <div className="form-group">
            <label htmlFor="password" className="label">
              Contraseña
            </label>
            <div className="input-wrapper">
              <span className="input-icon" aria-hidden="true">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#FF4B0B" strokeWidth="2">
                  <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                  <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                </svg>
              </span>
              <input
                id="password"
                type={showPassword ? "text" : "password"}
                className="input"
                placeholder="Ingresa tu contraseña"
                autoComplete="new-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={6}
                disabled={loading}
              />
              <button
                type="button"
                className="password-toggle"
                onClick={() => setShowPassword((prev) => !prev)}
                aria-label={showPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
                tabIndex={-1}
              >
                {showPassword ? (
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#FF4B0B" strokeWidth="2">
                    <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
                    <line x1="1" y1="1" x2="23" y2="23" />
                  </svg>
                ) : (
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#FF4B0B" strokeWidth="2">
                    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                    <circle cx="12" cy="12" r="3" />
                  </svg>
                )}
              </button>
            </div>
          </div>

          <div className="form-group">
            <label htmlFor="code" className="label">
              Código de invitación
            </label>
            <div className="input-wrapper">
              <span className="input-icon" aria-hidden="true">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#FF4B0B" strokeWidth="2">
                  <path d="M2 9a3 3 0 0 1 0 6v2a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-2a3 3 0 0 1 0-6V7a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v2z" />
                  <line x1="9" y1="12" x2="15" y2="12" />
                </svg>
              </span>
              <input
                id="code"
                type="text"
                className="input mono"
                placeholder="Ingresa el código que te compartieron"
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase())}
                required
                disabled={loading}
              />
            </div>
          </div>

          <button
            type="submit"
            className="btn btn-primary btn-block"
            disabled={loading}
          >
            {loading ? (
              <>
                <span className="spinner" aria-hidden="true" />
                Registrando...
              </>
            ) : (
              "Registrarme"
            )}
          </button>
        </form>

        <p className="auth-switch">
          ¿Ya tienes cuenta? <Link to="/login">Inicia sesión</Link>
        </p>
      </div>
    </div>
  );
}