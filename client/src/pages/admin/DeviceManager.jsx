import { useEffect, useState } from "react";
import DeviceList from "../../components/devices/DeviceList";
import { useAuth } from "../../context/AuthContext";
import { useToast } from "../../context/ToastContext";
import api from "../../services/api";
import { 
  Plus, 
  Search, 
  Boxes, 
  Mail, 
  X, 
  Pencil, 
  Trash2, 
  Upload, 
  Zap, 
  Send, 
  ExternalLink, 
  Copy, 
  Check, 
  Sparkles 
} from "lucide-react";
import "../../styles/DeviceManager.css";

/* MODAL 1: Solicitudes de Usuarios */
function RequestsModal({ isOpen, onClose }) {
  const { showSuccess } = useToast();
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [copiedId, setCopiedId] = useState(null);
  const [commentById, setCommentById] = useState({});
  const [rejectingId, setRejectingId] = useState(null);
  const [rejectReason, setRejectReason] = useState("");
  const [busyId, setBusyId] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    if (isOpen) {
      setLoading(true);
      api.get("/device-requests", { params: { status: "pending" } })
        .then((res) => setRequests(res.data))
        .finally(() => setLoading(false));
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const copyLink = async (r) => {
    try {
      await navigator.clipboard.writeText(r.link);
      setCopiedId(r.id);
      setTimeout(() => setCopiedId(null), 1500);
    } catch {
      /* fallback silencioso */
    }
  };

  const approve = async (r) => {
    setError("");
    setBusyId(r.id);
    try {
      await api.patch(`/device-requests/${r.id}/resolve`, {
        status: "added",
        comment: commentById[r.id]?.trim() || undefined,
      }, { skipGlobalErrorToast: true });
      setRequests((prev) => prev.filter((x) => x.id !== r.id));
      showSuccess("Solicitud aprobada");
    } catch (err) {
      setError(err.response?.data?.error || "No se pudo actualizar la solicitud");
    } finally {
      setBusyId(null);
    }
  };

  const reject = async (r) => {
    if (!rejectReason.trim()) {
      setError("Escribe el motivo para que el usuario sepa qué corregir");
      return;
    }
    setError("");
    setBusyId(r.id);
    try {
      await api.patch(`/device-requests/${r.id}/resolve`, {
        status: "rejected",
        comment: rejectReason.trim(),
      }, { skipGlobalErrorToast: true });
      setRequests((prev) => prev.filter((x) => x.id !== r.id));
      setRejectingId(null);
      setRejectReason("");
      showSuccess("Solicitud rechazada");
    } catch (err) {
      setError(err.response?.data?.error || "No se pudo rechazar la solicitud");
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="modal-backdrop">
      <div className="modal-card wide-modal">
        <button className="modal-close-btn" onClick={onClose}><X size={20} /></button>
        
        <div className="modal-header-section">
          <div className="modal-icon-badge badge-orange">
            <Send size={24} />
          </div>
          <div>
            <h2>PRODUCTOS PEDIDOS POR USUARIOS</h2>
            <p>El usuario no encontró esto en la biblioteca y envió el link. Revísalo y decide si lo agregas o solicitas que lo corrijan.</p>
          </div>
        </div>

        {error && <div className="error-message">{error}</div>}

        <div className="modal-body-list">
          {loading ? (
            <p className="empty-text">Cargando solicitudes...</p>
          ) : requests.length === 0 ? (
            <p className="empty-text">No hay solicitudes pendientes.</p>
          ) : (
            requests.map((r) => (
              <div key={r.id} className="request-item-card">
                <div className="request-item-header">
                  <div className="request-item-info">
                    <strong>{r.eventName || "Evento"}</strong>
                    <span className="request-sub">Zona: {r.zoneName || "General"}</span>
                    <span className="request-sub">Pedido por: {r.requestedByEmail}</span>
                    {r.note && <span className="request-note">Nota: {r.note}</span>}
                  </div>
                  <div className="request-item-links">
                    <a href={r.link} target="_blank" rel="noopener noreferrer" className="btn-light-sm">
                      <ExternalLink size={14} />
                      <span>Abrir link</span>
                    </a>
                    <button type="button" className="btn-light-sm" onClick={() => copyLink(r)}>
                      {copiedId === r.id ? <Check size={14} /> : <Copy size={14} />}
                      <span>{copiedId === r.id ? "¡Copiado!" : "Copiar link"}</span>
                    </button>
                  </div>
                </div>

                <input
                  className="modal-input-subtle"
                  placeholder="Comentario (Opcional, para tu registro interno)"
                  value={commentById[r.id] || ""}
                  onChange={(e) => setCommentById((prev) => ({ ...prev, [r.id]: e.target.value }))}
                />

                {rejectingId === r.id ? (
                  <div className="reject-box">
                    <input
                      className="modal-input"
                      autoFocus
                      placeholder="Motivo del rechazo (el usuario lo verá)..."
                      value={rejectReason}
                      onChange={(e) => setRejectReason(e.target.value)}
                    />
                    <div className="btn-row">
                      <button className="btn-danger-sm" onClick={() => reject(r)} disabled={busyId === r.id}>Confirmar rechazo</button>
                      <button className="btn-light-sm" onClick={() => { setRejectingId(null); setRejectReason(""); }}>Cancelar</button>
                    </div>
                  </div>
                ) : (
                  <div className="request-actions-row">
                    <button className="btn-orange-sm" onClick={() => approve(r)} disabled={busyId === r.id}>Aceptar</button>
                    <button className="btn-light-sm" onClick={() => setRejectingId(r.id)} disabled={busyId === r.id}>Rechazar</button>
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

/* MODAL 2: Gestión de Categorías */
function CategoriesModal({ isOpen, onClose, categories, onCreated, onUpdated, onDeleted }) {
  const { showSuccess } = useToast();
  const [newName, setNewName] = useState("");
  const [editingId, setEditingId] = useState(null);
  const [editName, setEditName] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  if (!isOpen) return null;

  const submitNew = async () => {
    if (!newName.trim()) return;
    setSaving(true);
    setError("");
    try {
      const res = await api.post("/devices/categories", { name: newName.trim() }, { skipGlobalErrorToast: true });
      onCreated(res.data);
      setNewName("");
      showSuccess(`Categoría "${res.data.name}" creada`);
    } catch (err) {
      setError(err.response?.data?.error || "No se pudo crear la categoría");
    } finally {
      setSaving(false);
    }
  };

  const submitRename = async (id) => {
    if (!editName.trim()) return;
    setSaving(true);
    setError("");
    try {
      const res = await api.patch(`/devices/categories/${id}`, { name: editName.trim() }, { skipGlobalErrorToast: true });
      onUpdated(res.data);
      setEditingId(null);
      showSuccess("Categoría renombrada");
    } catch (err) {
      setError(err.response?.data?.error || "No se pudo renombrar la categoría");
    } finally {
      setSaving(false);
    }
  };

  const remove = async (id) => {
    if (!window.confirm("¿Eliminar esta categoría? Solo se puede si ningún ítem la está usando.")) return;
    setError("");
    try {
      await api.delete(`/devices/categories/${id}`, { skipGlobalErrorToast: true });
      onDeleted(id);
      showSuccess("Categoría eliminada");
    } catch (err) {
      setError(err.response?.data?.error || "No se pudo eliminar la categoría");
    }
  };

  return (
    <div className="modal-backdrop">
      <div className="modal-card">
        <button className="modal-close-btn" onClick={onClose}><X size={20} /></button>

        <div className="modal-header-section">
          <div className="modal-icon-badge badge-orange">
            <Boxes size={24} />
          </div>
          <div>
            <h2>CATEGORÍAS</h2>
            <p>Crea, administra y organiza las categorías de tus equipos y recursos.</p>
          </div>
        </div>

        {error && <div className="error-message">{error}</div>}

        <div className="create-category-row">
          <input
            className="modal-input"
            placeholder="Nombre de la nueva categoría"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
          />
          <button className="btn-orange-solid" onClick={submitNew} disabled={saving}>
            <Plus size={16} />
            <span>Crear</span>
          </button>
        </div>

        <div className="modal-table-container">
          <div className="modal-table-header">
            <span>Nombre de la Categoría</span>
            <span>Acciones</span>
          </div>
          <div className="modal-table-body">
            {categories.length === 0 ? (
              <p className="empty-text">No hay categorías registradas.</p>
            ) : (
              categories.map((c) => (
                <div key={c.id} className="modal-table-row">
                  {editingId === c.id ? (
                    <div className="edit-inline-row">
                      <input
                        className="modal-input"
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        autoFocus
                      />
                      <button className="btn-orange-sm" onClick={() => submitRename(c.id)} disabled={saving}>Guardar</button>
                      <button className="btn-light-sm" onClick={() => setEditingId(null)}>Cancelar</button>
                    </div>
                  ) : (
                    <>
                      <div className="cat-name-cell">
                        <span className="dot-bullet" />
                        <span>{c.name}</span>
                      </div>
                      <div className="actions-cell">
                        <button className="btn-action-icon" onClick={() => { setEditingId(c.id); setEditName(c.name); }}>
                          <Pencil size={14} />
                          <span>Renombrar</span>
                        </button>
                        <button className="btn-action-icon" onClick={() => remove(c.id)}>
                          <Trash2 size={14} />
                          <span>Eliminar</span>
                        </button>
                      </div>
                    </>
                  )}
                </div>
              ))
            )}
          </div>
        </div>

        <div className="info-banner-tip">
          <div className="tip-icon-circle">
            <Zap size={18} />
          </div>
          <div className="tip-content">
            <h4>Tip S-Power</h4>
            <p>Las categorías te permiten clasificar y encontrar tus recursos más rápido.</p>
          </div>
        </div>
      </div>
    </div>
  );
}

/* MODAL 3: Agregar Ítem a la Biblioteca */
function CreateItemModal({ isOpen, onClose, categories, onCreated }) {
  const { showSuccess } = useToast();
  const [categoryId, setCategoryId] = useState("");
  const [name, setName] = useState("");
  const [reference, setReference] = useState("");
  const [powerKw, setPowerKw] = useState("");
  const [imageFile, setImageFile] = useState(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [isDragActive, setIsDragActive] = useState(false);

  if (!isOpen) return null;

  const acceptFile = (file) => {
    if (file && file.type.startsWith("image/")) setImageFile(file);
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    setIsDragActive(true);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    setIsDragActive(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragActive(false);
    acceptFile(e.dataTransfer.files?.[0]);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!name.trim()) { setError("El nombre del producto es requerido"); return; }
    
    setSaving(true);
    setError("");

    // Los nombres de campo deben coincidir exactamente con lo que espera el backend
    // (ver server/src/controllers/deviceController.js::createDevice). Antes se enviaban
    // como "name"/"powerKw"/"image", que el backend no reconocía: el producto llegaba
    // vacío (400) y, si había foto, Multer rechazaba el campo por nombre inesperado (500).
    const formData = new FormData();
    formData.append("product", name.trim());
    if (categoryId) formData.append("categoryId", categoryId);
    if (reference.trim()) formData.append("reference", reference.trim());
    if (powerKw) formData.append("powerConsumption", powerKw);
    if (imageFile) formData.append("photo", imageFile);

    try {
      await api.post("/devices", formData, {
        headers: { "Content-Type": "multipart/form-data" },
        skipGlobalErrorToast: true,
      });
      showSuccess("Ítem agregado a la biblioteca");
      onCreated();
      onClose();
      // Reset
      setName("");
      setCategoryId("");
      setReference("");
      setPowerKw("");
      setImageFile(null);
    } catch (err) {
      setError(err.response?.data?.error || "Error al crear el ítem");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="modal-backdrop">
      <div className="modal-card">
        <button className="modal-close-btn" onClick={onClose}><X size={20} /></button>

        <div className="modal-header-section">
          <div className="modal-icon-badge badge-orange">
            <Boxes size={24} />
          </div>
          <div>
            <h2>AGREGAR ÍTEM A LA BIBLIOTECA</h2>
            <p>Completa la información para agregar el nuevo ítem.</p>
          </div>
        </div>

        {error && <div className="error-message">{error}</div>}

        <form onSubmit={handleSubmit} className="modal-form">
          <div className="form-group">
            <label>Categoría</label>
            <select
              className="modal-input"
              value={categoryId}
              onChange={(e) => setCategoryId(e.target.value)}
            >
              <option value="">Selecciona el nombre de la categoría</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>

          <div className="form-group">
            <label>Producto</label>
            <input
              className="modal-input"
              placeholder="Nombre del producto"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>

          <div className="form-group">
            <label>Referencia</label>
            <input
              className="modal-input"
              placeholder="Referencia o código del producto"
              value={reference}
              onChange={(e) => setReference(e.target.value)}
            />
          </div>

          <div className="form-group">
            <label>Consumo eléctrico (kW) — solo tú lo ves</label>
            <input
              type="number"
              step="any"
              className="modal-input"
              placeholder="Ingresa el consumo eléctrico en kW"
              value={powerKw}
              onChange={(e) => setPowerKw(e.target.value)}
            />
          </div>

          <div className="form-group">
            <label>Foto (opcional)</label>
            <div
              className={`upload-dropzone${isDragActive ? " upload-dropzone-active" : ""}`}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
            >
              <Upload size={32} className="upload-icon" />
              <p>
                {imageFile ? imageFile.name : "Arrastra aquí tu imagen o haz clic para seleccionarla"}
              </p>
              <label className="btn-orange-solid btn-file-picker">
                Seleccionar archivos
                <input
                  type="file"
                  accept="image/*"
                  hidden
                  onChange={(e) => acceptFile(e.target.files[0] || null)}
                />
              </label>
            </div>
          </div>

          <button type="submit" className="btn-orange-submit" disabled={saving}>
            {saving ? "Guardando..." : "Agregar a la biblioteca"}
          </button>
        </form>
      </div>
    </div>
  );
}

/* COMPONENTE PRINCIPAL */
export default function DeviceManager() {
  const { profile } = useAuth();
  const isClient = profile?.role === "user";
  const canManage = ["admin", "subadmin", "productor"].includes(profile?.role);
  const canManageCategories = ["admin", "subadmin"].includes(profile?.role);
  const canSeeRequests = ["admin", "subadmin"].includes(profile?.role);

  const [categories, setCategories] = useState([]);
  const [refreshKey, setRefreshKey] = useState(0);

  // Búsqueda y filtro de categoría: viven aquí (fuente única) y se pasan como props
  // controlados a DeviceList, que antes tenía su propia copia duplicada de estos mismos
  // controles (dos cajas de búsqueda distintas para la misma lista).
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");

  // Estados de Modales
  const [showCatModal, setShowCatModal] = useState(false);
  const [showReqModal, setShowReqModal] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);

  // Carga inicial de categorías
  useEffect(() => {
    api.get("/devices/categories").then((res) => setCategories(res.data));
  }, []);

  const addCategory = (c) => setCategories((prev) => [...prev, c].sort((a, b) => a.name.localeCompare(b.name)));
  const updateCategory = (c) => setCategories((prev) => prev.map((x) => (x.id === c.id ? c : x)).sort((a, b) => a.name.localeCompare(b.name)));
  const removeCategory = (id) => setCategories((prev) => prev.filter((x) => x.id !== id));

  return (
    <div className="library-container">
      {/* Header Principal */}
      <div className="library-header-row">
        <div>
          <h1>BIBLIOTECA</h1>
          <span className="accent-line" />
          <p className="library-subtitle">
            {isClient
              ? "Estos son los ítems disponibles para usar en tus zonas. Si no encuentras el que necesitas, puedes enviar una solicitud."
              : "Accede a recursos indispensables para tus eventos"}
          </p>
        </div>

        {canManage && (
          <button className="btn-orange-solid" onClick={() => setShowCreateModal(true)}>
            <Plus size={18} />
            <span>Nuevo Ítem</span>
          </button>
        )}
      </div>

      {/* Barra de Acciones y Filtros */}
      <div className="library-toolbar">
        <div className="search-box-container">
          <Search size={18} className="search-icon" />
          <input
            className="search-input"
            placeholder="Buscar por producto, referencia o categoría"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        <div className="toolbar-buttons">
          <select
            className="input"
            style={{ maxWidth: 200 }}
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
          >
            <option value="">Todas las categorías</option>
            {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>

          {canManageCategories && (
            <button className="btn-toolbar-light" onClick={() => setShowCatModal(true)}>
              <Boxes size={16} />
              <span>Gestionar categoría</span>
            </button>
          )}

          {canSeeRequests && (
            <button className="btn-toolbar-light" onClick={() => setShowReqModal(true)}>
              <Mail size={16} />
              <span>Solicitud del usuario</span>
            </button>
          )}
        </div>
      </div>

      {/* Listado de Productos */}
      <DeviceList
        refreshKey={refreshKey}
        categories={categories}
        onCategoryCreated={addCategory}
        canCreateCategory={canManageCategories}
        search={search}
        categoryFilter={categoryFilter}
      />

      {/* Banner Informativo Inferior */}
      <div className="info-banner-footer">
        <div className="footer-banner-icon">
          <Sparkles size={22} />
        </div>
        <div>
          <h4>Centraliza todo lo importante.</h4>
          <p>Puedes encontrar diferentes recursos necesarios para tus eventos. Todo en un solo lugar.</p>
        </div>
      </div>

      {/* Modales */}
      <CategoriesModal
        isOpen={showCatModal}
        onClose={() => setShowCatModal(false)}
        categories={categories}
        onCreated={addCategory}
        onUpdated={updateCategory}
        onDeleted={removeCategory}
      />

      <RequestsModal
        isOpen={showReqModal}
        onClose={() => setShowReqModal(false)}
      />

      <CreateItemModal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        categories={categories}
        onCreated={() => setRefreshKey((k) => k + 1)}
      />
    </div>
  );
}