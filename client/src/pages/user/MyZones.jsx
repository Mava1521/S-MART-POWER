import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import api from "../../services/api";
import { useAuth } from "../../context/AuthContext";

export default function MyZones() {
  const { profile, refreshProfile } = useAuth();
  const [events, setEvents] = useState({});
  const [invitedEventName, setInvitedEventName] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    (async () => {
      setLoading(true);
      setError("");
      try {
        await refreshProfile(); // por si te acaban de asignar una zona mientras tenías la sesión abierta
        const freshProfile = (await api.get("/auth/profile")).data;
        const zoneEntries = Object.entries(freshProfile?.zoneAssignments || {});

        // Un "user" no puede listar TODOS los eventos, así que pedimos solo los suyos por id.
        const eventIds = [...new Set(zoneEntries.map(([, z]) => z.eventId))];
        const eventResults = await Promise.all(eventIds.map((id) => api.get(`/events/${id}`)));
        const map = {};
        eventResults.forEach((res) => { map[res.data.id] = res.data.name; });
        setEvents(map);

        // El evento con el que te registraste (código de invitación), aunque todavía no
        // tengas ninguna zona asignada dentro de él — así se ve reflejado desde que inicias sesión.
        if (freshProfile?.eventId && !map[freshProfile.eventId]) {
          try {
            const evRes = await api.get(`/events/${freshProfile.eventId}`);
            setInvitedEventName(evRes.data.name);
          } catch {
            setInvitedEventName(null);
          }
        } else if (freshProfile?.eventId) {
          setInvitedEventName(map[freshProfile.eventId]);
        }
      } catch (err) {
        setError("No se pudieron cargar tus zonas. Intenta recargar la página.");
      } finally {
        setLoading(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const zones = Object.entries(profile?.zoneAssignments || {});
  const hasZoneInInvitedEvent = profile?.eventId && zones.some(([, z]) => z.eventId === profile.eventId);

  return (
    <div>
      <h1>Mis zonas</h1>
      <p>Estas son las zonas del plano que tu administrador te asignó. Entra a una para colocar los electrodomésticos y armar tu cronograma.</p>

      {loading && <p>Cargando...</p>}
      {error && <div className="error-message">{error}</div>}

      {!loading && !error && profile?.eventId && (
        <div className="card" style={{ marginBottom: "var(--space-4)", background: "var(--color-surface-raised)" }}>
          <strong>Evento asignado:</strong> {invitedEventName || "Cargando nombre del evento..."}
          {!hasZoneInInvitedEvent && (
            <p style={{ margin: "6px 0 0", fontSize: "0.85rem", color: "var(--color-text-muted)" }}>
              Todavía no tienes una zona asignada dentro de este evento. En cuanto tu productor o administrador te asigne una, aparecerá abajo.
            </p>
          )}
        </div>
      )}

      {!loading && !error && zones.length === 0 && (
        <div className="empty-state">
          <p>Todavía no tienes zonas asignadas. En cuanto tu administrador te asigne una, aparecerá aquí.</p>
        </div>
      )}

      <div className="feature-grid">
        {zones.map(([zoneId, z]) => (
          <Link key={zoneId} to={`/zones/${z.eventId}/${zoneId}`} className="feature-card is-link">
            <div className="feature-card-icon" style={{ background: `${z.color}22`, color: z.color }}>
              <span className="color-dot" style={{ background: z.color }} />
            </div>
            <h3>{z.zoneName}</h3>
            <p style={{ margin: 0 }}>{events[z.eventId] || "Evento"}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}
