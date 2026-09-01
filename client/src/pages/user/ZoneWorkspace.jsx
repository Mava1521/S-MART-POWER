import { useEffect, useMemo, useRef, useState } from "react";
import { useParams, Link } from "react-router-dom";
import api from "../../services/api";
import { useAuth } from "../../context/AuthContext";
import GuidedTour from "../../components/common/GuidedTour";
import BackLink from "../../components/common/BackLink";
import PointWizardModal from "../../components/common/PointWizardModal";

/** Ray casting: ¿el punto cae dentro del polígono? Misma regla que valida el backend (el backend manda). */
function isPointInPolygon(x, y, coords) {
  let inside = false;
  for (let i = 0, j = coords.length - 1; i < coords.length; j = i++) {
    const xi = coords[i].x, yi = coords[i].y;
    const xj = coords[j].x, yj = coords[j].y;
    const intersects = yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi;
    if (intersects) inside = !inside;
  }
  return inside;
}

// Radio base (en unidades del viewBox 0-100) para cada tamaño, medido a zoom 1x.
const POINT_BASE_RADIUS = { small: 0.9, medium: 1.4, large: 2.1 };

const TOUR_STEPS = [
  { title: "Bienvenido a tu zona", description: "Esta es tu zona de trabajo. La parte clara del plano es tu zona asignada; el resto aparece oscurecido porque no te corresponde a ti." },
  { title: "Toca el plano para crear un punto", description: "Un 'punto' es cada lugar donde tienes una activación (ej. una caseta o stand). Toca cualquier lugar dentro del área clara para crear uno nuevo y ponerle nombre." },
  { title: "Agrega tus equipos", description: "Busca cada electrodoméstico y ajusta la cantidad con + y −. No necesitas escribir datos eléctricos, solo cuántos tienes de cada uno." },
  { title: "Puntos de colores", description: "Azul = un punto abierto (tuyo o de otro productor, todavía se puede editar). Verde = un punto ya cerrado y verificado. Puedes tocar cualquiera para verlo." },
  { title: "Zoom y centrado", description: "El botón + acerca la imagen. Si te pierdes, 'Centrar en mi zona' te regresa al lugar correcto." },
  { title: "Cuando termines", description: "Usa el botón 'Ir al cronograma' para programar en qué días entregas cada electrodoméstico." },
];

