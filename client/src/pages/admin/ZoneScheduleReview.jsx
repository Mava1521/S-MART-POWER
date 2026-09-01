import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { useToast } from "../../context/ToastContext";
import api from "../../services/api";
import BackLink from "../../components/common/BackLink";

const formatShort = (iso) => new Date(iso + "T00:00:00").toLocaleDateString(undefined, { day: "2-digit", month: "short" });

const ROLE_LABEL = { productor: "Productor", subadmin: "Sub-admin", admin: "Admin" };

/** Muestra el progreso de la cadena de aprobación: quién ya aprobó, quién sigue. */
function ChainProgress({ chain }) {
  if (!Array.isArray(chain) || chain.length === 0) return null;
  return (
    <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 4, marginBottom: "var(--space-2)" }}>
      {chain.map((step, i) => (
        <span
          key={i}
          className={`badge ${step.status === "approved" ? "badge-success" : "badge-warning"}`}
          style={{ fontSize: "0.72rem" }}
        >
          {step.status === "approved" ? "✓" : "…"} {ROLE_LABEL[step.role] || step.role}
        </span>
      ))}
    </div>
  );
}

/** Una fila de progreso con su barra, reusada para "programado" y para "entregado". */
function ProgressRow({ label, scheduled, total, percent, color }) {
  return (
    <div style={{ minWidth: 140 }}>
      <div style={{ fontSize: "0.72rem", color: "var(--color-text-muted)", marginBottom: 2 }}>
        {label}: {scheduled}/{total} · {percent}%
      </div>
      <div style={{ height: 5, background: "var(--color-bg)", borderRadius: 4, overflow: "hidden" }}>
        <div style={{ height: "100%", width: `${percent}%`, background: color }} />
      </div>
    </div>
  );
}

/**
 * Admin/sub-admin: ve el cronograma completo que cada cliente envió (todos los electrodomésticos
 * y todos los días) y marca cuánto se ha ENTREGADO realmente. El % "programado" viene del cliente;
 * el % "entregado" lo controla el admin y es el que de verdad indica cuánto falta para el 100%.
 */
