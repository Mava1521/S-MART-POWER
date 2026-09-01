import { useEffect, useRef, useState } from "react";
import { useParams, Link } from "react-router-dom";
import api from "../../services/api";
import { useAuth } from "../../context/AuthContext";
import { useToast } from "../../context/ToastContext";
import BackLink from "../../components/common/BackLink";

const PRESET_COLORS = ["#FFB020", "#4CAF7D", "#5B8DEF", "#E5484D", "#B968E8", "#4FC3E8"];

// Radio del punto y grosor de la línea que los une, en unidades del viewBox (0-100) a zoom 1x.
// El grosor de línea va acorde al tamaño de punto elegido, para que ambos se vean proporcionados.
const VERTEX_STYLE = {
  small: { radius: 0.35, stroke: 0.15 },
  medium: { radius: 0.8, stroke: 0.4 },
  large: { radius: 1.3, stroke: 0.65 },
};

/** Modal simple para duplicar/trasladar una zona (con sus puntos y electrodomésticos) a otro evento. */
function DuplicateZoneModal({ eventId, zone, allEvents, onClose, onDone }) {
  const [targetEventId, setTargetEventId] = useState(eventId);
  const [newName, setNewName] = useState(`${zone.name} (copia)`);
  const [targetEvent, setTargetEvent] = useState(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState(null);
  const [zoom, setZoom] = useState(1);
  const svgRef = useRef(null);
  const scrollRef = useRef(null);

  useEffect(() => {
    api.get(`/events/${targetEventId}`).then((res) => setTargetEvent(res.data));
  }, [targetEventId]);

  const zoomIn = () => setZoom((z) => Math.min(8, +(z + 0.5).toFixed(1)));
  const zoomOut = () => setZoom((z) => Math.max(1, +(z - 0.5).toFixed(1)));

  const handleClick = async (e) => {
    if (saving || result) return;
    // El % (x,y) se calcula sobre el tamaño real del SVG, así que da igual el nivel
    // de zoom: el punto marcado siempre corresponde al lugar exacto del plano.
    const rect = svgRef.current.getBoundingClientRect();
    const x = Math.round((((e.clientX - rect.left) / rect.width) * 100) * 10) / 10;
    const y = Math.round((((e.clientY - rect.top) / rect.height) * 100) * 10) / 10;

    setSaving(true);
    setError("");
    try {
      const res = await api.post(`/events/${eventId}/zones/${zone.id}/duplicate`, { targetEventId, x, y, name: newName });
      setResult(res.data);
    } catch (err) {
      setError(err.response?.data?.error || "No se pudo duplicar la zona");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 90, background: "rgba(0,0,0,0.6)", display: "flex", alignItems: "center", justifyContent: "center", padding: "var(--space-4)" }}>
      <div className="card" style={{ maxWidth: 560, width: "100%", maxHeight: "85vh", overflowY: "auto" }}>
        <h2>Duplicar "{zone.name}"</h2>

        {result ? (
          <>
            <p>Se creó la zona con {result.copiedPoints} punto(s) y {result.copiedDevices} electrodoméstico(s). Los puntos quedaron "abiertos" para que se vuelvan a verificar en el nuevo lugar.</p>
            <button className="btn btn-primary" onClick={onDone}>Listo</button>
          </>
        ) : (
          <>
            <p>Elige a qué evento la llevas, y luego toca el plano para marcar dónde va la copia.</p>
            {error && <div className="error-message">{error}</div>}
            <div className="form-group">
              <label className="label">Nombre de la nueva zona</label>
              <input className="input" value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Nombre de la zona duplicada" />
            </div>
            <div className="form-group">
              <label className="label">Evento destino</label>
              <select className="input" value={targetEventId} onChange={(e) => setTargetEventId(e.target.value)}>
                {allEvents.map((ev) => (
                  <option key={ev.id} value={ev.id}>{ev.name}{ev.status === "archived" ? " (archivado)" : ""}</option>
                ))}
              </select>
            </div>

            <div style={{ display: "flex", gap: 6, justifyContent: "flex-end", marginBottom: 6 }}>
              <button type="button" className="btn btn-secondary btn-sm" onClick={zoomOut} disabled={zoom <= 1} aria-label="Alejar">−</button>
              <span className="mono" style={{ minWidth: 40, textAlign: "center" }}>{zoom}x</span>
              <button type="button" className="btn btn-secondary btn-sm" onClick={zoomIn} disabled={zoom >= 8} aria-label="Acercar">+</button>
            </div>
            <div ref={scrollRef} style={{ overflow: "auto", maxHeight: 420, borderRadius: "var(--radius-md)", border: "1px solid var(--color-border)" }}>
              <div style={{ position: "relative", width: `${zoom * 100}%` }}>
                {targetEvent?.venueImageUrl
                  ? <img src={targetEvent.venueImageUrl} alt="Plano destino" style={{ width: "100%", display: "block" }} />
                  : <div className="empty-state">Este evento no tiene plano cargado.</div>}
                <svg
                  ref={svgRef}
                  viewBox="0 0 100 100"
                  preserveAspectRatio="none"
                  onClick={handleClick}
                  style={{ position: "absolute", inset: 0, width: "100%", height: "100%", cursor: "crosshair" }}
                />
              </div>
            </div>
            <p style={{ fontSize: "0.8rem", color: "var(--color-text-muted)", marginTop: 4 }}>Usa +/− para acercarte y marcar el punto exacto sobre el plano.</p>
            <div style={{ marginTop: "var(--space-3)" }}>
              <button className="btn btn-secondary" onClick={onClose} disabled={saving}>Cancelar</button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

/**
 * Editor de zonas sobre el plano del evento, con zoom (para planos grandes) y opción
 * de duplicar una zona completa (con sus puntos y electrodomésticos) a otro lugar.
 */
export default function EventZones() {
  const { id: eventId } = useParams();
  const { profile } = useAuth();
  const { showSuccess } = useToast();
  // El sub-admin tiene las mismas herramientas de gestión de zonas que el admin (dentro de
  // sus eventos asignados). Solo lo "oculto" (consumo eléctrico, gestión de sub-admins) sigue
  // siendo exclusivo del admin.
  const canDrawZones = ["admin", "subadmin"].includes(profile?.role);
  const svgRef = useRef(null);
  const scrollContainerRef = useRef(null);
  const contentRef = useRef(null);

  const [event, setEvent] = useState(null);
  const [zones, setZones] = useState([]);
  const [users, setUsers] = useState([]);
  const [allEvents, setAllEvents] = useState([]);
  const [assignments, setAssignments] = useState({});
  const [loading, setLoading] = useState(true);
  const [zoneSearch, setZoneSearch] = useState("");
  const [zoom, setZoom] = useState(1);
  const [vertexSize, setVertexSize] = useState("medium"); // "small" | "medium" | "large" — para zonas diminutas o normales

  const [zoneName, setZoneName] = useState("");
  const [zoneColor, setZoneColor] = useState(PRESET_COLORS[0]);
  const [drawing, setDrawing] = useState(false);
  const [points, setPoints] = useState([]);
  const [error, setError] = useState("");

  const [assigningZoneId, setAssigningZoneId] = useState(null);
  const [selectedUserIds, setSelectedUserIds] = useState([]);
  const [duplicatingZone, setDuplicatingZone] = useState(null);

  const loadAll = async () => {
    setLoading(true);
    setError("");
    try {
      const [eventRes, zonesRes, usersRes, activeEventsRes, archivedEventsRes] = await Promise.all([
        api.get(`/events/${eventId}`),
        api.get(`/events/${eventId}/zones`),
        api.get("/auth/users", { params: { role: "user" } }),
        api.get("/events", { params: { status: "active" } }),
        api.get("/events", { params: { status: "archived" } }).catch(() => ({ data: [] })),
      ]);
      setEvent(eventRes.data);
      setZones(zonesRes.data);
      setUsers(usersRes.data);
      // Incluye eventos archivados como posible destino: si el evento actual está archivado
      // (o quieres duplicar hacia uno archivado), debe seguir apareciendo en el selector.
      setAllEvents([...activeEventsRes.data, ...archivedEventsRes.data]);

      const assignmentEntries = await Promise.all(
        zonesRes.data.map((z) =>
          api.get(`/events/${eventId}/zones/${z.id}/assignments`).then((res) => [z.id, res.data])
        )
      );
      setAssignments(Object.fromEntries(assignmentEntries));
    } catch (err) {
      if (err.response?.status === 403) {
        setError("No tienes este evento asignado, así que no puedes ver sus zonas. Pídele a un admin que te lo asigne desde Eventos.");
      } else {
        setError(err.response?.data?.error || "No se pudieron cargar las zonas. Intenta de nuevo.");
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadAll(); }, [eventId]);

  const centerOnPlan = () => {
    const container = scrollContainerRef.current;
    const content = contentRef.current;
    if (!container || !content) return;
    container.scrollTo({
      left: (content.scrollWidth - container.clientWidth) / 2,
      top: (content.scrollHeight - container.clientHeight) / 2,
      behavior: "smooth",
    });
  };

  useEffect(() => {
    const t = setTimeout(centerOnPlan, 200);
    return () => clearTimeout(t);
  }, [zoom]);

  const zoomIn = () => setZoom((z) => Math.min(8, +(z + 0.5).toFixed(1)));
  const zoomOut = () => setZoom((z) => Math.max(1, +(z - 0.5).toFixed(1)));

  const startDrawing = () => {
    if (!zoneName.trim()) { setError("Ponle un nombre a la zona antes de dibujarla"); return; }
    setError("");
    setDrawing(true);
    setPoints([]);
  };

  const handleSvgClick = (e) => {
    if (!drawing) return;
    const rect = svgRef.current.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;
    setPoints((prev) => [...prev, { x: Math.round(x * 10) / 10, y: Math.round(y * 10) / 10 }]);
  };

  const undoPoint = () => setPoints((prev) => prev.slice(0, -1));
  const cancelDrawing = () => { setDrawing(false); setPoints([]); };

  const saveZone = async () => {
    if (points.length < 3) { setError("Marca al menos 3 puntos para formar la zona"); return; }
    setError("");
    try {
      await api.post(`/events/${eventId}/zones`, { name: zoneName, color: zoneColor, coordinates: points }, { skipGlobalErrorToast: true });
      setZoneName(""); setDrawing(false); setPoints([]);
      setZoom(1); // volvemos a 1x: quien vea la zona después no hereda tu nivel de acercamiento
      loadAll();
      showSuccess("Zona guardada");
    } catch (err) {
      setError(err.response?.data?.error || "No se pudo guardar la zona");
    }
  };

  const openAssign = (zone) => {
    setAssigningZoneId(zone.id);
    setSelectedUserIds((assignments[zone.id] || []).map((a) => a.uid));
  };

  const toggleUser = (uid) => {
    setSelectedUserIds((prev) => prev.includes(uid) ? prev.filter((u) => u !== uid) : [...prev, uid]);
  };

  const confirmAssign = async () => {
    await api.post(`/events/${eventId}/zones/${assigningZoneId}/assign`, { userIds: selectedUserIds });
    setAssigningZoneId(null);
    loadAll();
    showSuccess("Asignación guardada");
  };

  const deleteZone = async (zone) => {
    if (!window.confirm(`¿Eliminar la zona "${zone.name}"? Se borrarán también sus puntos, electrodomésticos colocados y cronogramas asociados. Esta acción no se puede deshacer.`)) return;
    try {
      setError("");
      await api.delete(`/events/${eventId}/zones/${zone.id}`, { skipGlobalErrorToast: true });
      loadAll();
      showSuccess("Zona eliminada");
    } catch (err) {
      if (err.response?.status === 409 && err.response.data?.requiresForce) {
        if (window.confirm(`${err.response.data.error}\n\n¿Eliminar de todas formas?`)) {
          try {
            await api.delete(`/events/${eventId}/zones/${zone.id}?force=true`, { skipGlobalErrorToast: true });
            loadAll();
            showSuccess("Zona eliminada");
          } catch (err2) {
            setError(err2.response?.data?.error || "No se pudo eliminar la zona");
          }
        }
        return;
      }
      setError(err.response?.data?.error || "No se pudo eliminar la zona");
    }
  };

  const polygonPoints = (coords) => coords.map((p) => `${p.x},${p.y}`).join(" ");
  const filteredZones = zones.filter((z) => z.name.toLowerCase().includes(zoneSearch.toLowerCase()));

  if (loading) return <p>Cargando plano...</p>;

  if (error && !event) {
    return (
      <div>
        <BackLink to="/admin/events" label="Volver a Eventos y planos" />
        <div className="error-message" style={{ marginTop: "var(--space-3)" }}>{error}</div>
      </div>
    );
  }

  return (
    <div>
      <BackLink to="/admin/events" label="Volver a Eventos y planos" />
      <h1>Zonas — {event?.name}</h1>
      <p>Haz clic sobre el plano para ir marcando los vértices de cada zona. Usa el zoom si el plano es grande.</p>

      {error && <div className="error-message">{error}</div>}

      <div className="card">
        {canDrawZones && (
        <div className="card-title-row">
          <div className="form-group" style={{ margin: 0, flex: 1, minWidth: 180 }}>
            <label className="label">Nombre de la zona</label>
            <input className="input" value={zoneName} onChange={(e) => setZoneName(e.target.value)} disabled={drawing} placeholder="Ej. Grada Norte" />
          </div>
          <div className="form-group" style={{ margin: 0 }}>
            <label className="label">Color</label>
            <div style={{ display: "flex", gap: 6 }}>
              {PRESET_COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setZoneColor(c)}
                  aria-label={`Color ${c}`}
                  style={{
                    width: 26, height: 26, borderRadius: "50%", background: c, cursor: "pointer",
                    border: zoneColor === c ? "2px solid var(--color-text)" : "1px solid rgba(255,255,255,0.25)",
                  }}
                  disabled={drawing}
                />
              ))}
            </div>
          </div>

          {!drawing && <button className="btn btn-primary" onClick={startDrawing}>Iniciar zona</button>}
          {drawing && (
            <>
              <button className="btn btn-secondary" onClick={undoPoint} disabled={points.length === 0}>Deshacer punto</button>
              <button className="btn btn-primary" onClick={saveZone}>Guardar zona ({points.length} puntos)</button>
              <button className="btn btn-danger" onClick={cancelDrawing}>Cancelar</button>
            </>
          )}

          <div style={{ display: "flex", gap: 6, marginLeft: "auto", alignItems: "center" }}>
            <div style={{ display: "flex", gap: 2 }}>
              {[["small", "Pequeños"], ["medium", "Medianos"], ["large", "Grandes"]].map(([val, label]) => (
                <button
                  key={val}
                  className={`btn btn-sm ${vertexSize === val ? "btn-primary" : "btn-secondary"}`}
                  onClick={() => setVertexSize(val)}
                  title="Útil para marcar zonas muy pequeñas con precisión"
                >
                  {label}
                </button>
              ))}
            </div>
            <button className="btn btn-secondary btn-sm" onClick={zoomOut} disabled={zoom <= 1} aria-label="Alejar">−</button>
            <span className="mono" style={{ minWidth: 40, textAlign: "center" }}>{zoom}x</span>
            <button className="btn btn-secondary btn-sm" onClick={zoomIn} disabled={zoom >= 8} aria-label="Acercar">+</button>
          </div>
        </div>
        )}

        <div ref={scrollContainerRef} style={{ overflow: "auto", maxHeight: 560, border: "1px solid var(--color-border)", borderRadius: "var(--radius-md)" }}>
          <div ref={contentRef} style={{ position: "relative", width: `${zoom * 100}%`, transition: "width 0.15s ease" }}>
            {event?.venueImageUrl
              ? <img src={event.venueImageUrl} alt="Plano del evento" style={{ width: "100%", display: "block" }} />
              : <div className="empty-state">Este evento no tiene plano cargado.</div>}

            <svg
              ref={svgRef}
              viewBox="0 0 100 100"
              preserveAspectRatio="none"
              onClick={handleSvgClick}
              style={{ position: "absolute", inset: 0, width: "100%", height: "100%", cursor: drawing ? "crosshair" : "default" }}
            >
              {zones.map((z) => (
                <polygon key={z.id} points={polygonPoints(z.coordinates)} fill={z.color} fillOpacity="0.35" stroke={z.color} strokeWidth="0.4" />
              ))}
              {drawing && points.length > 0 && (
                <polygon
                  points={polygonPoints(points)}
                  fill={zoneColor} fillOpacity="0.25" stroke={zoneColor}
                  strokeWidth={VERTEX_STYLE[vertexSize].stroke / zoom}
                  strokeDasharray={`${1 / zoom},${1 / zoom}`}
                />
              )}
              {drawing && points.map((p, i) => (
                <circle key={i} cx={p.x} cy={p.y} r={VERTEX_STYLE[vertexSize].radius / zoom} fill={zoneColor} />
              ))}
            </svg>
          </div>
        </div>
      </div>

      <div className="card" style={{ marginTop: "var(--space-5)" }}>
        <div className="card-title-row">
          <h2>Zonas de este evento</h2>
          <input
            className="input"
            style={{ maxWidth: 260 }}
            placeholder="Buscar zona por nombre"
            value={zoneSearch}
            onChange={(e) => setZoneSearch(e.target.value)}
          />
        </div>

        {zones.length === 0 && <div className="empty-state"><p>Aún no has dibujado ninguna zona.</p></div>}
        {zones.length > 0 && filteredZones.length === 0 && <div className="empty-state"><p>Ninguna zona coincide con "{zoneSearch}".</p></div>}

        <ul>
          {filteredZones.map((z) => {
            const assigned = assignments[z.id] || [];
            return (
              <li key={z.id} style={{ padding: "var(--space-3) 0", borderBottom: "1px solid var(--color-border)" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "var(--space-3)", flexWrap: "wrap" }}>
                  <span className="color-dot" style={{ background: z.color }} />
                  <strong style={{ flex: 1 }}>{z.name}</strong>
                  <button className="btn btn-secondary btn-sm" onClick={() => openAssign(z)}>
                    {assigned.length > 0 ? "Reasignar" : "Asignar usuarios"}
                  </button>
                  <Link to={`/admin/events/${eventId}/zones/${z.id}/schedules`} className="btn btn-secondary btn-sm">Cronogramas</Link>
                  {canDrawZones && <button className="btn btn-secondary btn-sm" onClick={() => setDuplicatingZone(z)}>Duplicar</button>}
                  {canDrawZones && <button className="btn btn-danger btn-sm" onClick={() => deleteZone(z)}>Eliminar</button>}
                </div>
                <div style={{ marginTop: "var(--space-1)", fontSize: "0.8rem", color: "var(--color-text-muted)" }}>
                  {assigned.length === 0
                    ? "Sin asignar"
                    : `Asignada a: ${assigned.map((a) => a.name || a.email).join(", ")}`}
                </div>
              </li>
            );
          })}
        </ul>

        {assigningZoneId && (
          <div className="card" style={{ marginTop: "var(--space-4)", background: "var(--color-surface-raised)" }}>
            <h3>Asignar zona a</h3>
            {users.length === 0 && <p>No hay usuarios registrados todavía.</p>}
            {users.map((u) => (
              <label key={u.uid} style={{ display: "flex", alignItems: "center", gap: "var(--space-2)", marginBottom: "var(--space-2)" }}>
                <input type="checkbox" checked={selectedUserIds.includes(u.uid)} onChange={() => toggleUser(u.uid)} />
                {u.name ? `${u.name} — ${u.email}` : u.email}
              </label>
            ))}
            <div style={{ display: "flex", gap: "var(--space-2)", marginTop: "var(--space-3)" }}>
              <button className="btn btn-primary btn-sm" onClick={confirmAssign}>Confirmar asignación</button>
              <button className="btn btn-secondary btn-sm" onClick={() => setAssigningZoneId(null)}>Cancelar</button>
            </div>
          </div>
        )}
      </div>

      {duplicatingZone && (
        <DuplicateZoneModal
          eventId={eventId}
          zone={duplicatingZone}
          allEvents={allEvents}
          onClose={() => setDuplicatingZone(null)}
          onDone={() => { setDuplicatingZone(null); loadAll(); }}
        />
      )}
    </div>
  );
}
