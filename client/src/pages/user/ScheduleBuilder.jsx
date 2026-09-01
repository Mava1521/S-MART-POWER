import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import api from "../../services/api";
import { useAuth } from "../../context/AuthContext";
import GuidedTour from "../../components/common/GuidedTour";
import BackLink from "../../components/common/BackLink";

const formatShort = (iso) => new Date(iso + "T00:00:00").toLocaleDateString(undefined, { day: "2-digit", month: "short" });
const ROLE_LABEL = { productor: "tu productor", subadmin: "el sub-administrador", admin: "el administrador" };

/** Progreso de la cadena de aprobación, visto desde el usuario que envió el cronograma. */
function ChainProgress({ chain }) {
  if (!Array.isArray(chain) || chain.length === 0) return null;
  const CHAIN_ROLE_LABEL = { productor: "Productor", subadmin: "Sub-admin", admin: "Admin" };
  return (
    <div style={{ display: "flex", gap: 6, flexWrap: "wrap", margin: "var(--space-2) 0 var(--space-4)" }}>
      {chain.map((step, i) => (
        <span key={i} className={`badge ${step.status === "approved" ? "badge-success" : "badge-warning"}`} style={{ fontSize: "0.72rem" }}>
          {step.status === "approved" ? "✓" : "…"} {CHAIN_ROLE_LABEL[step.role] || step.role}
        </span>
      ))}
    </div>
  );
}

const SCHEDULE_TOUR_STEPS = [
  { title: "Fechas ya definidas", description: "Las fechas del cronograma las define tu administrador al crear el evento — tú solo repartes cantidades dentro de esos días." },
  { title: "Reparte las cantidades", description: "En la tabla, escribe cuántas unidades de cada electrodoméstico entregas en cada día. La suma no puede pasar del total que colocaste en el plano." },
  { title: "Guarda o envía", description: "'Guardar borrador' lo deja editable para seguir trabajando. 'Enviar cronograma' avisa a tu productor/administrador — desde ahí tienes 48 horas para seguir editándolo." },
];

