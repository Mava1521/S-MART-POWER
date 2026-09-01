import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import api from "../../services/api";
import { 
  Search, 
  Building2, 
  Calendar, 
  Clock, 
  CheckCircle, 
  Eye, 
  ArrowRight, 
  CalendarDays 
} from "lucide-react";
import "../../styles/AdminSchedulesOverview.css";

export default function AdminSchedulesOverview() {
  const [rows, setRows] = useState([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const res = await api.get("/schedules-overview");
        setRows(res.data);
      } catch (error) {
        console.error("Error al cargar cronogramas:", error);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const filtered = rows.filter(
    (r) =>
      r.eventName.toLowerCase().includes(search.toLowerCase()) ||
      r.zoneName.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="schedules-page-container">
      {/* Encabezado Principal */}
      <div className="schedules-header">
        <h1>CRONOGRAMAS</h1>
        <span className="accent-line" />
        <p className="schedules-subtitle">
          Administra y consulta los cronogramas de los eventos activos.
        </p>
      </div>

      {/* Buscador de Evento o Zona */}
      <div className="search-container">
        <Search size={20} className="search-icon" />
        <input
          type="text"
          className="search-input"
          placeholder="Buscar por evento o por zona"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {/* Estados de Carga y Vacío */}
      {loading && <p className="loading-text">Cargando cronogramas...</p>}

      {!loading && rows.length === 0 && (
        <div className="empty-state">
          <p>Todavía no hay ningún cronograma enviado.</p>
        </div>
      )}

      {!loading && rows.length > 0 && filtered.length === 0 && (
        <div className="empty-state">
          <p>Nada coincide con "{search}".</p>
        </div>
      )}

      {/* Lista de Tarjetas de Cronograma */}
      {!loading && filtered.length > 0 && (
        <div className="schedules-list">
          {filtered.map((r) => {
            // Determinamos la etiqueta de estado principal según las métricas
            let statusBadge = null;
            if (r.pending > 0) {
              statusBadge = (
                <div className="status-pill status-pending">
                  <Clock size={16} />
                  <div className="status-pill-text">
                    <span className="status-label">Estado</span>
                    <span className="status-value">Por Revisar</span>
                  </div>
                </div>
              );
            } else if (r.approved > 0) {
              statusBadge = (
                <div className="status-pill status-approved">
                  <CheckCircle size={16} />
                  <div className="status-pill-text">
                    <span className="status-label">Estado</span>
                    <span className="status-value">Aprobado</span>
                  </div>
                </div>
              );
            }

            return (
              <div key={`${r.eventId}-${r.zoneId}`} className="schedule-card">
                {/* Lado Izquierdo: Punto de Color de la Zona e Ícono */}
                <div className="schedule-card-left">
                  <span
                    className="zone-color-dot"
                    style={{ backgroundColor: r.zoneColor || "#E5E7EB" }}
                    title="Color de zona"
                  />
                  <div className="zone-icon-avatar">
                    <Building2 size={24} className="building-icon" />
                  </div>
                  <div className="zone-info">
                    <h3 className="zone-title">{r.zoneName}</h3>
                    <p className="event-name">{r.eventName}</p>
                  </div>
                </div>

                {/* Lado Derecho: Píldoras de Info y Botón de Acción */}
                <div className="schedule-card-right">
                  {/* Píldora de cantidad de cronogramas */}
                  <div className="status-pill info-pill">
                    <Calendar size={16} />
                    <div className="status-pill-text">
                      <span className="status-label">Cronograma(s)</span>
                      <span className="status-value">{r.count}</span>
                    </div>
                  </div>

                  {/* Píldora de Estado (Por Revisar / Aprobado) */}
                  {statusBadge}

                  {/* Botón Ver Detalle */}
                  <Link
                    to={`/admin/events/${r.eventId}/zones/${r.zoneId}/schedules`}
                    className="btn-view-detail"
                  >
                    <Eye size={16} />
                    <span>Ver Detalle</span>
                  </Link>

                  {/* Flecha Navegación */}
                  <Link
                    to={`/admin/events/${r.eventId}/zones/${r.zoneId}/schedules`}
                    className="nav-arrow-link"
                    aria-label="Ir a detalle"
                  >
                    <ArrowRight size={20} />
                  </Link>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Banner Informativo Inferior */}
      <div className="info-banner">
        <div className="info-banner-icon">
          <CalendarDays size={22} />
        </div>
        <div className="info-banner-content">
          <h4>Organiza y planifica</h4>
          <p>
            Gestiona los cronogramas de tus eventos. Mantén todo bajo control y accede a la información cuando la necesites.
          </p>
        </div>
      </div>
    </div>
  );
}