import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import api from "../../services/api";
import { useAuth } from "../../context/AuthContext";
import { useToast } from "../../context/ToastContext";
import CreateEventModal from "./CreateEventModal";
import { 
  Search, Plus, Map, Users, History, Calendar, 
  BarChart2, Archive, Lightbulb, UserCheck 
} from "lucide-react";
import "../../styles/EventManager.css";

const todayISO = () => new Date().toISOString().slice(0, 10);

export default function EventManager() {
  const { profile } = useAuth();
  const { showSuccess } = useToast();
  const navigate = useNavigate();
  const isAdmin = profile?.role === "admin";
  
  const [events, setEvents] = useState([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Estados para Modal de Edición de Fechas rápidas
  const [editingDatesId, setEditingDatesId] = useState(null);
  const [editStartDate, setEditStartDate] = useState(todayISO());
  const [editDuration, setEditDuration] = useState(7);
  const [datesError, setDatesError] = useState("");
  const [savingDates, setSavingDates] = useState(false);

  const loadEvents = () => {
    setLoading(true);
    api.get("/events", { params: { status: "active" } })
      .then((res) => setEvents(res.data))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadEvents();
  }, []);

  const handleArchive = async (id) => {
    if (!window.confirm("¿Archivar este evento? Quedará de solo lectura en 'Eventos archivados'.")) return;
    await api.patch(`/events/${id}/archive`);
    loadEvents();
    showSuccess("Evento archivado");
  };

  const openEditDates = (ev) => {
    setEditingDatesId(ev.id);
    setEditStartDate(ev.scheduleStartDate || todayISO());
    setEditDuration(ev.scheduleDurationDays || 7);
    setDatesError("");
  };

  const confirmEditDates = async () => {
    setDatesError("");
    setSavingDates(true);
    try {
      await api.put(`/events/${editingDatesId}/schedule-dates`, {
        scheduleStartDate: editStartDate,
        scheduleDurationDays: editDuration,
      }, { skipGlobalErrorToast: true });
      setEditingDatesId(null);
      loadEvents();
      showSuccess("Fechas actualizadas");
    } catch (err) {
      setDatesError(err.response?.data?.error || "No se pudieron guardar las fechas");
    } finally {
      setSavingDates(false);
    }
  };

  // Filtrar eventos por nombre usando el buscador
  const filteredEvents = events.filter((ev) =>
    ev.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="events-page-container">
      {/* Encabezado Superior */}
      <div className="events-header">
        <div className="events-header-title">
          <h1>EVENTOS</h1>
          <span className="accent-line" />
          <p className="events-subtitle">Eventos Activos</p>
        </div>

        {isAdmin && (
          <button className="btn-primary-orange" onClick={() => setIsModalOpen(true)}>
            <Plus size={18} /> Nuevo Evento
          </button>
        )}
      </div>

      {/* Barra de Búsqueda */}
      <div className="search-container">
        <Search size={20} className="search-icon" />
        <input
          type="text"
          className="search-input"
          placeholder="Buscar artista, show, festival o lugar"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
      </div>

      {/* Grilla de Eventos */}
      {loading ? (
        <p className="loading-text">Cargando eventos...</p>
      ) : filteredEvents.length === 0 ? (
        <div className="empty-state">
          <p>No se encontraron eventos activos.</p>
        </div>
      ) : (
        <div className="events-grid">
          {filteredEvents.map((ev) => (
            <div
              className="event-card event-card-clickable"
              key={ev.id}
              role="button"
              tabIndex={0}
              onClick={() => navigate(`/admin/events/${ev.id}/zones`)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  navigate(`/admin/events/${ev.id}/zones`);
                }
              }}
              aria-label={`Ver zonas de ${ev.name}`}
            >
              {/* Imagen del plano */}
              <div className="event-card-image-wrapper">
                {ev.venueImageUrl ? (
                  <img src={ev.venueImageUrl} alt={ev.name} className="event-card-image" />
                ) : (
                  <div className="event-card-placeholder">Sin plano</div>
                )}
              </div>

              {/* Contenido de la tarjeta */}
              <div className="event-card-content">
                <h3 className="event-card-title">{ev.name}</h3>
                
                <p className="event-card-schedule">
                  <span className="highlight-text">Cronograma:</span> {ev.scheduleStartDate} · {ev.scheduleDurationDays} día(s)
                </p>

                {isAdmin && (
                  <div className="assignment-status">
                    <div className="status-item">
                      <UserCheck size={16} className="status-icon" />
                      <span>
                        {ev.assignedSubadmins?.length > 0
                          ? `${ev.assignedSubadmins.length} sub-admin(s) asignado(s)`
                          : "Sin sub-admins asignados (nadie lo ve todavía)"}
                      </span>
                    </div>
                    <div className="status-item">
                      <Users size={16} className="status-icon" />
                      <span>
                        {ev.assignedProductores?.length > 0
                          ? `${ev.assignedProductores.length} productor(es) asignado(s)`
                          : "Sin productores asignados (nadie lo ve todavía)"}
                      </span>
                    </div>
                  </div>
                )}

                {/* Botones de acción en cuadrícula 3x2. stopPropagation: la tarjeta completa
                    ahora navega a "Zonas" al hacer clic, así que los botones de acción deben
                    frenar la propagación para conservar su propio destino (Equipo, Historial,
                    Fechas, etc.) en vez de que el clic termine siempre en "Zonas". */}
                <div className="card-actions-grid" onClick={(e) => e.stopPropagation()}>
                  <Link to={`/admin/events/${ev.id}/zones`} className="action-btn">
                    <Map size={20} className="action-icon" />
                    <span>Zonas</span>
                  </Link>

                  {(isAdmin || profile?.role === "subadmin") && (
                    <Link to={`/admin/events/${ev.id}/team`} className="action-btn">
                      <Users size={20} className="action-icon" />
                      <span>Equipo</span>
                    </Link>
                  )}

                  <Link to={`/admin/events/${ev.id}/audit-log`} className="action-btn">
                    <History size={20} className="action-icon" />
                    <span>Historial</span>
                  </Link>

                  {isAdmin && (
                    <button className="action-btn" onClick={() => openEditDates(ev)}>
                      <Calendar size={20} className="action-icon" />
                      <span>Fechas</span>
                    </button>
                  )}

                  {isAdmin && (
                    <Link to={`/admin/events/${ev.id}/progress`} className="action-btn">
                      <BarChart2 size={20} className="action-icon" />
                      <span>Avance</span>
                    </Link>
                  )}

                  {isAdmin && (
                    <button className="action-btn" onClick={() => handleArchive(ev.id)}>
                      <Archive size={20} className="action-icon" />
                      <span>Archivar</span>
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Banner Informativo Inferior */}
      <div className="info-banner">
        <div className="info-banner-icon">
          <Lightbulb size={20} />
        </div>
        <p className="info-banner-text">
          Organiza tus eventos, consulta el estado de cada venue y accede rápidamente a la información clave.
        </p>
      </div>

      {/* Modal para Crear Evento */}
      <CreateEventModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onEventCreated={loadEvents}
      />

      {/* Modal Edición de Fechas Rápida */}
      {editingDatesId && (
        <div className="modal-overlay">
          <div className="modal-card small">
            <h3>Fechas del cronograma</h3>
            <p className="subtext">Cambiar esto afecta a todos los usuarios de este evento.</p>
            {datesError && <div className="error-message">{datesError}</div>}
            
            <div className="form-row">
              <div className="form-group flex-1">
                <label className="label">Inicio</label>
                <input
                  className="input-text"
                  type="date"
                  value={editStartDate}
                  onChange={(e) => setEditStartDate(e.target.value)}
                />
              </div>
              <div className="form-group flex-1">
                <label className="label">Duración (días)</label>
                <input
                  className="input-text"
                  type="number"
                  min={1}
                  max={60}
                  value={editDuration}
                  onChange={(e) => setEditDuration(e.target.value)}
                />
              </div>
            </div>

            <div className="modal-actions-row">
              <button className="btn-submit" onClick={confirmEditDates} disabled={savingDates}>
                {savingDates ? "Guardando..." : "Guardar"}
              </button>
              <button className="btn-secondary" onClick={() => setEditingDatesId(null)} disabled={savingDates}>
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}