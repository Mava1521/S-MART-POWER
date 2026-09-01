import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { 
  Info, 
  Search, 
  Plus, 
  Pencil, 
  Trash2, 
  X, 
  UserCog, 
  Eye, 
  EyeOff, 
  Check, 
  Sparkles 
} from "lucide-react";
import api from "../../services/api";
import { useToast } from "../../context/ToastContext";

/**
 * SUB-ADMINISTRADORES (UI / UX Refactored)
 * Mantiene la lógica original de gestión de cuentas y arquitectura limpia.
 */
export default function SubadminManager() {
  const { showSuccess } = useToast();
  
  // Estados de la lista y filtrado
  const [subadmins, setSubadmins] = useState([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);

  // Estados del modal de creación
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  // Estados de edición inline
  const [editingUid, setEditingUid] = useState(null);
  const [editName, setEditName] = useState("");
  const [rowError, setRowError] = useState("");

  const load = () => {
    setLoading(true);
    api.get("/auth/users", { params: { role: "subadmin" } })
      .then((res) => setSubadmins(res.data))
      .finally(() => setLoading(false));
  };

  useEffect(load, []);

  const filtered = subadmins.filter((s) => {
    const q = search.toLowerCase();
    return s.email?.toLowerCase().includes(q) || (s.name || "").toLowerCase().includes(q);
  });

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setSaving(true);
    try {
      await api.post("/auth/subadmins", { name, email, password }, { skipGlobalErrorToast: true });
      setName(""); 
      setEmail(""); 
      setPassword("");
      setIsModalOpen(false);
      load();
      showSuccess("Sub-administrador creado");
    } catch (err) {
      setError(err.response?.data?.error || "No se pudo crear el sub-administrador");
    } finally {
      setSaving(false);
    }
  };

  const startEdit = (s) => { 
    setEditingUid(s.uid); 
    setEditName(s.name || ""); 
  };

  const saveEdit = async (uid) => {
    setRowError("");
    try {
      await api.put(`/auth/users/${uid}`, { name: editName }, { skipGlobalErrorToast: true });
      setEditingUid(null);
      load();
      showSuccess("Cambios guardados");
    } catch (err) {
      setRowError(err.response?.data?.error || "No se pudieron guardar los cambios");
    }
  };

  const handleDelete = async (s) => {
    if (!window.confirm(`¿Eliminar la cuenta de ${s.email}? Esta acción no se puede deshacer.`)) return;
    setRowError("");
    try {
      await api.delete(`/auth/users/${s.uid}`, { skipGlobalErrorToast: true });
      setSubadmins((prev) => prev.filter((x) => x.uid !== s.uid));
      showSuccess("Cuenta eliminada");
    } catch (err) {
      setRowError(err.response?.data?.error || "No se pudo eliminar la cuenta");
    }
  };

  return (
    <div className="library-container">
      {/* Encabezado Principal */}
      <div className="library-header-row">
        <div>
          <h1>SUB-ADMINISTRADORES</h1>
          <span className="accent-line" />
          <p className="library-subtitle">
            Crea la cuenta de acceso para tus sub-administradores. Quedan activos de inmediato.
          </p>
        </div>
      </div>

      {/* Callout de información de asignación */}
      <div className="info-callout" style={{ marginBottom: "var(--space-4)" }}>
        <Info size={18} />
        <p style={{ margin: 0 }}>
          Para asignarle eventos, productores o usuarios a un sub-administrador, entra al evento
          correspondiente y usa <strong>Equipo</strong> — ahí se arma todo junto, en el contexto de ese evento.
        </p>
      </div>

      {/* Barra de Búsqueda y Botón de Acción */}
      <div className="library-toolbar">
        <div className="search-box-container">
          <Search size={18} className="search-icon" />
          <input
            className="search-input"
            placeholder="Buscar por nombre o correo"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        <button className="btn-orange-solid" onClick={() => setIsModalOpen(true)}>
          <Plus size={18} />
          <span>Nuevo sub-administrador</span>
        </button>
      </div>

      {rowError && <div className="error-message" style={{ marginBottom: "var(--space-3)" }}>{rowError}</div>}

      {/* Tabla de Sub-administradores */}
      <div className="modal-table-container" style={{ marginTop: "var(--space-4)" }}>
        <div className="modal-table-header" style={{ display: "grid", gridTemplateColumns: "1fr 1fr 180px", padding: "12px 16px" }}>
          <span>Nombre Completo</span>
          <span>Correo Electrónico</span>
          <span style={{ textAlign: "right" }}>Acciones</span>
        </div>

        <div className="modal-table-body">
          {loading ? (
            <p className="empty-text">Cargando sub-administradores...</p>
          ) : filtered.length === 0 ? (
            <div className="empty-state">
              <p className="empty-text">No hay sub-administradores que coincidan.</p>
            </div>
          ) : (
            filtered.map((s) => (
              <div 
                key={s.uid} 
                className="modal-table-row" 
                style={{ display: "grid", gridTemplateColumns: "1fr 1fr 180px", alignItems: "center", padding: "12px 16px" }}
              >
                {/* Columna 1: Nombre / Input de Edición */}
                <div>
                  {editingUid === s.uid ? (
                    <input 
                      className="modal-input" 
                      style={{ height: "36px" }}
                      value={editName} 
                      onChange={(e) => setEditName(e.target.value)} 
                      autoFocus
                    />
                  ) : (
                    <strong>{s.name || s.email}</strong>
                  )}
                </div>

                {/* Columna 2: Correo Electrónico */}
                <span style={{ color: "var(--color-text-muted)" }}>{s.email}</span>

                {/* Columna 3: Botones de Acción */}
                <div className="actions-cell" style={{ justifyContent: "flex-end", gap: "8px" }}>
                  {editingUid === s.uid ? (
                    <>
                      <button className="btn-orange-sm" onClick={() => saveEdit(s.uid)}>
                        <Check size={14} />
                        <span>Guardar</span>
                      </button>
                      <button className="btn-light-sm" onClick={() => setEditingUid(null)}>
                        Cancelar
                      </button>
                    </>
                  ) : (
                    <>
                      <button className="btn-action-icon" onClick={() => startEdit(s)}>
                        <Pencil size={14} />
                        <span>Renombrar</span>
                      </button>
                      <button className="btn-action-icon" onClick={() => handleDelete(s)}>
                        <Trash2 size={14} />
                        <span>Eliminar</span>
                      </button>
                    </>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Nota aclaratoria inferior */}
      {filtered.length > 0 && (
        <p style={{ fontSize: "0.85rem", color: "var(--color-text-muted)", marginTop: "var(--space-3)" }}>
          ¿Necesitas ver o cambiar qué eventos, productores o usuarios tiene cada uno? Ve a{" "}
          <Link to="/admin/events" style={{ color: "var(--color-primary, #e85d04)", fontWeight: 600 }}>Eventos</Link> y entra a <strong>Equipo</strong> dentro del evento correspondiente.
        </p>
      )}

      {/* Banner decorativo UX */}
      <div className="info-banner-footer" style={{ marginTop: "var(--space-5)" }}>
        <div className="footer-banner-icon">
          <Sparkles size={22} />
        </div>
        <div>
          <h4>Administración Centralizada</h4>
          <p>Gestiona los accesos y roles administrativos de tu plataforma de manera segura e instantánea.</p>
        </div>
      </div>

      {/* MODAL: Crear Nuevo Sub-Administrador */}
      {isModalOpen && (
        <div style={{
          position: "fixed",
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: "rgba(0, 0, 0, 0.4)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          zIndex: 1000,
          padding: "20px"
        }}>
          <div style={{
            backgroundColor: "#ffffff",
            borderRadius: "20px",
            padding: "36px 40px",
            width: "100%",
            maxWidth: "520px",
            position: "relative",
            boxShadow: "0 10px 25px rgba(0, 0, 0, 0.08)",
            boxSizing: "border-box"
          }}>
            {/* Botón Cerrar X */}
            <button 
              type="button"
              onClick={() => setIsModalOpen(false)}
              style={{
                position: "absolute",
                top: "24px",
                right: "24px",
                background: "transparent",
                border: "none",
                cursor: "pointer",
                color: "#2c3e50",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                padding: "4px"
              }}
            >
              <X size={22} />
            </button>

            {/* Cabecera del Modal */}
            <div style={{
              display: "flex",
              alignItems: "center",
              gap: "16px",
              marginBottom: "28px"
            }}>
              <div style={{
                width: "64px",
                height: "64px",
                borderRadius: "50%",
                backgroundColor: "#FDF2EE",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0
              }}>
                <UserCog size={30} color="#E04F33" />
              </div>
              <h2 style={{
                fontSize: "1.25rem",
                fontWeight: 700,
                color: "#111827",
                margin: 0,
                letterSpacing: "0.5px"
              }}>
                NUEVO SUB-ADMINISTRADOR
              </h2>
            </div>

            {error && (
              <div className="error-message" style={{ marginBottom: "16px" }}>
                {error}
              </div>
            )}

            {/* Formulario */}
            <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
              
              {/* Campo Nombre */}
              <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                <label style={{ fontSize: "0.88rem", fontWeight: 500, color: "#374151" }}>
                  Nombre
                </label>
                <input
                  id="sa-name"
                  type="text"
                  className="input"
                  placeholder="Ingresa el nombre completo"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  style={{
                    width: "100%",
                    height: "44px",
                    borderRadius: "10px",
                    border: "1px solid #D1D5DB",
                    padding: "0 14px",
                    fontSize: "0.9rem",
                    boxSizing: "border-box",
                    outline: "none"
                  }}
                  required
                />
              </div>

              {/* Campo Correo */}
              <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                <label style={{ fontSize: "0.88rem", fontWeight: 500, color: "#374151" }}>
                  Correo
                </label>
                <input
                  id="sa-email"
                  type="email"
                  className="input"
                  placeholder="Ingresa el correo electrónico"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  style={{
                    width: "100%",
                    height: "44px",
                    borderRadius: "10px",
                    border: "1px solid #D1D5DB",
                    padding: "0 14px",
                    fontSize: "0.9rem",
                    boxSizing: "border-box",
                    outline: "none"
                  }}
                  required
                />
              </div>

              {/* Campo Contraseña Temporal */}
              <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                <label style={{ fontSize: "0.88rem", fontWeight: 500, color: "#374151" }}>
                  Contraseña temporal
                </label>
                <div style={{ position: "relative", width: "100%" }}>
                  <input
                    id="sa-password"
                    type={showPassword ? "text" : "password"}
                    minLength={6}
                    className="input"
                    placeholder="Ingresa una contraseña temporal"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    style={{
                      width: "100%",
                      height: "44px",
                      borderRadius: "10px",
                      border: "1px solid #D1D5DB",
                      paddingLeft: "14px",
                      paddingRight: "44px",
                      fontSize: "0.9rem",
                      boxSizing: "border-box",
                      outline: "none"
                    }}
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    style={{
                      position: "absolute",
                      right: "12px",
                      top: "50%",
                      transform: "translateY(-50%)",
                      background: "transparent",
                      border: "none",
                      cursor: "pointer",
                      color: "#6B7280",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      padding: 0
                    }}
                  >
                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </div>

              {/* Contenedor del Botón (Alineado a la derecha) */}
              <div style={{ display: "flex", justifyContent: "flex-end", marginTop: "12px" }}>
                <button
                  type="submit"
                  disabled={saving}
                  style={{
                    backgroundColor: "#E04F33",
                    color: "#ffffff",
                    border: "none",
                    borderRadius: "10px",
                    height: "44px",
                    padding: "0 22px",
                    fontSize: "0.9rem",
                    fontWeight: 600,
                    cursor: saving ? "not-allowed" : "pointer",
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: "8px",
                    opacity: saving ? 0.8 : 1,
                    transition: "background-color 0.2s ease"
                  }}
                >
                  <UserCog size={18} />
                  <span>{saving ? "Creando..." : "Crear sub-administrador"}</span>
                </button>
              </div>

            </form>
          </div>
        </div>
      )}
    </div>
  );
}