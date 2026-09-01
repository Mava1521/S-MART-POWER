import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import api from "../../services/api";
import { useAuth } from "../../context/AuthContext";
import { useToast } from "../../context/ToastContext";
import BackLink from "../../components/common/BackLink";

/**
 * Panel único para armar el "equipo" de un evento: sub-admins, productores y usuarios,
 * en un solo lugar. El sistema arma la cadena de mando sola a partir de esto: los usuarios
 * de este evento le envían su cronograma al productor que se les asigne aquí, ese productor
 * al sub-admin (o sub-admins) asignados a este evento, y al final al admin.
 * El admin gestiona los tres grupos. El sub-admin ve lo mismo pero solo puede tocar
 * productores y usuarios — la lista de sub-admins del evento es exclusiva del admin.
 */
export default function EventTeam() {
  const { id: eventId } = useParams();
  const { profile } = useAuth();
  const { showSuccess } = useToast();
  const isAdmin = profile?.role === "admin";

  const [event, setEvent] = useState(null);
  const [allSubadmins, setAllSubadmins] = useState([]);
  const [allProductores, setAllProductores] = useState([]);
  const [allUsers, setAllUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = async () => {
    setLoading(true);
    setError("");
    try {
      const [eventRes, subadminsRes, productoresRes, usersRes] = await Promise.all([
        api.get(`/events/${eventId}`),
        isAdmin ? api.get("/auth/users", { params: { role: "subadmin" } }) : Promise.resolve({ data: [] }),
        api.get("/auth/users", { params: { role: "productor" } }),
        api.get("/auth/users", { params: { role: "user" } }),
      ]);
      setEvent(eventRes.data);
      setAllSubadmins(subadminsRes.data);
      setAllProductores(productoresRes.data);
      setAllUsers(usersRes.data);
    } catch (err) {
      setError(err.response?.status === 403
        ? "No tienes este evento asignado."
        : (err.response?.data?.error || "No se pudo cargar el equipo del evento."));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [eventId]);

  const flash = (msg) => showSuccess(msg);

  const toggleSubadmin = async (uid, checked) => {
    const next = checked
      ? [...(event.assignedSubadmins || []), uid]
      : (event.assignedSubadmins || []).filter((u) => u !== uid);
    setError("");
    try {
      await api.put(`/events/${eventId}/subadmins`, { subadminIds: next });
      setEvent((e) => ({ ...e, assignedSubadmins: next }));
      flash("Guardado");
    } catch (err) {
      setError(err.response?.data?.error || "No se pudo actualizar");
    }
  };

  const toggleProductor = async (uid, checked) => {
    const next = checked
      ? [...(event.assignedProductores || []), uid]
      : (event.assignedProductores || []).filter((u) => u !== uid);
    setError("");
    try {
      await api.put(`/events/${eventId}/productores`, { productorIds: next });
      setEvent((e) => ({ ...e, assignedProductores: next }));
      flash("Guardado");
    } catch (err) {
      setError(err.response?.data?.error || "No se pudo actualizar");
    }
  };

  const setUserEvent = async (uid, checked) => {
    setError("");
    try {
      await api.put(`/auth/users/${uid}/event`, { eventId: checked ? eventId : null });
      setAllUsers((prev) => prev.map((u) => u.uid === uid ? { ...u, eventId: checked ? eventId : null, createdBy: checked ? u.createdBy : null } : u));
      flash("Guardado");
    } catch (err) {
      setError(err.response?.data?.error || "No se pudo actualizar");
    }
  };

  const setUserManager = async (uid, managerUid) => {
    setError("");
    try {
      await api.put(`/auth/users/${uid}/manager`, { managerUid: managerUid || null });
      setAllUsers((prev) => prev.map((u) => u.uid === uid ? { ...u, createdBy: managerUid || null } : u));
      flash("Guardado");
    } catch (err) {
      setError(err.response?.data?.error || "No se pudo asignar el productor");
    }
  };

  const setProductorManager = async (uid, managerUid) => {
    setError("");
    try {
      await api.put(`/auth/users/${uid}/manager`, { managerUid: managerUid || null });
      setAllProductores((prev) => prev.map((p) => p.uid === uid ? { ...p, createdBy: managerUid || null } : p));
      flash("Guardado");
    } catch (err) {
      setError(err.response?.data?.error || "No se pudo asignar el sub-admin");
    }
  };

  if (loading) return <p>Cargando equipo del evento...</p>;
  if (error && !event) {
    return (
      <div>
        <BackLink to="/admin/events" label="Volver a Eventos y planos" />
        <div className="error-message" style={{ marginTop: "var(--space-3)" }}>{error}</div>
      </div>
    );
  }

  const assignedSubadmins = event.assignedSubadmins || [];
  const assignedProductores = event.assignedProductores || [];
  const eventUsers = allUsers.filter((u) => u.eventId === eventId);
  const otherUsers = allUsers.filter((u) => u.eventId !== eventId);
  // Productores disponibles para asignar como manager de un usuario de este evento: los que
  // el admin/sub-admin ya asignó a este evento (mantiene la cadena de mando coherente).
  // Un sub-admin, además, solo puede ofrecer SUS PROPIOS productores (evita elegir uno que
  // el backend rechazaría por no ser de su equipo).
  const eventProductores = allProductores.filter((p) =>
    assignedProductores.includes(p.uid) && (isAdmin || p.createdBy === profile.uid)
  );

  return (
    <div>
      <BackLink to="/admin/events" label="Volver a Eventos y planos" />
      <h1>Equipo — {event.name}</h1>
      <p>
        Arma aquí quién trabaja en este evento. El sistema arma solo la cadena de aprobación de
        cronogramas: usuario → su productor → sub-admin(es) de este evento → admin.
      </p>

      {error && <div className="error-message">{error}</div>}

      {isAdmin && (
        <div className="card" style={{ marginBottom: "var(--space-5)" }}>
          <h2>Sub-administradores ({assignedSubadmins.length})</h2>
          <p style={{ fontSize: "0.85rem" }}>Sin al menos uno asignado, nadie más que tú ve este evento.</p>
          {allSubadmins.length === 0 && <p style={{ color: "var(--color-text-muted)" }}>No hay sub-administradores creados todavía.</p>}
          {allSubadmins.map((s) => (
            <label key={s.uid} style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 6 }}>
              <input type="checkbox" checked={assignedSubadmins.includes(s.uid)} onChange={(e) => toggleSubadmin(s.uid, e.target.checked)} />
              {s.name || s.email}
            </label>
          ))}
        </div>
      )}

      <div className="card" style={{ marginBottom: "var(--space-5)" }}>
        <h2>Productores ({assignedProductores.length})</h2>
        <p style={{ fontSize: "0.85rem" }}>Sin al menos uno asignado, ningún productor ve este evento.</p>
        {allProductores.length === 0 && <p style={{ color: "var(--color-text-muted)" }}>No hay productores creados todavía.</p>}
        {allProductores.map((p) => (
          <label key={p.uid} style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 6 }}>
            <input type="checkbox" checked={assignedProductores.includes(p.uid)} onChange={(e) => toggleProductor(p.uid, e.target.checked)} />
            {p.name || p.email}
          </label>
        ))}
      </div>

      <div className="card" style={{ marginBottom: "var(--space-5)" }}>
        <h2>Usuarios de este evento ({eventUsers.length})</h2>
        <p style={{ fontSize: "0.85rem" }}>Para cada uno, elige a qué productor de este evento le envía su cronograma.</p>
        {eventUsers.length === 0 && <p style={{ color: "var(--color-text-muted)" }}>Todavía no hay usuarios en este evento.</p>}
        {eventUsers.map((u) => (
          <div key={u.uid} style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 0", borderTop: "1px solid var(--color-border)" }}>
            <span style={{ flex: 1 }}>{u.representativeName || u.name || u.email}</span>
            <select className="input" style={{ maxWidth: 220 }} value={u.createdBy || ""} onChange={(e) => setUserManager(u.uid, e.target.value)}>
              <option value="">Sin productor asignado</option>
              {eventProductores.map((p) => <option key={p.uid} value={p.uid}>{p.name || p.email}</option>)}
            </select>
            <button className="btn btn-secondary btn-sm" onClick={() => setUserEvent(u.uid, false)}>Quitar del evento</button>
          </div>
        ))}

        {otherUsers.length > 0 && (
          <>
            <h3 style={{ marginTop: "var(--space-4)" }}>Agregar un usuario existente a este evento</h3>
            {otherUsers.map((u) => (
              <div key={u.uid} style={{ display: "flex", alignItems: "center", gap: 8, padding: "4px 0" }}>
                <span style={{ flex: 1, fontSize: "0.85rem" }}>{u.representativeName || u.name || u.email}</span>
                <button className="btn btn-secondary btn-sm" onClick={() => setUserEvent(u.uid, true)}>Agregar a este evento</button>
              </div>
            ))}
          </>
        )}
      </div>

      {isAdmin && (
        <div className="card">
          <h2>Sub-admin de cada productor</h2>
          <p style={{ fontSize: "0.85rem" }}>De qué sub-admin depende cada productor asignado a este evento (así el sub-admin ve los cronogramas de sus productores).</p>
          {eventProductores.length === 0 && <p style={{ color: "var(--color-text-muted)" }}>Asigna primero productores arriba.</p>}
          {eventProductores.map((p) => (
            <div key={p.uid} style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 0", borderTop: "1px solid var(--color-border)" }}>
              <span style={{ flex: 1 }}>{p.name || p.email}</span>
              <select className="input" style={{ maxWidth: 220 }} value={p.createdBy || ""} onChange={(e) => setProductorManager(p.uid, e.target.value)}>
                <option value="">Sin sub-admin asignado</option>
                {allSubadmins.filter((s) => assignedSubadmins.includes(s.uid)).map((s) => <option key={s.uid} value={s.uid}>{s.name || s.email}</option>)}
              </select>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
