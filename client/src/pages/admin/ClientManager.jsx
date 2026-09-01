import { useEffect, useState } from "react";
import { Search, Edit2, Trash2, ChevronsUpDown, Save, X } from "lucide-react";
import api from "../../services/api";
import { useAuth } from "../../context/AuthContext";
import "../../styles/ClientManager.css";

/**
 * CLIENT MANAGER (USUARIOS)
 * Administración de usuarios con tabla formateada, barra de búsqueda horizontal
 * y soporte completo para edición y asignación de zonas.
 */
export default function ClientManager() {
  const { profile } = useAuth();
  const canManage = profile?.role === "productor";
  const [clients, setClients] = useState([]);
  const [events, setEvents] = useState({}); // { eventId: name }
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [editingUid, setEditingUid] = useState(null);
  const [editForm, setEditForm] = useState({ representativeName: "", company: "" });

  const load = async () => {
    setLoading(true);
    try {
      const [usersRes, activeRes, archivedRes] = await Promise.all([
        api.get("/auth/users", { params: { role: "user" } }),
        api.get("/events", { params: { status: "active" } }),
        api.get("/events", { params: { status: "archived" } }).catch(() => ({ data: [] })),
      ]);
      setClients(usersRes.data);
      const map = {};
      [...activeRes.data, ...archivedRes.data].forEach((ev) => {
        map[ev.id] = ev.name;
      });
      setEvents(map);
    } catch (err) {
      console.error("Error cargando usuarios:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const filtered = clients.filter((c) => {
    const s = search.toLowerCase();
    return (
      c.email?.toLowerCase().includes(s) ||
      (c.representativeName || "").toLowerCase().includes(s) ||
      (c.company || "").toLowerCase().includes(s)
    );
  });

  const startEdit = (c) => {
    setEditingUid(c.uid);
    setEditForm({ representativeName: c.representativeName || "", company: c.company || "" });
  };

  const saveEdit = async (uid) => {
    await api.put(`/auth/users/${uid}`, editForm);
    setEditingUid(null);
    load();
  };

  const handleDelete = async (c) => {
    if (!window.confirm(`¿Eliminar la cuenta de ${c.email}? Esta acción no se puede deshacer.`)) return;
    await api.delete(`/auth/users/${c.uid}`);
    load();
  };

  return (
    <div className="client-manager-container">
      {/* Header Principal */}
      <div className="cm-header">
        <h1 className="cm-title">USUARIOS</h1>
        <div className="cm-title-underline" />
        <p className="cm-subtitle">
          Usuarios registrados con tu código de invitación. Aquí puedes buscarlos, editarlos o eliminarlos.
        </p>
      </div>

      {/* Buscador de Ancho Completo */}
      <div className="cm-search-container">
        <Search size={18} className="cm-search-icon" />
        <input
          className="cm-search-input"
          placeholder="Buscar por representante, empresa o correo"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {/* Card de la Tabla */}
      <div className="cm-table-card">
        {loading && (
          <div className="cm-empty-state">
            <p>Cargando usuarios...</p>
          </div>
        )}

        {!loading && filtered.length === 0 && (
          <div className="cm-empty-state">
            <p>No hay usuarios que coincidan con tu búsqueda.</p>
          </div>
        )}

        {!loading && filtered.length > 0 && (
          <table className="cm-table">
            <thead>
              <tr>
                <th>
                  <div className="th-content">
                    <span>Nombre Completo / Empresa</span>
                    <ChevronsUpDown size={14} color="#9CA3AF" />
                  </div>
                </th>
                <th>Correo Electrónico</th>
                {canManage && <th className="cm-actions-cell">Acciones</th>}
              </tr>
            </thead>
            <tbody>
              {filtered.map((c) => {
                const zones = Object.entries(c.zoneAssignments || {});
                const isEditing = editingUid === c.uid;

                return (
                  <tr key={c.uid}>
                    {/* Nombre / Empresa / Asignaciones */}
                    <td>
                      {isEditing ? (
                        <div className="cm-edit-form">
                          <input
                            className="cm-input-sm"
                            placeholder="Nombre representante"
                            value={editForm.representativeName}
                            onChange={(e) => setEditForm({ ...editForm, representativeName: e.target.value })}
                          />
                          <input
                            className="cm-input-sm"
                            placeholder="Empresa / Proveedor"
                            value={editForm.company}
                            onChange={(e) => setEditForm({ ...editForm, company: e.target.value })}
                          />
                        </div>
                      ) : (
                        <div>
                          <span className="cm-user-name">
                            {c.representativeName || "(Sin nombre registrado)"}
                          </span>
                          {c.company && <span className="cm-user-company">{c.company}</span>}

                          {/* Chips de Evento y Zonas Asignadas */}
                          <div className="cm-assignments-row">
                            {c.eventId && (
                              <span className="cm-badge-event">
                                Evento: {events[c.eventId] || "Evento asignado"}
                              </span>
                            )}
                            {zones.length === 0 && !c.eventId && (
                              <span className="cm-no-zones">Sin zonas asignadas</span>
                            )}
                            {zones.map(([zoneId, z]) => (
                              <span
                                key={zoneId}
                                className="cm-badge-zone"
                                style={{
                                  backgroundColor: `${z.color}15`,
                                  color: z.color,
                                }}
                              >
                                <span className="cm-color-dot" style={{ backgroundColor: z.color }} />
                                {z.zoneName} · {events[z.eventId] || "evento"}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                    </td>

                    {/* Email */}
                    <td>
                      <span className="cm-user-email">{c.email}</span>
                    </td>

                    {/* Acciones */}
                    {canManage && (
                      <td className="cm-actions-cell">
                        {isEditing ? (
                          <div className="cm-actions-wrapper">
                            <button className="cm-btn-save" onClick={() => saveEdit(c.uid)}>
                              <Save size={14} />
                              <span>Guardar</span>
                            </button>
                            <button className="cm-btn-cancel" onClick={() => setEditingUid(null)}>
                              <X size={14} />
                              <span>Cancelar</span>
                            </button>
                          </div>
                        ) : (
                          <div className="cm-actions-wrapper">
                            <button className="cm-btn-action cm-btn-edit" onClick={() => startEdit(c)}>
                              <Edit2 size={14} />
                              <span>Renombrar</span>
                            </button>
                            <button className="cm-btn-action cm-btn-delete" onClick={() => handleDelete(c)}>
                              <Trash2 size={14} />
                              <span>Eliminar</span>
                            </button>
                          </div>
                        )}
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}