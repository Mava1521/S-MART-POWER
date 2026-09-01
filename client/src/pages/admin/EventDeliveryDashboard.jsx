import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import api from "../../services/api";
import BackLink from "../../components/common/BackLink";

const formatDate = (iso) => iso ? new Date(iso + "T00:00:00").toLocaleDateString(undefined, { day: "2-digit", month: "short" }) : "—";

/**
 * SOLO admin: % real de avance de entregas por zona y del evento completo.
 * Las zonas se muestran ordenadas de la entrega pendiente más próxima a la más lejana.
 */
export default function EventDeliveryDashboard() {
  const { id: eventId } = useParams();
  const [event, setEvent] = useState(null);
  const [data, setData] = useState({ eventPercent: 0, zones: [] });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      api.get(`/events/${eventId}`),
      api.get(`/events/${eventId}/delivery-summary`),
    ]).then(([eventRes, summaryRes]) => {
      setEvent(eventRes.data);
      setData(summaryRes.data);
      setLoading(false);
    });
  }, [eventId]);

  if (loading) return <p>Cargando avance...</p>;

  return (
    <div>
      <BackLink to="/admin/events" label="Volver a Eventos y planos" />
      <h1>Avance de entregas — {event?.name}</h1>
      <p>Este porcentaje solo lo puedes ver tú. Se calcula sobre las entregas reales confirmadas, no sobre lo programado.</p>

      <div className="card">
        <div className="card-title-row"><h2>Avance del evento completo</h2></div>
        <div style={{ display: "flex", alignItems: "center", gap: "var(--space-4)" }}>
          <div style={{ fontSize: "2.2rem", fontFamily: "var(--font-display)", fontWeight: 700, color: "var(--color-accent)" }}>
            {data.eventPercent}%
          </div>
          <div style={{ flex: 1, height: 10, background: "var(--color-bg)", borderRadius: 6, overflow: "hidden" }}>
            <div style={{ height: "100%", width: `${data.eventPercent}%`, background: "var(--color-accent)" }} />
          </div>
        </div>
      </div>

      <div className="card" style={{ marginTop: "var(--space-5)" }}>
        <div className="card-title-row"><h2>Avance por zona</h2></div>
        <p style={{ fontSize: "0.8rem" }}>Ordenadas de la entrega pendiente más próxima a la más lejana.</p>

        {data.zones.length === 0 && <div className="empty-state"><p>Todavía no hay cronogramas con puntos colocados en este evento.</p></div>}

        <ul>
          {data.zones.map((z) => (
            <li key={z.zoneId} style={{ padding: "var(--space-3) 0", borderBottom: "1px solid var(--color-border)" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "var(--space-3)" }}>
                <span className="color-dot" style={{ background: z.zoneColor }} />
                <strong style={{ flex: 1 }}>{z.zoneName}</strong>
                <span style={{ fontSize: "0.8rem", color: "var(--color-text-muted)" }}>
                  Próxima entrega: {formatDate(z.nearestPendingDate)}
                </span>
                <span className="mono" style={{ fontWeight: 700 }}>{z.percent}%</span>
                <Link to={`/admin/events/${eventId}/zones/${z.zoneId}/schedules`} className="btn btn-secondary btn-sm">Ver</Link>
              </div>
              <div style={{ height: 6, background: "var(--color-bg)", borderRadius: 4, overflow: "hidden", marginTop: 6 }}>
                <div style={{ height: "100%", width: `${z.percent}%`, background: z.zoneColor }} />
              </div>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