export default function ScheduleBuilder() {
  const { eventId, zoneId } = useParams();
  const { profile } = useAuth();

  const [dates, setDates] = useState([]);
  const [totals, setTotals] = useState({});
  const [progress, setProgress] = useState({});
  const [days, setDays] = useState([]);
  const [status, setStatus] = useState("draft");
  const [reviewStatus, setReviewStatus] = useState(null);
  const [reviewNote, setReviewNote] = useState(null);
  const [reviewChain, setReviewChain] = useState(null);
  const [approvedAt, setApprovedAt] = useState(null);
  const [locked, setLocked] = useState(false);
  const [contact, setContact] = useState(null);
  const [sentAt, setSentAt] = useState(null);
  const [showSentPopup, setShowSentPopup] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [savedMsg, setSavedMsg] = useState("");

  const load = async () => {
    setLoading(true);
    const res = await api.get(`/events/${eventId}/zones/${zoneId}/schedules/mine`);
    setDates(res.data.dates || []);
    setTotals(res.data.totals);
    setProgress(res.data.progress);
    setDays(res.data.days || []);
    setStatus(res.data.status || "draft");
    setReviewStatus(res.data.reviewStatus || null);
    setReviewNote(res.data.reviewNote || null);
    setReviewChain(res.data.reviewChain || null);
    setApprovedAt(res.data.approvedAt || null);
    setLocked(!!res.data.locked);
    setContact(res.data.contact || null);
    setSentAt(res.data.sentAt || null);
    setLoading(false);
  };

  useEffect(() => { load(); }, [eventId, zoneId]);

  const deviceIds = Object.keys(totals);

  const setAllocation = (dayIndex, deviceId, value) => {
    setDays((prev) => {
      const next = [...prev];
      const qty = value === "" ? "" : Math.max(0, Number(value));
      next[dayIndex] = { ...next[dayIndex], allocations: { ...next[dayIndex].allocations, [deviceId]: qty } };
      return next;
    });
  };

  const save = async (asStatus) => {
    setError(""); setSavedMsg(""); setSaving(true);
    try {
      const cleanDays = days.map((d) => ({
        date: d.date,
        allocations: Object.fromEntries(Object.entries(d.allocations || {}).map(([k, v]) => [k, Number(v) || 0])),
      }));
      const res = await api.put(`/events/${eventId}/zones/${zoneId}/schedules/mine`, { days: cleanDays, status: asStatus });
      setProgress(res.data.progress);
      setStatus(res.data.status);
      if (asStatus === "sent") {
        setShowSentPopup(true);
        setSentAt(res.data.sentAt);
        load(); // trae la cadena de aprobación recién calculada
      } else {
        setSavedMsg("Borrador guardado.");
      }
    } catch (err) {
      setError(err.response?.data?.error || "No se pudo guardar el cronograma");
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <p>Cargando cronograma...</p>;

  if (deviceIds.length === 0) {
    return (
      <div>
        <BackLink to={`/zones/${eventId}/${zoneId}`} label="Volver a la zona" />
        <h1>Cronograma</h1>
        <div className="empty-state">
          <p>Primero coloca electrodomésticos en el plano de esta zona.</p>
        </div>
      </div>
    );
  }

  return (
    <div>
      {profile?.uid && (
        <GuidedTour steps={SCHEDULE_TOUR_STEPS} storageKey={`tour_schedule_v2_${profile.uid}`} />
      )}
      <BackLink to={`/zones/${eventId}/${zoneId}`} label="Volver a la zona" />
      <h1>Cronograma — {status === "sent" ? <span className="badge badge-success">Enviado</span> : <span className="badge badge-warning">Borrador</span>}</h1>

      {status === "sent" && reviewStatus !== "approved" && <ChainProgress chain={reviewChain} />}

      {reviewStatus === "approved" && (
        <div className="badge badge-success" style={{ marginBottom: "var(--space-4)" }}>✓ Cronograma aprobado por completo</div>
      )}
      {reviewStatus === "changes_requested" && (
        <div className="error-message"><strong>Te pidieron corregir algo:</strong> {reviewNote}</div>
      )}
      {locked && (
        <div className="error-message">
          <strong>Este cronograma ya no se puede editar.</strong> Pasaron 48 horas desde que lo enviaste (o fue congelado).
          {contact && (
            <div style={{ marginTop: 6 }}>
              Si necesitas modificarlo, contacta a {contact.name || contact.role}: {contact.email}{contact.phone ? ` · ${contact.phone}` : ""}
            </div>
          )}
        </div>
      )}

      {error && <div className="error-message">{error}</div>}
      {savedMsg && <div className="badge badge-success" style={{ marginBottom: "var(--space-4)" }}>{savedMsg}</div>}

      {reviewStatus === "approved" && (
        <div className="card" style={{ marginBottom: "var(--space-5)", background: "var(--color-surface-raised)" }}>
          <h2>Resumen final</h2>
          <ChainProgress chain={reviewChain} />
          <p style={{ fontSize: "0.85rem" }}>
            Tu cronograma quedó aprobado por completo{approvedAt ? ` el ${new Date(approvedAt).toLocaleDateString()} a las ${new Date(approvedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}` : ""}.
            {locked ? " Ya no se puede editar." : ""} La tabla de abajo queda como referencia de lo que se acordó entregar cada día.
          </p>
          {contact && (
            <p style={{ fontSize: "0.85rem", marginTop: 6 }}>
              ¿Alguna duda o necesitas reactivar tu cronograma para hacer un cambio? Contacta a {contact.name || ROLE_LABEL[contact.role] || contact.role}: {contact.email}{contact.phone ? ` · ${contact.phone}` : ""}
            </p>
          )}
        </div>
      )}

      <div className="card">
        <p style={{ fontSize: "0.85rem" }}>Fechas definidas por tu administrador: {dates[0] ? formatShort(dates[0]) : "—"} a {dates[dates.length - 1] ? formatShort(dates[dates.length - 1]) : "—"} ({dates.length} día(s)).</p>

        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr>
                <th style={{ textAlign: "left", padding: "var(--space-2)", borderBottom: "1px solid var(--color-border)" }}>Electrodoméstico</th>
                {days.map((d) => (
                  <th key={d.date} style={{ padding: "var(--space-2)", borderBottom: "1px solid var(--color-border)", fontSize: "0.8rem", color: "var(--color-text-muted)" }}>
                    {formatShort(d.date)}
                  </th>
                ))}
                <th style={{ padding: "var(--space-2)", borderBottom: "1px solid var(--color-border)" }}>Repartido</th>
              </tr>
            </thead>
            <tbody>
              {deviceIds.map((deviceId) => {
                const info = totals[deviceId];
                const prog = progress[deviceId] || { scheduled: 0 };
                return (
                  <tr key={deviceId}>
                    <td style={{ padding: "var(--space-2)", borderBottom: "1px solid var(--color-border)" }}>
                      <span className="color-dot" style={{ background: info.color, marginRight: 6 }} />
                      {info.deviceName} <span style={{ color: "var(--color-text-faint)" }}>({info.total} en total)</span>
                    </td>
                    {days.map((d, i) => (
                      <td key={d.date} style={{ padding: "var(--space-1)", borderBottom: "1px solid var(--color-border)", textAlign: "center" }}>
                        <input
                          className="input mono"
                          type="number"
                          min={0}
                          disabled={locked}
                          style={{ width: 60, textAlign: "center", padding: "6px" }}
                          value={d.allocations?.[deviceId] ?? ""}
                          onChange={(e) => setAllocation(i, deviceId, e.target.value)}
                        />
                      </td>
                    ))}
                    <td style={{ padding: "var(--space-2)", borderBottom: "1px solid var(--color-border)", fontSize: "0.85rem", color: "var(--color-text-muted)" }}>
                      {prog.scheduled} / {info.total}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {!locked && (
          <div style={{ display: "flex", gap: "var(--space-3)", marginTop: "var(--space-5)" }}>
            <button className="btn btn-secondary" onClick={() => save("draft")} disabled={saving}>Guardar borrador</button>
            <button className="btn btn-primary" onClick={() => save("sent")} disabled={saving}>Enviar cronograma a administración</button>
          </div>
        )}
      </div>

      {showSentPopup && (
        <div style={{ position: "fixed", inset: 0, zIndex: 90, background: "rgba(0,0,0,0.6)", display: "flex", alignItems: "center", justifyContent: "center", padding: "var(--space-4)" }}>
          <div className="card" style={{ maxWidth: 420 }}>
            <h2>Cronograma enviado</h2>
            <p>Tienes <strong>48 horas</strong> desde ahora para seguir modificando este cronograma. Después de ese plazo, quedará bloqueado y solo podrás verlo.</p>
            <p style={{ fontSize: "0.85rem" }}>
              Si luego de ese plazo necesitas cambiar algo, deberás pedirle a tu productor o administrador que te habilite la edición de nuevo.
            </p>
            <button className="btn btn-primary btn-block" onClick={() => setShowSentPopup(false)}>Entendido</button>
          </div>
        </div>
      )}
    </div>
  );
}