export default function ZoneWorkspace() {
  const { eventId, zoneId } = useParams();
  const { profile } = useAuth();
  const svgRef = useRef(null);
  const scrollContainerRef = useRef(null);
  const contentRef = useRef(null);

  const [event, setEvent] = useState(null);
  const [zone, setZone] = useState(null);
  const [devices, setDevices] = useState([]);
  const [points, setPoints] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [zoom, setZoom] = useState(1);

  const [wizard, setWizard] = useState(null); // { existingPoint?, coords? }

  const load = async () => {
    setLoading(true);
    const [detailRes, devicesRes, pointsRes] = await Promise.all([
      api.get(`/events/${eventId}/zones/${zoneId}`),
      api.get("/devices"),
      api.get(`/events/${eventId}/zones/${zoneId}/points`),
    ]);
    setEvent(detailRes.data.event);
    setZone(detailRes.data.zone);
    setDevices(devicesRes.data);
    setPoints(pointsRes.data);
    setLoading(false);
  };

  useEffect(() => { load(); }, [eventId, zoneId]);

  const centroid = useMemo(() => {
    if (!zone) return null;
    const n = zone.coordinates.length;
    return {
      x: zone.coordinates.reduce((s, p) => s + p.x, 0) / n,
      y: zone.coordinates.reduce((s, p) => s + p.y, 0) / n,
    };
  }, [zone]);

  const centerOnZone = () => {
    const container = scrollContainerRef.current;
    const content = contentRef.current;
    if (!container || !content || !centroid) return;
    const targetLeft = (centroid.x / 100) * content.scrollWidth - container.clientWidth / 2;
    const targetTop = (centroid.y / 100) * content.scrollHeight - container.clientHeight / 2;
    container.scrollTo({ left: Math.max(0, targetLeft), top: Math.max(0, targetTop), behavior: "smooth" });
  };

  useEffect(() => {
    const t = setTimeout(centerOnZone, 200);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [zoom, zone]);

  const zoomIn = () => setZoom((z) => Math.min(8, +(z + 0.5).toFixed(1)));
  const zoomOut = () => setZoom((z) => Math.max(1, +(z - 0.5).toFixed(1)));

  const handleMapClick = (e) => {
    if (wizard) return;
    const rect = svgRef.current.getBoundingClientRect();
    const x = Math.round((((e.clientX - rect.left) / rect.width) * 100) * 10) / 10;
    const y = Math.round((((e.clientY - rect.top) / rect.height) * 100) * 10) / 10;

    if (!isPointInPolygon(x, y, zone.coordinates)) {
      setError("Ese lugar queda fuera de tu zona. Toca dentro del área clara.");
      return;
    }
    setError("");
    setWizard({ coords: { x, y } });
  };

  const openExistingPoint = (point, ev) => {
    ev.stopPropagation();
    setWizard({ existingPoint: point });
  };

  const closeWizard = () => setWizard(null);
  const handleWizardSaved = () => { setWizard(null); load(); };

  // Path con "agujero": oscurece todo el plano excepto el interior de la zona (fill-rule evenodd)
  const maskPathD = zone
    ? `M0,0 H100 V100 H0 Z M${zone.coordinates.map((p) => `${p.x},${p.y}`).join(" L")} Z`
    : "";

  if (loading) return <p>Cargando zona...</p>;

  return (
    <div>
      {profile?.uid && (
        <GuidedTour steps={TOUR_STEPS} storageKey={`tour_zone_workspace_v2_${profile.uid}`} />
      )}

      <BackLink to="/my-zones" label="Volver a Mis zonas" />
      <h1>{zone?.name}</h1>
      <p>{event?.name} — toca dentro del área clara para crear un punto, o toca uno ya existente para verlo o seguir agregándole equipos.</p>

      {error && <div className="error-message">{error}</div>}

      <div className="card">
        <div className="card-title-row" style={{ justifyContent: "flex-end" }}>
          <button className="btn btn-secondary btn-sm" onClick={zoomOut} disabled={zoom <= 1} aria-label="Alejar">−</button>
          <span className="mono" style={{ minWidth: 40, textAlign: "center" }}>{zoom}x</span>
          <button className="btn btn-secondary btn-sm" onClick={zoomIn} disabled={zoom >= 8} aria-label="Acercar">+</button>
          <button className="btn btn-secondary btn-sm" onClick={centerOnZone}>Centrar en mi zona</button>
        </div>

        <div ref={scrollContainerRef} style={{ overflow: "auto", maxHeight: 560, border: "1px solid var(--color-border)", borderRadius: "var(--radius-md)" }}>
          <div ref={contentRef} style={{ position: "relative", width: `${zoom * 100}%`, transition: "width 0.15s ease" }}>
            {event?.venueImageUrl
              ? <img src={event.venueImageUrl} alt="Plano" style={{ width: "100%", display: "block" }} onLoad={centerOnZone} />
              : <div className="empty-state">Este evento no tiene plano cargado.</div>}

            <svg
              ref={svgRef}
              viewBox="0 0 100 100"
              preserveAspectRatio="none"
              onClick={handleMapClick}
              style={{ position: "absolute", inset: 0, width: "100%", height: "100%", cursor: "crosshair" }}
            >
              {zone && <path d={maskPathD} fillRule="evenodd" fill="#000000" fillOpacity="0.55" />}
              {zone && (
                <polygon points={zone.coordinates.map((p) => `${p.x},${p.y}`).join(" ")} fill="none" stroke={zone.color} strokeWidth="0.5" />
              )}
              {points.map((p) => (
                <circle
                  key={p.id}
                  cx={p.x} cy={p.y}
                  r={(POINT_BASE_RADIUS[p.size] || POINT_BASE_RADIUS.medium) / zoom}
                  fill={p.status === "closed" ? "var(--color-success)" : "var(--color-accent)"}
                  stroke="#14161a" strokeWidth={0.25 / zoom}
                  onClick={(e) => openExistingPoint(p, e)}
                  style={{ cursor: "pointer" }}
                />
              ))}
            </svg>
          </div>
        </div>

        <div style={{ display: "flex", gap: "var(--space-4)", marginTop: "var(--space-3)", fontSize: "0.8rem", color: "var(--color-text-muted)" }}>
          <span><span className="color-dot" style={{ background: "var(--color-accent)" }} /> Punto abierto</span>
          <span><span className="color-dot" style={{ background: "var(--color-success)" }} /> Punto cerrado (verificado)</span>
        </div>
      </div>

      <div className="card" style={{ marginTop: "var(--space-5)" }}>
        <div className="card-title-row">
          <h2>Puntos de esta zona</h2>
          <Link to={`/zones/${eventId}/${zoneId}/schedule`} className="btn btn-primary btn-sm">Ir al cronograma</Link>
        </div>
        {points.length === 0 && <div className="empty-state"><p>Todavía no hay puntos creados. Toca el plano para crear el primero.</p></div>}
        <ul>
          {points.map((p) => (
            <li key={p.id} style={{ display: "flex", alignItems: "center", gap: "var(--space-3)", padding: "var(--space-2) 0", borderBottom: "1px solid var(--color-border)" }}>
              <span className="color-dot" style={{ background: p.status === "closed" ? "var(--color-success)" : "var(--color-accent)" }} />
              <strong style={{ flex: 1 }}>{p.name}</strong>
              <span style={{ fontSize: "0.8rem", color: "var(--color-text-muted)" }}>
                {p.devices.reduce((s, d) => s + d.quantity, 0)} unidad(es)
              </span>
              {p.status === "closed"
                ? <span className="badge badge-success">Cerrado</span>
                : <span className="badge badge-warning">Abierto</span>}
              <button className="btn btn-secondary btn-sm" onClick={(e) => openExistingPoint(p, e)}>Ver</button>
            </li>
          ))}
        </ul>
      </div>

      {wizard && (
        <PointWizardModal
          eventId={eventId}
          zoneId={zoneId}
          zoneName={zone?.name}
          devices={devices}
          existingPoint={wizard.existingPoint}
          coords={wizard.coords}
          onClose={closeWizard}
          onSaved={handleWizardSaved}
        />
      )}
    </div>
  );
}