export default function ZoneScheduleReview() {
  const { eventId, zoneId } = useParams();
  const { profile } = useAuth();
  const { showSuccess } = useToast();
  // El productor solo aprueba/pide cambios; no hace entregas ni necesita ver los porcentajes
  // de avance — eso es trabajo de sub-admin/admin, que sí confirman qué se entregó de verdad.
  const canManageDeliveries = profile?.role !== "productor";
  const [data, setData] = useState({ totals: {}, schedules: [] });
  const [loading, setLoading] = useState(true);
  const [localDeliveries, setLocalDeliveries] = useState({}); // { uid: { date: { deviceId: qty } } }
  const [savingUid, setSavingUid] = useState(null);
  const [savedUid, setSavedUid] = useState(null);
  const [error, setError] = useState("");
  const [reviewNoteByUid, setReviewNoteByUid] = useState({});
  const [reviewingUid, setReviewingUid] = useState(null);
  const [freezingUid, setFreezingUid] = useState(null);
  const [tab, setTab] = useState("pending"); // "pending" | "approved"

  const toggleFreeze = async (schedule) => {
    setFreezingUid(schedule.uid);
    try {
      await api.patch(`/events/${eventId}/zones/${zoneId}/schedules/${schedule.uid}/freeze`, { frozen: !schedule.frozen }, { skipGlobalErrorToast: true });
      load();
      showSuccess(schedule.frozen ? "Descongelado" : "Congelado");
    } catch (err) {
      setError(err.response?.data?.error || "No se pudo cambiar el estado de congelado");
    } finally {
      setFreezingUid(null);
    }
  };

  const load = async () => {
    setLoading(true);
    setError("");
    try {
      const res = await api.get(`/events/${eventId}/zones/${zoneId}/schedules`);
      setData(res.data);

      const initial = {};
      res.data.schedules.forEach((s) => {
        const byDate = {};
        (s.days || []).forEach((d) => { byDate[d.date] = {}; });
        (s.deliveries || []).forEach((d) => { byDate[d.date] = { ...byDate[d.date], ...d.allocations }; });
        initial[s.uid] = byDate;
      });
      setLocalDeliveries(initial);
    } catch (err) {
      if (err.response?.status === 403) {
        setError("No tienes este evento asignado, así que no puedes ver sus cronogramas. Pídele a un admin que te lo asigne desde Eventos.");
      } else {
        setError(err.response?.data?.error || "No se pudo cargar el cronograma. Intenta de nuevo.");
      }
      setData({ totals: {}, schedules: [] });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [eventId, zoneId]);

  const setDeliveryValue = (uid, date, deviceId, value) => {
    setLocalDeliveries((prev) => ({
      ...prev,
      [uid]: {
        ...prev[uid],
        [date]: { ...prev[uid]?.[date], [deviceId]: value === "" ? "" : Math.max(0, Number(value)) },
      },
    }));
  };

  const saveDeliveries = async (schedule) => {
    setError(""); setSavingUid(schedule.uid); setSavedUid(null);
    try {
      const deliveries = (schedule.days || []).map((d) => ({
        date: d.date,
        allocations: Object.fromEntries(
          Object.entries(localDeliveries[schedule.uid]?.[d.date] || {}).map(([k, v]) => [k, Number(v) || 0])
        ),
      }));
      await api.put(`/events/${eventId}/zones/${zoneId}/schedules/${schedule.uid}/deliveries`, { deliveries }, { skipGlobalErrorToast: true });
      setSavedUid(schedule.uid);
      load();
      showSuccess("Entregas guardadas");
    } catch (err) {
      setError(err.response?.data?.error || "No se pudieron guardar las entregas");
    } finally {
      setSavingUid(null);
    }
  };

  const sendReview = async (schedule, status) => {
    setError("");
    const note = reviewNoteByUid[schedule.uid] || "";
    if (status === "changes_requested" && !note.trim()) {
      setError("Escribe qué debe corregir el usuario antes de pedir cambios.");
      return;
    }
    setReviewingUid(schedule.uid);
    try {
      await api.patch(`/events/${eventId}/zones/${zoneId}/schedules/${schedule.uid}/review`, { status, note }, { skipGlobalErrorToast: true });
      load();
      showSuccess(status === "approved" ? "Aprobado" : "Cambios solicitados — el usuario ya puede corregir y reenviar");
    } catch (err) {
      setError(err.response?.data?.error || "No se pudo guardar la revisión");
    } finally {
      setReviewingUid(null);
    }
  };

  if (loading) return <p>Cargando cronogramas...</p>;

  const deviceIds = Object.keys(data.totals);
  const approvedSchedules = data.schedules
    .filter((s) => s.reviewStatus === "approved")
    .sort((a, b) => (a.days?.[0]?.date || "").localeCompare(b.days?.[0]?.date || ""));
  const pendingSchedules = data.schedules.filter((s) => s.reviewStatus !== "approved");
  const visibleSchedules = tab === "approved" ? approvedSchedules : pendingSchedules;

  return (
    <div>
      <BackLink to={`/admin/events/${eventId}/zones`} label="Volver a Zonas del evento" />
      <h1>Cronogramas de la zona</h1>
      <p>Marca cuánto has entregado realmente de cada electrodoméstico, día por día. El cliente programa, tú confirmas la entrega.</p>

      {error && <div className="error-message">{error}</div>}

      <div style={{ display: "flex", gap: 8, marginBottom: "var(--space-4)" }}>
        <button
          className={`btn btn-sm ${tab === "pending" ? "btn-primary" : "btn-secondary"}`}
          onClick={() => setTab("pending")}
        >
          En proceso ({pendingSchedules.length})
        </button>
        <button
          className={`btn btn-sm ${tab === "approved" ? "btn-primary" : "btn-secondary"}`}
          onClick={() => setTab("approved")}
        >
          Aprobados ({approvedSchedules.length})
        </button>
      </div>

      {data.schedules.length === 0 && <div className="empty-state"><p>Nadie ha enviado un cronograma para esta zona todavía.</p></div>}
      {data.schedules.length > 0 && visibleSchedules.length === 0 && (
        <div className="empty-state"><p>{tab === "approved" ? "Todavía no hay cronogramas totalmente aprobados." : "No hay cronogramas en proceso."}</p></div>
      )}

      {visibleSchedules.map((s) => (
        <div className="card" key={s.uid} style={{ marginBottom: "var(--space-6)" }}>
          <div className="card-title-row">
            <h2>{s.userName || s.userEmail || s.uid}</h2>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              {s.status === "sent"
                ? <span className="badge badge-success">Enviado</span>
                : <span className="badge badge-warning">Borrador</span>}
              {s.reviewStatus === "approved" && <span className="badge badge-success">Aprobado</span>}
              {s.reviewStatus === "changes_requested" && <span className="badge badge-warning">Cambios solicitados</span>}
              {(!s.reviewStatus || s.reviewStatus === "pending") && s.status === "sent" && <span className="badge badge-warning">Por revisar</span>}
              {s.locked && <span className="badge badge-warning">Bloqueado</span>}
              {s.frozen && <span className="badge badge-warning">Congelado</span>}
            </div>
          </div>
          <p>{s.days?.[0]?.date || "—"} a {s.days?.[s.days.length - 1]?.date || "—"} · {s.days?.length || 0} día(s)</p>
          <ChainProgress chain={s.reviewChain} />
          {s.reviewStatus === "changes_requested" && s.reviewNote && (
            <div className="error-message">Comentario enviado al usuario: "{s.reviewNote}"</div>
          )}

          {(!s.days || s.days.length === 0) ? (
            <div className="empty-state"><p>Este cliente aún no definió días en su cronograma.</p></div>
          ) : (
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr>
                    <th style={{ textAlign: "left", padding: "var(--space-2)", borderBottom: "1px solid var(--color-border)" }}>Electrodoméstico</th>
                    {s.days.map((d) => (
                      <th key={d.date} style={{ padding: "var(--space-2)", borderBottom: "1px solid var(--color-border)", fontSize: "0.8rem", color: "var(--color-text-muted)" }}>
                        {formatShort(d.date)}
                      </th>
                    ))}
                    {canManageDeliveries && (
                      <th style={{ padding: "var(--space-2)", borderBottom: "1px solid var(--color-border)" }}>Avance</th>
                    )}
                  </tr>
                </thead>
                <tbody>
                  {deviceIds.map((deviceId) => {
                    const info = data.totals[deviceId];
                    const schedProg = s.progress?.[deviceId] || { scheduled: 0, percent: 0 };
                    const delivProg = s.deliveryProgress?.[deviceId] || { scheduled: 0, percent: 0 };
                    return (
                      <tr key={deviceId}>
                        <td style={{ padding: "var(--space-2)", borderBottom: "1px solid var(--color-border)" }}>
                          <span className="color-dot" style={{ background: info.color, marginRight: 6 }} />
                          {info.deviceName} <span style={{ color: "var(--color-text-faint)" }}>({info.total} en total)</span>
                        </td>
                        {s.days.map((d) => {
                          const scheduledThatDay = d.allocations?.[deviceId] || 0;
                          if (!canManageDeliveries) {
                            return (
                              <td key={d.date} style={{ padding: "var(--space-1)", borderBottom: "1px solid var(--color-border)", textAlign: "center" }}>
                                {scheduledThatDay}
                              </td>
                            );
                          }
                          return (
                            <td key={d.date} style={{ padding: "var(--space-1)", borderBottom: "1px solid var(--color-border)", textAlign: "center" }}>
                              <div style={{ fontSize: "0.68rem", color: "var(--color-text-faint)", marginBottom: 2 }}>Prog: {scheduledThatDay}</div>
                              <input
                                className="input mono"
                                type="number"
                                min={0}
                                style={{ width: 60, textAlign: "center", padding: "6px" }}
                                placeholder="0"
                                value={localDeliveries[s.uid]?.[d.date]?.[deviceId] ?? ""}
                                onChange={(e) => setDeliveryValue(s.uid, d.date, deviceId, e.target.value)}
                              />
                            </td>
                          );
                        })}
                        {canManageDeliveries && (
                          <td style={{ padding: "var(--space-2)", borderBottom: "1px solid var(--color-border)", minWidth: 160 }}>
                            <ProgressRow label="Programado" scheduled={schedProg.scheduled} total={info.total} percent={schedProg.percent} color="var(--color-text-faint)" />
                            <div style={{ marginTop: 4 }}>
                              <ProgressRow label="Entregado" scheduled={delivProg.scheduled} total={info.total} percent={delivProg.percent} color={info.color} />
                            </div>
                          </td>
                        )}
                      </tr>
                    );
                  })}
                </tbody>
              </table>

              {canManageDeliveries && (
                <div style={{ marginTop: "var(--space-4)", display: "flex", alignItems: "center", gap: "var(--space-3)" }}>
                  <button className="btn btn-primary btn-sm" onClick={() => saveDeliveries(s)} disabled={savingUid === s.uid}>
                    {savingUid === s.uid ? "Guardando..." : "Guardar entregas"}
                  </button>
                  {savedUid === s.uid && <span className="badge badge-success">Guardado</span>}
                </div>
              )}

              <div style={{ marginTop: "var(--space-5)", paddingTop: "var(--space-4)", borderTop: "1px solid var(--color-border)" }}>
                {s.reviewStatus === "approved" ? (
                  <p className="badge badge-success">Este cronograma ya está totalmente aprobado — no requiere más acción.</p>
                ) : s.status !== "sent" ? (
                  <p style={{ color: "var(--color-text-muted)", fontSize: "0.85rem" }}>El usuario aún no ha enviado este cronograma para revisión.</p>
                ) : !s.canReview ? (
                  <p className="badge badge-warning">
                    Esperando la aprobación de {ROLE_LABEL[s.currentApproverRole] || s.currentApproverRole}. Te avisaremos cuando te toque revisar.
                  </p>
                ) : (
                  <>
                    <div className="form-group">
                      <label className="label">Comentario para el usuario (obligatorio si pides cambios)</label>
                      <input
                        className="input"
                        placeholder="Ej. Falta programar la nevera para el día 3"
                        value={reviewNoteByUid[s.uid] || ""}
                        onChange={(e) => setReviewNoteByUid((prev) => ({ ...prev, [s.uid]: e.target.value }))}
                      />
                    </div>
                    <div style={{ display: "flex", gap: "var(--space-2)" }}>
                      <button className="btn btn-primary btn-sm" onClick={() => sendReview(s, "approved")} disabled={reviewingUid === s.uid}>
                        Aprobar cronograma
                      </button>
                      <button className="btn btn-danger btn-sm" onClick={() => sendReview(s, "changes_requested")} disabled={reviewingUid === s.uid}>
                        Pedir cambios
                      </button>
                    </div>
                  </>
                )}
                <div style={{ marginTop: "var(--space-3)" }}>
                  <button className="btn btn-secondary btn-sm" onClick={() => toggleFreeze(s)} disabled={freezingUid === s.uid}>
                    {s.frozen ? "Descongelar" : "Congelar (nadie puede editar)"}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
