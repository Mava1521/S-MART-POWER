import { useEffect, useState } from "react";
import { 
  Search, 
  Plus, 
  Pencil, 
  Trash2, 
  X, 
  Users, 
  Eye, 
  EyeOff, 
  Check 
} from "lucide-react";
import api from "../../services/api";
import "../../styles/ProductorManager.css";

/**
 * PRODUCTORES MANAGER
 * Arquitectura limpia, responsive y libre de inline-styles.
 */
export default function ProductorManager() {
  const [productores, setProductores] = useState([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);

  // Estados del Modal
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  // Estados Edición Inline
  const [editingUid, setEditingUid] = useState(null);
  const [editName, setEditName] = useState("");

  const load = () => {
    setLoading(true);
    api.get("/auth/users", { params: { role: "productor" } })
      .then((res) => setProductores(res.data))
      .finally(() => setLoading(false));
  };

  useEffect(load, []);

  const filtered = productores.filter((p) => {
    const q = search.toLowerCase();
    return p.email?.toLowerCase().includes(q) || (p.name || "").toLowerCase().includes(q);
  });

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setSaving(true);
    try {
      await api.post("/auth/productores", { name, email, password });
      setName(""); 
      setEmail(""); 
      setPassword("");
      setIsModalOpen(false);
      load();
    } catch (err) {
      setError(err.response?.data?.error || "No se pudo crear el productor");
    } finally {
      setSaving(false);
    }
  };

  const startEdit = (p) => { 
    setEditingUid(p.uid); 
    setEditName(p.name || ""); 
  };

  const saveEdit = async (uid) => {
    await api.put(`/auth/users/${uid}`, { name: editName });
    setEditingUid(null);
    load();
  };

  const handleDelete = async (p) => {
    if (!window.confirm(`¿Eliminar la cuenta de ${p.email}? Esta acción no se puede deshacer.`)) return;
    await api.delete(`/auth/users/${p.uid}`);
    load();
  };

  return (
    <div className="productor-manager-container">
      {/* Header Principal */}
      <div className="pm-header">
        <h1 className="pm-title">PRODUCTORES</h1>
        <div className="pm-title-underline" />
        <p className="pm-subtitle">
          Los productores gestionan zonas y biblioteca, e invitan únicamente a usuarios.
        </p>
      </div>

      {/* Toolbar */}
      <div className="pm-toolbar">
        <div className="pm-search-container">
          <Search size={18} className="pm-search-icon" />
          <input
            type="text"
            className="pm-search-input"
            placeholder="Buscar por nombre o correo"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        <button className="pm-btn-primary" onClick={() => setIsModalOpen(true)}>
          <Plus size={18} />
          <span>Nuevo productor</span>
        </button>
      </div>

      {/* Tabla */}
      <div className="pm-table-card">
        <div className="pm-table-header">
          <span>Nombre Completo</span>
          <span>Correo Electrónico</span>
          <span style={{ textAlign: "right" }}>Acciones</span>
        </div>

        <div>
          {loading ? (
            <div className="pm-table-empty">Cargando productores...</div>
          ) : filtered.length === 0 ? (
            <div className="pm-table-empty">No hay productores que coincidan.</div>
          ) : (
            filtered.map((p) => (
              <div key={p.uid} className="pm-table-row">
                <div>
                  {editingUid === p.uid ? (
                    <input
                      className="pm-inline-input"
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      autoFocus
                    />
                  ) : (
                    <strong className="pm-row-name">{p.name || p.email}</strong>
                  )}
                </div>

                <span className="pm-row-email">{p.email}</span>

                <div className="pm-actions-cell">
                  {editingUid === p.uid ? (
                    <>
                      <button className="pm-btn-save" onClick={() => saveEdit(p.uid)}>
                        <Check size={14} /> Guardar
                      </button>
                      <button className="pm-btn-cancel" onClick={() => setEditingUid(null)}>
                        Cancelar
                      </button>
                    </>
                  ) : (
                    <>
                      <button className="pm-btn-action" onClick={() => startEdit(p)}>
                        <Pencil size={13} color="#E04F33" /> Renombrar
                      </button>
                      <button className="pm-btn-action" onClick={() => handleDelete(p)}>
                        <Trash2 size={13} color="#E04F33" /> Eliminar
                      </button>
                    </>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* MODAL SIMÉTRICO */}
      {isModalOpen && (
        <div className="pm-modal-backdrop">
          <div className="pm-modal-card">
            <button
              type="button"
              className="pm-modal-close-btn"
              onClick={() => setIsModalOpen(false)}
            >
              <X size={22} />
            </button>

            <div className="pm-modal-header">
              <div className="pm-modal-avatar">
                <Users size={30} color="#E04F33" />
              </div>
              <h2 className="pm-modal-title">NUEVO PRODUCTOR</h2>
            </div>

            {error && <div className="error-message" style={{ marginBottom: "16px" }}>{error}</div>}

            <form onSubmit={handleSubmit} className="pm-modal-form">
              <div className="pm-form-group">
                <label className="pm-form-label" htmlFor="pr-name">Nombre</label>
                <input
                  id="pr-name"
                  type="text"
                  className="pm-modal-input"
                  placeholder="Ingresa el nombre completo"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                />
              </div>

              <div className="pm-form-group">
                <label className="pm-form-label" htmlFor="pr-email">Correo</label>
                <input
                  id="pr-email"
                  type="email"
                  className="pm-modal-input"
                  placeholder="Ingresa el correo electrónico"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>

              <div className="pm-form-group">
                <label className="pm-form-label" htmlFor="pr-password">Contraseña temporal</label>
                <div className="pm-password-wrapper">
                  <input
                    id="pr-password"
                    type={showPassword ? "text" : "password"}
                    minLength={6}
                    className="pm-modal-input pm-password-input"
                    placeholder="Ingresa una contraseña temporal"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                  />
                  <button
                    type="button"
                    className="pm-eye-btn"
                    onClick={() => setShowPassword(!showPassword)}
                  >
                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </div>

              <div className="pm-modal-footer">
                <button type="submit" className="pm-btn-primary" disabled={saving}>
                  <Users size={18} />
                  <span>{saving ? "Creando..." : "Crear productor"}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}