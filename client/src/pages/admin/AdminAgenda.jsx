import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import api from "../../services/api";
import { 
  BarChart2, 
  Package, 
  CheckCircle2, 
  ArrowRight, 
  CalendarCheck 
} from "lucide-react";
import "../../styles/AdminAgenda.css";

const ROLE_LABEL = {
  pending: "En revisión",
  approved: "Aprobado",
  changes_requested: "Con correcciones",
};

const formatDateReadable = (iso) => {
  if (!iso) return "";
  const [year, month, day] = iso.split("-");
  const dateObj = new Date(year, month - 1, day);
  const monthNames = [
    "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
    "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"
  ];
  return `${parseInt(day, 10)} ${monthNames[dateObj.getMonth()]} ${year}`;
};

export default function AdminAgenda() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [filterEventId, setFilterEventId] = useState("");
  const [hidePastDone, setHidePastDone] = useState(false);

  useEffect(() => {
    api.get("/schedules-agenda")
      .then((res) => setData(res.data))
      .catch((err) => setError(err.response?.data?.error || "No se pudo cargar la agenda"))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="loading-state">Cargando agenda...</div>;
  if (error) return <div className="error-message">{error}</div>;
  if (!data) return null;

  // Filtrado de días e ítems según selección
  const days = data.days
    .filter((d) => !filterEventId || d.items.some((i) => i.eventId === filterEventId))
    .map((d) => ({
      ...d,
      items: filterEventId ? d.items.filter((i) => i.eventId === filterEventId) : d.items,
    }))
    .filter((d) => !(hidePastDone && d.isPast && d.items.every((i) => i.fullyDelivered)));

  // Separación de entregas en Pendientes vs Completadas para coincidir con la UI
  const pendingItems = [];
  const completedItems = [];

  days.forEach((day) => {
    day.items.forEach((item) => {
      const flatItem = { ...item, date: day.date };
      if (item.fullyDelivered) {
        completedItems.push(flatItem);
      } else {
        pendingItems.push(flatItem);
      }
    });
  });

  return (
    <div className="agenda-page-container">
      {/* Header */}
      <div className="agenda-header">
        <h1>AGENDA DE ENTREGAS</h1>
        <span className="accent-line" />
        <p className="agenda-subtitle">
          Organiza y gestiona las entregas de equipo, materiales y servicios para cada evento.
        </p>
      </div>

      {/* Card de Avance por Evento */}
      {data.events && data.events.length > 0 && (
        <div className="progress-card">
          <div className="progress-card-title">
            <BarChart2 size={18} className="progress-icon" />
            <span>Avance por evento</span>
          </div>
          <div className="progress-items-list">
            {data.events.map((e) => (
              <div key={e.eventId} className="progress-item">
                <Link to={`/admin/events/${e.eventId}/progress`} className="progress-event-name">
                  {e.eventName}
                </Link>
                <div className="progress-bar-container">
                  <div
                    className="progress-bar-fill"
                    style={{ width: `${e.percent}%` }}
                  />
                </div>
                <span className="progress-percent">{e.percent}%</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Controles y Filtros */}
      <div className="agenda-filters-row">
        <select
          className="filter-select"
          value={filterEventId}
          onChange={(e) => setFilterEventId(e.target.value)}
        >
          <option value="">Todos los eventos</option>
          {data.events.map((e) => (
            <option key={e.eventId} value={e.eventId}>
              {e.eventName}
            </option>
          ))}
        </select>

        <label className="filter-checkbox-label">
          <input
            type="checkbox"
            checked={hidePastDone}
            onChange={(e) => setHidePastDone(e.target.checked)}
          />
          <span>Ocultar días pasados ya entregados</span>
        </label>
      </div>

      {/* Envoltorio principal de Tareas */}
      <div className="tasks-outer-card">
        {/* Tareas Pendientes */}
        <div className="tasks-section">
          <h3 className="section-title">Tareas pendientes</h3>
          {pendingItems.length === 0 ? (
            <p className="empty-text">No hay tareas pendientes.</p>
          ) : (
            pendingItems.map((item, idx) => (
              <div key={`pending-${idx}`} className="task-item-card">
                <div className="task-info">
                  <div className="task-title-row">
                    <strong className="task-zone-name">{item.zoneName}</strong>
                    <span className="task-event-name"> - {item.eventName}</span>
                    <span className="task-date"> - Fecha: {formatDateReadable(item.date)}</span>
                  </div>
                  <div className="task-subtext">
                    <Package size={14} className="subtext-icon" />
                    <span>{item.devices?.length || 1} entrega(s) programada(s)</span>
                  </div>
                </div>

                <div className="task-actions">
                  <span className="status-badge-grey">
                    {ROLE_LABEL[item.reviewStatus] || item.reviewStatus || "En revisión"}
                  </span>
                  <Link
                    to={`/admin/events/${item.eventId}/zones/${item.zoneId}/schedules`}
                    className="btn-ver-cronograma"
                  >
                    <span>Ver Cronograma</span>
                    <ArrowRight size={16} />
                  </Link>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Tareas Completadas */}
        <div className="tasks-section" style={{ marginTop: 28 }}>
          <h3 className="section-title completed-title">Tareas completadas</h3>
          {completedItems.length === 0 ? (
            <p className="empty-text">No hay tareas completadas aún.</p>
          ) : (
            completedItems.map((item, idx) => (
              <div key={`completed-${idx}`} className="task-item-card completed-card">
                <div className="task-info flex-row-align">
                  <CheckCircle2 size={22} className="check-icon-green" />
                  <div>
                    <div className="task-title-row">
                      <strong className="task-zone-name">{item.zoneName}</strong>
                      <span className="task-event-name"> - {item.eventName}</span>
                      <span className="task-date"> - Fecha: {formatDateReadable(item.date)}</span>
                    </div>
                    <div className="task-subtext">
                      <Package size={14} className="subtext-icon" />
                      <span>{item.devices?.length || 1} entrega(s) programada(s)</span>
                    </div>
                  </div>
                </div>

                <div className="task-actions">
                  <span className="status-badge-grey">
                    {ROLE_LABEL[item.reviewStatus] || item.reviewStatus || "En revisión"}
                  </span>
                  <Link
                    to={`/admin/events/${item.eventId}/zones/${item.zoneId}/schedules`}
                    className="btn-ver-cronograma"
                  >
                    <span>Ver Cronograma</span>
                    <ArrowRight size={16} />
                  </Link>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Banner Informativo Inferior */}
      <div className="info-banner">
        <div className="info-banner-icon">
          <CalendarCheck size={22} />
        </div>
        <div className="info-banner-content">
          <h4>Mantén todo al día</h4>
          <p>
            Revisa y actualiza las entregas de cada evento para asegurar que todo esté listo a tiempo.
          </p>
        </div>
      </div>
    </div>
  );
}