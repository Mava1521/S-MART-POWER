import { useEffect, useState } from "react";
import { Plus, Copy, Check } from "lucide-react";
import api from "../../services/api";
import { useAuth } from "../../context/AuthContext";
import "../../styles/InvitationCodes.css";

const EXPIRY_OPTIONS = [
  { label: "Sin vencimiento", value: "" },
  { label: "1 hora", value: "1" },
  { label: "24 horas", value: "24" },
  { label: "48 horas", value: "48" },
  { label: "7 días", value: "168" },
];

function isExpired(code) {
  return code.expiresAt && new Date(code.expiresAt).getTime() < Date.now();
}

function timeLeft(iso) {
  const diffMs = new Date(iso).getTime() - Date.now();
  if (diffMs <= 0) return "vencido";
  const hours = Math.floor(diffMs / 3600000);
  if (hours < 1) return `${Math.floor(diffMs / 60000)} min restantes`;
  if (hours < 24) return `${hours} h restantes`;
  return `${Math.floor(hours / 24)} día(s) restantes`;
}

export default function InvitationCodes() {
  const { profile } = useAuth();
  const canChooseRole = profile?.role !== "productor";

  const [codes, setCodes] = useState([]);
  const [events, setEvents] = useState([]);
  const [eventId, setEventId] = useState("");
  const [targetRole, setTargetRole] = useState("user");
  const [expiresInHours, setExpiresInHours] = useState("");
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState("");
  const [copiedId, setCopiedId] = useState(null);

  const load = async () => {
    setLoading(true);
    try {
      const [codesRes, eventsRes] = await Promise.all([
        api.get("/invitations"),
        api.get("/events", { params: { status: "active" } }),
      ]);
      setCodes(codesRes.data);
      setEvents(eventsRes.data);
    } catch (err) {
      console.error("Error al cargar invitaciones:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const handleGenerate = async () => {
    setError("");
    setGenerating(true);
    try {
      await api.post("/invitations", {
        eventId: eventId || null,
        targetRole: canChooseRole ? targetRole : "user",
        expiresInHours: expiresInHours || null,
      });
      load();
    } catch (err) {
      setError(err.response?.data?.error || "No se pudo generar el código");
    } finally {
      setGenerating(false);
    }
  };

  const copyCode = (code, id) => {
    navigator.clipboard.writeText(code);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 1500);
  };

  return (
    <div className="invitation-codes-container">
      {/* Header Principal */}
      <div className="ic-header">
        <h1 className="ic-title">CÓDIGOS DE INVITACIÓN</h1>
        <div className="ic-title-underline" />
        <p className="ic-subtitle">
          Genera un código de un solo uso y compártelo con la persona que se va a registrar.
        </p>
      </div>

      {/* Tarjeta Generadora (Formulario Horizontal Superior) */}
      <div className="ic-generator-card">
        <div className="ic-generator-grid">
          {canChooseRole && (
            <div className="ic-form-field">
              <label className="ic-field-label">Rol</label>
              <select className="ic-select-input" value={targetRole} onChange={(e) => setTargetRole(e.target.value)}>
                <option value="user">Cliente</option>
                <option value="productor">Proveedor</option>
              </select>
            </div>
          )}

          <div className="ic-form-field ic-form-field-flex">
            <label className="ic-field-label">Evento (opcional)</label>
            <select className="ic-select-input" value={eventId} onChange={(e) => setEventId(e.target.value)}>
              <option value="">Sin asociar a un evento</option>
              {events.map((ev) => (
                <option key={ev.id} value={ev.id}>{ev.name}</option>
              ))}
            </select>
          </div>

          <div className="ic-form-field">
            <label className="ic-field-label">Vence en</label>
            <select className="ic-select-input" value={expiresInHours} onChange={(e) => setExpiresInHours(e.target.value)}>
              {EXPIRY_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>

          <button className="ic-btn-generate" onClick={handleGenerate} disabled={generating}>
            <Plus size={16} />
            <span>{generating ? "Generando..." : " Generar código nuevo"}</span>
          </button>
        </div>

        {error && <div className="ic-error-banner">{error}</div>}
      </div>

      {/* Tabla de Códigos Generados */}
      <div className="ic-table-section">
        <h2 className="ic-section-title">Códigos generados</h2>

        <div className="ic-table-container">
          <div className="ic-table-header">
            <span>Código</span>
            <span>Rol</span>
            <span>Estado</span>
            <span style={{ textAlign: "right" }}>Acciones</span>
          </div>

          <div>
            {loading ? (
              <div className="ic-empty-state">Cargando códigos...</div>
            ) : codes.length === 0 ? (
              <div className="ic-empty-state">Todavía no has generado ningún código.</div>
            ) : (
              codes.map((c) => {
                const expired = isExpired(c);
                const isAvailable = !c.used && !expired;

                return (
                  <div key={c.id} className="ic-table-row">
                    <span className="ic-code-text">{c.code}</span>
                    <span className="ic-role-text">
                      {c.targetRole === "productor" ? "Proveedor" : "Cliente"}
                    </span>

                    <div>
                      {c.used ? (
                        <span className="ic-badge ic-badge-used">Usado</span>
                      ) : expired ? (
                        <span className="ic-badge ic-badge-expired">Vencido</span>
                      ) : (
                        <span className="ic-badge ic-badge-active" title={c.expiresAt ? timeLeft(c.expiresAt) : "Sin vencimiento"}>
                          Activo
                        </span>
                      )}
                    </div>

                    <div className="ic-actions-cell">
                      {isAvailable && (
                        <button
                          className={`ic-btn-action ${copiedId === c.id ? "ic-btn-action-copied" : ""}`}
                          onClick={() => copyCode(c.code, c.id)}
                        >
                          {copiedId === c.id ? (
                            <>
                              <Check size={14} color="#047857" /> ¡Copiado!
                            </>
                          ) : (
                            <>
                              <Copy size={14} color="#E04F33" /> Copiar
                            </>
                          )}
                        </button>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>
    </div>
  );
}