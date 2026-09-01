import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import api from "../../services/api";
import BackLink from "../../components/common/BackLink";

const ENTITY_LABEL = { event: "Evento", zone: "Zona", point: "Punto", schedule: "Cronograma", device: "Biblioteca" };
const ACTION_LABEL = { create: "Creó", update: "Modificó", delete: "Eliminó" };
const ACTION_COLOR = { create: "var(--color-success)", update: "var(--color-accent)", delete: "var(--color-danger)" };

function timeAgo(iso) {
  const diffMs = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return "justo ahora";
  if (mins < 60) return `hace ${mins} min`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `hace ${hours} h`;
  return new Date(iso).toLocaleString();
}

/** Historial de cambios de un evento/proyecto: quién hizo qué y cuándo. */
export default function EventAuditLog() {
  const { id: eventId } = useParams();
  const [event, setEvent] = useState(null);
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [entityFilter, setEntityFilter] = useState("");

  useEffect(() => {
    Promise.all([
      api.get(`/events/${eventId}`),
      api.get(`/events/${eventId}/audit-logs`),
    ]).then(([eventRes, logsRes]) => {
      setEvent(eventRes.data);
      setLogs(logsRes.data);
      setLoading(false);
    });
  }, [eventId]);

  const filtered = entityFilter ? logs.filter((l) => l.entityType === entityFilter) : logs;

  if (loading) return <p>Cargando historial...</p>;

  return (
    <div>
      <BackLink to="/admin/events" label="Volver a Eventos y planos" />
      <h1>Historial de cambios — {event?.name}</h1>
      <p>Quién creó, modificó o eliminó algo en este proyecto, y cuándo.</p>

      <div className="card-title-row" style={{ marginBottom: "var(--space-3)" }}>
        <select className="input" style={{ maxWidth: 220 }} value={entityFilter} onChange={(e) => setEntityFilter(e.target.value)}>
          <option value="">Todo</option>
          <option value="event">Evento</option>
          <option value="zone">Zonas</option>
          <option value="point">Puntos</option>
          <option value="schedule">Cronogramas</option>
        </select>
      </div>

      {filtered.length === 0 && <div className="empty-state"><p>Todavía no hay cambios registrados.</p></div>}

      <ul>
        {filtered.map((log) => (
          <li key={log.id} style={{ display: "flex", alignItems: "flex-start", gap: "var(--space-3)", padding: "var(--space-3) 0", borderBottom: "1px solid var(--color-border)" }}>
            <span className="badge" style={{ background: `${ACTION_COLOR[log.action]}22`, color: ACTION_COLOR[log.action], flexShrink: 0 }}>
              {ACTION_LABEL[log.action] || log.action}
            </span>
            <div style={{ flex: 1 }}>
              <p style={{ margin: 0 }}>{log.summary}</p>
              <span style={{ fontSize: "0.78rem", color: "var(--color-text-faint)" }}>
                {ENTITY_LABEL[log.entityType] || log.entityType} · {log.actorEmail || log.actorUid} ({log.actorRole}) · {timeAgo(log.createdAt)}
              </span>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
