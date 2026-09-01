import { useEffect, useState } from "react";
import api from "../../services/api";
import { useAuth } from "../../context/AuthContext";
import { useToast } from "../../context/ToastContext";

/**
 * Lista + edición inline de la biblioteca. El borrado solo se muestra a admin.
 * `categories` viene del padre (DeviceManager) — misma fuente que el formulario de creación
 * y el panel de gestión, así que una categoría nueva aparece de inmediato en el filtro.
 * `search`/`categoryFilter` también vienen controlados del padre (DeviceManager), que es
 * quien renderiza la única caja de búsqueda de esta pantalla — este componente ya no tiene
 * su propia copia duplicada del buscador.
 */
export default function DeviceList({ refreshKey, categories, onCategoryCreated, canCreateCategory, search = "", categoryFilter = "" }) {
  const { profile } = useAuth();
  const { showSuccess } = useToast();
  const [devices, setDevices] = useState([]);
  const [loading, setLoading] = useState(true);

  const isAdmin = profile?.role === "admin";
  const canEdit = ["admin", "subadmin", "productor"].includes(profile?.role);
  const canDelete = isAdmin;

  const [editingId, setEditingId] = useState(null);
  const [editForm, setEditForm] = useState({ categoryId: "", product: "", reference: "", powerConsumption: "" });
  const [editPhoto, setEditPhoto] = useState(null);
  const [saving, setSaving] = useState(false);
  const [editError, setEditError] = useState("");
  const [newCategoryName, setNewCategoryName] = useState("");

  const load = () => {
    setLoading(true);
    api.get("/devices", { params: { search, categoryId: categoryFilter || undefined } })
      .then((res) => setDevices(res.data))
      .finally(() => setLoading(false));
  };

  useEffect(load, [search, categoryFilter, refreshKey]);

  const handleDelete = async (id) => {
    if (!window.confirm("¿Eliminar este ítem de la biblioteca? Esta acción no se puede deshacer.")) return;
    await api.delete(`/devices/${id}`);
    setDevices((prev) => prev.filter((d) => d.id !== id));
    showSuccess("Ítem eliminado");
  };

  const startEdit = (d) => {
    setEditingId(d.id);
    setEditForm({ categoryId: d.categoryId || "", product: d.product, reference: d.reference || "", powerConsumption: d.powerConsumption ?? "" });
    setEditPhoto(null);
    setEditError("");
  };

  const createCategoryInline = async () => {
    if (!newCategoryName.trim()) return;
    const res = await api.post("/devices/categories", { name: newCategoryName.trim() });
    onCategoryCreated(res.data);
    setEditForm((f) => ({ ...f, categoryId: res.data.id }));
    setNewCategoryName("");
  };

  const saveEdit = async (id) => {
    setSaving(true);
    setEditError("");
    try {
      const formData = new FormData();
      formData.append("categoryId", editForm.categoryId);
      formData.append("product", editForm.product);
      formData.append("reference", editForm.reference);
      if (isAdmin) formData.append("powerConsumption", editForm.powerConsumption);
      if (editPhoto) formData.append("photo", editPhoto);
      await api.put(`/devices/${id}`, formData, { headers: { "Content-Type": "multipart/form-data" }, skipGlobalErrorToast: true });
      setEditingId(null);
      load();
      showSuccess("Cambios guardados");
    } catch (err) {
      setEditError(err.response?.data?.error || "No se pudo guardar el cambio");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="card" style={{ marginTop: "var(--space-5)" }}>
      <div className="card-title-row">
        <h2>Biblioteca</h2>
      </div>

      {loading && <p>Cargando...</p>}

      {!loading && devices.length === 0 && (
        <div className="empty-state">
          <p>No hay ítems que coincidan con tu búsqueda todavía.</p>
        </div>
      )}

      <div className="device-grid">
        {devices.map((d) => {
          const isEditing = editingId === d.id;
          return (
            <div className="device-card" key={d.id}>
              {d.photoUrl
                ? <img className="device-card-photo" src={d.photoUrl} alt={d.product} />
                : <div className="device-card-photo-placeholder">Sin foto</div>}
              <div className="device-card-body">
                {isEditing ? (
                  <>
                    {editError && <div className="error-message">{editError}</div>}
                    <label className="label" style={{ fontSize: "0.75rem" }}>Categoría</label>
                    <div style={{ display: "flex", gap: 6, marginBottom: 6 }}>
                      <select className="input" value={editForm.categoryId} onChange={(e) => setEditForm({ ...editForm, categoryId: e.target.value })}>
                        <option value="">Sin categoría</option>
                        {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                      </select>
                    </div>
                    {canCreateCategory && (
                      <div style={{ display: "flex", gap: 6, marginBottom: 6 }}>
                        <input className="input" placeholder="+ Nueva categoría" value={newCategoryName} onChange={(e) => setNewCategoryName(e.target.value)} />
                        <button type="button" className="btn btn-secondary btn-sm" onClick={createCategoryInline}>Crear</button>
                      </div>
                    )}
                    <input className="input" style={{ marginBottom: 6 }} value={editForm.product} onChange={(e) => setEditForm({ ...editForm, product: e.target.value })} placeholder="Producto" />
                    <input className="input" style={{ marginBottom: 6 }} value={editForm.reference} onChange={(e) => setEditForm({ ...editForm, reference: e.target.value })} placeholder="Referencia" />
                    {isAdmin && (
                      <input className="input mono" style={{ marginBottom: 6 }} type="number" min={0} step="0.01" value={editForm.powerConsumption} onChange={(e) => setEditForm({ ...editForm, powerConsumption: e.target.value })} placeholder="Consumo eléctrico (kW)" />
                    )}
                    <input className="input-file" type="file" accept="image/*" onChange={(e) => setEditPhoto(e.target.files[0])} style={{ marginBottom: 6 }} />
                    <div className="device-card-footer">
                      <button className="btn btn-primary btn-sm" onClick={() => saveEdit(d.id)} disabled={saving}>{saving ? "Guardando..." : "Guardar"}</button>
                      <button className="btn btn-secondary btn-sm" onClick={() => setEditingId(null)}>Cancelar</button>
                    </div>
                  </>
                ) : (
                  <>
                    {d.categoryName && <span className="badge badge-warning badge-category" style={{ alignSelf: "flex-start", marginBottom: 4 }}>{d.categoryName}</span>}
                    <strong>{d.product}</strong>
                    {d.reference && <span style={{ color: "var(--color-text-muted)", fontSize: "0.85rem" }}>{d.reference}</span>}
                    {isAdmin && (
                      <span className="mono" style={{ fontSize: "0.75rem", color: "var(--color-text-faint)" }}>
                        Consumo: {d.powerConsumption != null ? `${d.powerConsumption} kW` : "sin registrar"}
                      </span>
                    )}
                    <div className="device-card-footer">
                      <span />
                      <div style={{ display: "flex", gap: 6 }}>
                        {canEdit && <button className="btn btn-secondary btn-sm" onClick={() => startEdit(d)}>Editar</button>}
                        {canDelete && <button className="btn btn-danger btn-sm" onClick={() => handleDelete(d.id)}>Eliminar</button>}
                      </div>
                    </div>
                  </>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
