import { useEffect, useState } from "react";
import api from "../../services/api";

const POINT_COLORS = ["#FFB020", "#4CAF7D", "#5B8DEF", "#E5484D", "#B968E8", "#4FC3E8", "#F2789F", "#8BC34A", "#FF8A65", "#26C6DA"];
function colorForDevice(deviceId) {
  let hash = 0;
  for (let i = 0; i < deviceId.length; i++) hash = (hash * 31 + deviceId.charCodeAt(i)) % POINT_COLORS.length;
  return POINT_COLORS[hash];
}

/**
 * Modal de pasos para un Punto, siguiendo las pantallas 3-7 del prototipo:
 * nombre -> equipos (cantidad y referencia) -> verificación -> carga sugerida (opcional) -> cerrado.
 * Si `existingPoint` viene cerrado, se muestra en modo solo lectura.
 * Si viene abierto (de otro productor o tuyo), se entra directo a editar equipos.
 */
export default function PointWizardModal({ eventId, zoneId, zoneName, devices, existingPoint, coords, onClose, onSaved }) {
  const readOnly = existingPoint?.status === "closed";
  const base = `/events/${eventId}/zones/${zoneId}/points`;
  const [step, setStep] = useState(existingPoint ? "devices" : "name");
  const [pointId, setPointId] = useState(existingPoint?.id || null);
  const [name, setName] = useState(existingPoint?.name || "");
  const [size, setSize] = useState(existingPoint?.size || "medium");
  const [deviceSearch, setDeviceSearch] = useState("");
  const [quantities, setQuantities] = useState(() => {
    const initial = {};
    (existingPoint?.devices || []).forEach((d) => { initial[d.deviceId] = d.quantity; });
    return initial;
  });
  const [suggestedLoadKva, setSuggestedLoadKva] = useState(existingPoint?.suggestedLoadKva ?? "");
  const [error, setError] = useState("");
  const [showRequestForm, setShowRequestForm] = useState(false);
  const [myRequest, setMyRequest] = useState(null); // última solicitud del usuario, si existe
  const [checkingRequest, setCheckingRequest] = useState(false);
  const [requestLink, setRequestLink] = useState("");
  const [requestNote, setRequestNote] = useState("");
  const [requestSending, setRequestSending] = useState(false);
  const [requestSent, setRequestSent] = useState(false);
  const [requestError, setRequestError] = useState("");

  const openRequestForm = async () => {
    setShowRequestForm(true);
    setCheckingRequest(true);
    try {
      const res = await api.get("/device-requests/mine");
      const latest = res.data[0] || null;
      // Solo nos importa si sigue "viva" (pendiente o rechazada); si ya se agregó o se
      // descartó, es como si no hubiera solicitud — se puede mandar una nueva desde cero.
      setMyRequest(latest && ["pending", "rejected"].includes(latest.status) ? latest : null);
      if (latest?.status === "rejected") { setRequestLink(latest.link); setRequestNote(latest.note || ""); }
    } catch {
      setMyRequest(null);
    } finally {
      setCheckingRequest(false);
    }
  };

  const sendDeviceRequest = async () => {
    setRequestError("");
    if (!requestLink.trim()) { setRequestError("Pega el link del producto"); return; }
    setRequestSending(true);
    try {
      if (myRequest?.status === "rejected") {
        await api.put(`/device-requests/${myRequest.id}/resend`, { link: requestLink.trim(), note: requestNote.trim() });
      } else {
        await api.post("/device-requests", { link: requestLink.trim(), note: requestNote.trim() });
      }
      setRequestSent(true);
      setRequestLink(""); setRequestNote("");
    } catch (err) {
      setRequestError(err.response?.data?.error || "No se pudo enviar la solicitud");
    } finally {
      setRequestSending(false);
    }
  };
  const [saving, setSaving] = useState(false);

  const [scheduleDates, setScheduleDates] = useState([]);
  const [scheduleAllocations, setScheduleAllocations] = useState({}); // { date: { deviceId: qty } }
  const [scheduleLocked, setScheduleLocked] = useState(false);
  const [expandedDeviceId, setExpandedDeviceId] = useState(null);

  useEffect(() => {
    if (readOnly) return;
    api.get(`/events/${eventId}/zones/${zoneId}/schedules/mine`).then((res) => {
      setScheduleDates(res.data.dates || []);
      setScheduleLocked(!!res.data.locked);
      const byDate = {};
      (res.data.days || []).forEach((d) => { byDate[d.date] = d.allocations || {}; });
      setScheduleAllocations(byDate);
    }).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const setDayAllocation = async (deviceId, date, value) => {
    const qty = Math.max(0, Number(value) || 0);
    setScheduleAllocations((prev) => ({ ...prev, [date]: { ...prev[date], [deviceId]: qty } }));
    try {
      await api.put(`/events/${eventId}/zones/${zoneId}/schedules/mine/allocation`, { deviceId, date, quantity: qty });
    } catch (err) {
      setError(err.response?.data?.error || "No se pudo guardar el reparto de ese día");
    }
  };

  const createNamedPoint = async () => {
    if (!name.trim()) { setError("Ponle un nombre a este punto"); return; }
    setError(""); setSaving(true);
    try {
      const res = await api.post(base, { name, x: coords.x, y: coords.y, size });
      setPointId(res.data.id);
      setStep("devices");
    } catch (err) {
      setError(err.response?.data?.error || "No se pudo crear el punto");
    } finally {
      setSaving(false);
    }
  };

  const changeQuantity = async (deviceId, delta) => {
    const next = Math.max(0, (quantities[deviceId] || 0) + delta);
    setQuantities((prev) => ({ ...prev, [deviceId]: next }));
    try {
      await api.put(`${base}/${pointId}/devices`, { deviceId, quantity: next });
    } catch (err) {
      setError(err.response?.data?.error || "No se pudo actualizar la cantidad");
    }
  };

  const changeSize = async (newSize) => {
    setSize(newSize);
    if (!pointId) return; // aún no existe en el servidor (paso "name"); se manda al crear
    try {
      await api.patch(`${base}/${pointId}/size`, { size: newSize });
    } catch (err) {
      setError(err.response?.data?.error || "No se pudo cambiar el tamaño del punto");
    }
  };

  const totalUnits = Object.values(quantities).reduce((s, q) => s + (q || 0), 0);

  const finishAndClose = async () => {
    setError(""); setSaving(true);
    try {
      await api.patch(`${base}/${pointId}/close`, { suggestedLoadKva });
      setStep("done");
    } catch (err) {
      setError(err.response?.data?.error || "No se pudo cerrar el punto");
    } finally {
      setSaving(false);
    }
  };

  const handleDeletePoint = async () => {
    if (!window.confirm(`¿Eliminar el punto "${existingPoint?.name || name}"? Se borrarán también los electrodomésticos que le hayas colocado. Esta acción no se puede deshacer.`)) return;
    setError(""); setSaving(true);
    try {
      await api.delete(`${base}/${pointId}`);
      onSaved();
    } catch (err) {
      setError(err.response?.data?.error || "No se pudo eliminar el punto");
      setSaving(false);
    }
  };

  const filteredDevices = devices.filter((d) => {
    const s = deviceSearch.toLowerCase();
    return d.product.toLowerCase().includes(s) || (d.reference || "").toLowerCase().includes(s);
  });

  const deviceList = Object.entries(quantities).filter(([, q]) => q > 0);

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 80, background: "rgba(0,0,0,0.6)", display: "flex", alignItems: "center", justifyContent: "center", padding: "var(--space-4)" }}>
      <div className="card" style={{ maxWidth: 460, width: "100%", maxHeight: "85vh", overflowY: "auto" }}>
        {error && <div className="error-message">{error}</div>}

        {step === "name" && (
          <>
            <h2>Nombra este punto</h2>
            <p>Es la ubicación de tu activación dentro de {zoneName}. Ej. "Zona Comida A".</p>
            <div className="form-group">
              <input className="input" autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder="Nombre del punto" />
            </div>
            <div className="form-group">
              <label className="label">Tamaño del punto en el plano</label>
              <div style={{ display: "flex", gap: 6 }}>
                {[["small", "Pequeño"], ["medium", "Mediano"], ["large", "Grande"]].map(([val, label]) => (
                  <button
                    key={val}
                    type="button"
                    className={`btn btn-sm ${size === val ? "btn-primary" : "btn-secondary"}`}
                    onClick={() => setSize(val)}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
            <div style={{ display: "flex", justifyContent: "flex-end", gap: "var(--space-2)" }}>
              <button className="btn btn-secondary" onClick={onClose}>Cancelar</button>
              <button className="btn btn-primary" onClick={createNamedPoint} disabled={saving}>{saving ? "Creando..." : "Continuar"}</button>
            </div>
          </>
        )}

        {step === "devices" && (
          <>
            <h2>{existingPoint?.name || name}</h2>
            <p>{readOnly ? "Este punto ya está cerrado (solo lectura)." : "Busca tus equipos y ajusta la cantidad de cada uno."}</p>

            <div className="form-group">
              <label className="label">Tamaño del punto en el plano</label>
              <div style={{ display: "flex", gap: 6 }}>
                {[["small", "Pequeño"], ["medium", "Mediano"], ["large", "Grande"]].map(([val, label]) => (
                  <button
                    key={val}
                    type="button"
                    className={`btn btn-sm ${size === val ? "btn-primary" : "btn-secondary"}`}
                    onClick={() => changeSize(val)}
                  >
                    {label}
                  </button>
                ))}
              </div>
              <p style={{ fontSize: "0.75rem", color: "var(--color-text-muted)", margin: "4px 0 0" }}>
                Se puede cambiar en cualquier momento, aunque el punto ya esté cerrado.
              </p>
            </div>

            {!readOnly && (
              <>
                <input className="input" style={{ marginBottom: "var(--space-2)" }} placeholder="Buscar equipo..." value={deviceSearch} onChange={(e) => setDeviceSearch(e.target.value)} />
                <div style={{ marginBottom: "var(--space-3)", fontSize: "0.8rem", color: "var(--color-text-muted)" }}>
                  {showRequestForm ? (
                    <div className="card" style={{ background: "var(--color-surface-raised)", padding: "var(--space-3)" }}>
                      {checkingRequest ? (
                        <p style={{ margin: 0 }}>Revisando...</p>
                      ) : requestSent ? (
                        <p className="badge badge-success">Enviado. Te avisaremos cuando lo revisen.</p>
                      ) : myRequest?.status === "pending" ? (
                        <>
                          <p style={{ marginTop: 0 }} className="badge badge-warning">Ya tienes una solicitud en revisión</p>
                          <p style={{ fontSize: "0.8rem" }}>{myRequest.link}</p>
                        </>
                      ) : (
                        <>
                          {myRequest?.status === "rejected" && (
                            <p style={{ marginTop: 0 }} className="error-message">
                              Te pidieron corregir: {myRequest.rejectionReason}
                            </p>
                          )}
                          <p style={{ marginTop: 0 }}>
                            {myRequest?.status === "rejected"
                              ? "Corrige y reenvía el link:"
                              : "Pega el link del producto que necesitas y, si quieres, una nota. Le llega directo a tu productor/sub-administrador."}
                          </p>
                          {requestError && <div className="error-message">{requestError}</div>}
                          <input className="input" style={{ marginBottom: 6 }} placeholder="https://..." value={requestLink} onChange={(e) => setRequestLink(e.target.value)} />
                          <input className="input" style={{ marginBottom: 6 }} placeholder="Nota (opcional)" value={requestNote} onChange={(e) => setRequestNote(e.target.value)} />
                          <div style={{ display: "flex", gap: 6 }}>
                            <button type="button" className="btn btn-primary btn-sm" onClick={sendDeviceRequest} disabled={requestSending}>
                              {requestSending ? "Enviando..." : myRequest?.status === "rejected" ? "Reenviar solicitud" : "Enviar solicitud"}
                            </button>
                            <button type="button" className="btn btn-secondary btn-sm" onClick={() => setShowRequestForm(false)}>Cancelar</button>
                          </div>
                        </>
                      )}
                    </div>
                  ) : (
                    <>
                      ¿No encuentras el equipo?{" "}
                      <button type="button" className="btn-link" style={{ background: "none", border: "none", padding: 0, color: "var(--color-accent)", textDecoration: "underline", cursor: "pointer", font: "inherit" }} onClick={openRequestForm}>
                        Pide que lo agreguen
                      </button>
                    </>
                  )}
                </div>
              </>
            )}

            <ul>
              {(readOnly ? (existingPoint?.devices || []).map((d) => ({ id: d.deviceId, product: d.deviceName })) : filteredDevices).map((d) => (
                <li key={d.id} style={{ padding: "var(--space-2) 0", borderBottom: "1px solid var(--color-border)" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "var(--space-3)" }}>
                    <span className="color-dot" style={{ background: colorForDevice(d.id) }} />
                    <strong style={{ flex: 1 }}>{d.product}</strong>
                    {readOnly ? (
                      <span className="badge badge-success">{quantities[d.id] || 0}</span>
                    ) : (
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <button className="btn btn-secondary btn-sm" onClick={() => changeQuantity(d.id, -1)} disabled={!quantities[d.id]}>−</button>
                        <span className="mono" style={{ minWidth: 20, textAlign: "center" }}>{quantities[d.id] || 0}</span>
                        <button className="btn btn-secondary btn-sm" onClick={() => changeQuantity(d.id, 1)}>+</button>
                      </div>
                    )}
                  </div>

                  {!readOnly && quantities[d.id] > 0 && (
                    <div style={{ marginTop: 6 }}>
                      <button
                        className="btn btn-secondary btn-sm"
                        onClick={() => setExpandedDeviceId(expandedDeviceId === d.id ? null : d.id)}
                      >
                        {expandedDeviceId === d.id ? "Ocultar cronograma" : "Reparte por día"}
                      </button>

                      {expandedDeviceId === d.id && (
                        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 8, padding: "var(--space-2)", background: "var(--color-bg)", borderRadius: "var(--radius-sm)" }}>
                          {scheduleDates.length === 0 && <span style={{ fontSize: "0.78rem", color: "var(--color-text-faint)" }}>Este evento aún no tiene fechas de cronograma.</span>}
                          {scheduleLocked && <span style={{ fontSize: "0.78rem", color: "var(--color-danger)" }}>Tu cronograma ya está bloqueado, no se puede editar.</span>}
                          {!scheduleLocked && scheduleDates.map((date) => (
                            <label key={date} style={{ display: "flex", flexDirection: "column", alignItems: "center", fontSize: "0.7rem", color: "var(--color-text-muted)" }}>
                              {new Date(date + "T00:00:00").toLocaleDateString(undefined, { day: "2-digit", month: "short" })}
                              <input
                                className="input mono"
                                type="number"
                                min={0}
                                style={{ width: 52, textAlign: "center", padding: "4px" }}
                                value={scheduleAllocations[date]?.[d.id] ?? ""}
                                onChange={(e) => setDayAllocation(d.id, date, e.target.value)}
                              />
                            </label>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </li>
              ))}
            </ul>

            <div style={{ display: "flex", justifyContent: "space-between", marginTop: "var(--space-4)" }}>
              <div style={{ display: "flex", gap: "var(--space-2)" }}>
                <button className="btn btn-secondary" onClick={onSaved}>{readOnly ? "Cerrar" : "Guardar y seguir después"}</button>
                {pointId && (
                  <button className="btn btn-danger" onClick={handleDeletePoint} disabled={saving}>Eliminar punto</button>
                )}
              </div>
              {!readOnly && (
                <button className="btn btn-primary" onClick={() => setStep("verify")} disabled={totalUnits === 0}>Continuar</button>
              )}
            </div>
          </>
        )}

        {step === "verify" && (
          <>
            <h2>Verificación</h2>
            <p>Confirma antes de continuar.</p>
            <div className="form-group">
              <span className="label">Ubicación</span>
              <p style={{ margin: 0 }}>{name || existingPoint?.name} · {zoneName}</p>
            </div>
            <div className="form-group">
              <span className="label">Listado de equipos</span>
              <ul>
                {deviceList.map(([deviceId, qty]) => {
                  const device = devices.find((d) => d.id === deviceId);
                  return <li key={deviceId} style={{ padding: "4px 0" }}>{device?.product || deviceId} × {qty}</li>;
                })}
              </ul>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", marginTop: "var(--space-4)" }}>
              <button className="btn btn-secondary" onClick={() => setStep("devices")}>✎ Editar listado</button>
              <button className="btn btn-primary" onClick={() => setStep("kva")}>Continuar</button>
            </div>
          </>
        )}

        {step === "kva" && (
          <>
            <h2>Sugerido de carga (opcional)</h2>
            <p>Si tienes una idea de cuántos kVA podría necesitar este punto, regístralo aquí. Es tu propio estimado, no es obligatorio.</p>
            <div className="form-group">
              <label className="label" htmlFor="kva">Sugerido de carga (kVA)</label>
              <input id="kva" className="input" type="number" min={0} placeholder="Ej. 60" value={suggestedLoadKva} onChange={(e) => setSuggestedLoadKva(e.target.value)} />
            </div>
            <div style={{ display: "flex", justifyContent: "flex-end", gap: "var(--space-2)" }}>
              <button className="btn btn-secondary" onClick={() => setStep("verify")}>Atrás</button>
              <button className="btn btn-primary" onClick={finishAndClose} disabled={saving}>{saving ? "Guardando..." : "Guardar y cerrar"}</button>
            </div>
          </>
        )}

        {step === "done" && (
          <div style={{ textAlign: "center", padding: "var(--space-5) 0" }}>
            <div style={{ width: 56, height: 56, borderRadius: "50%", background: "var(--color-success-bg)", color: "var(--color-success)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto var(--space-4)", fontSize: "1.5rem" }}>✓</div>
            <h2>Verificado</h2>
            <p>Este punto quedó cerrado.</p>
            <button className="btn btn-primary" onClick={() => onSaved()}>Volver al plano</button>
          </div>
        )}
      </div>
    </div>
  );
}
