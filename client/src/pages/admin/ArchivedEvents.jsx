import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Search, BarChart2, PlusSquare, ImageOff } from "lucide-react";
import api from "../../services/api";
import "../../styles/ArchivedEvents.css";

/**
 * EVENTOS ARCHIVADOS
 * Componente de visualización en tarjetas con simetría y diseño ISO UX/UI.
 */
export default function ArchivedEvents() {
  const [events, setEvents] = useState([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);

  const load = () => {
    setLoading(true);
    api.get("/events", { params: { status: "archived" } })
      .then((res) => setEvents(res.data))
      .finally(() => setLoading(false));
  };

  useEffect(load, []);

  const filtered = events.filter((ev) => 
    ev.name.toLowerCase().includes(search.toLowerCase())
  );

  const handleUnarchive = async (id) => {
    if (!window.confirm("¿Restaurar este evento? Volverá a aparecer en 'Eventos y planos' y podrás modificarlo.")) return;
    await api.patch(`/events/${id}/unarchive`);
    load();
  };

  return (
    <div className="archived-events-container">
      {/* Header y Buscador Superior */}
      <div className="ae-header-bar">
        <div className="ae-header-info">
          <h1 className="ae-title">EVENTOS ARCHIVADOS</h1>
          <div className="ae-title-underline" />
          <p className="ae-subtitle">
            Consulta la distribución de zonas de eventos anteriores, útil si vas a repetir el espacio.
          </p>
        </div>

        <div className="ae-search-container">
          <Search size={16} className="ae-search-icon" />
          <input
            className="ae-search-input"
            placeholder="Buscar el evento por nombre"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      {/* Estados de Carga y Vacío */}
      {loading && (
        <div className="ae-empty-state">
          <p>Cargando eventos archivados...</p>
        </div>
      )}

      {!loading && events.length === 0 && (
        <div className="ae-empty-state">
          <p>Todavía no hay eventos archivados.</p>
        </div>
      )}

      {!loading && events.length > 0 && filtered.length === 0 && (
        <div className="ae-empty-state">
          <p>Ningún evento coincide con "{search}".</p>
        </div>
      )}

      {/* Rejilla de Tarjetas */}
      {!loading && filtered.length > 0 && (
        <div className="ae-grid">
          {filtered.map((ev) => (
            <div className="ae-card" key={ev.id}>
              <div className="ae-card-photo-wrapper">
                {ev.venueImageUrl ? (
                  <img className="ae-card-photo" src={ev.venueImageUrl} alt={ev.name} />
                ) : (
                  <div className="ae-card-placeholder">
                    <ImageOff size={28} />
                    <span>Sin plano</span>
                  </div>
                )}
              </div>

              <div className="ae-card-body">
                <h3 className="ae-event-name">{ev.name}</h3>
                <span className="ae-event-date">
                  Archivado: {ev.archivedAt ? new Date(ev.archivedAt).toLocaleDateString("en-US") : "—"}
                </span>

                <div className="ae-card-footer">
                  <Link to={`/admin/events/${ev.id}/zones`} className="ae-btn-secondary">
                    <BarChart2 size={15} />
                    <span>Ver Distribución</span>
                  </Link>

                  <button className="ae-btn-outline-danger" onClick={() => handleUnarchive(ev.id)}>
                    <PlusSquare size={15} />
                    <span>Desarchivar</span>
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}