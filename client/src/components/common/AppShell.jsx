import { useEffect, useState } from "react";
import { NavLink } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { useInactivityLogout } from "../../hooks/useInactivityLogout";
import { NAV_BY_ROLE, ROLE_LABEL } from "../../config/navigation";
import ForcePasswordChangeModal from "./ForcePasswordChangeModal";
import api from "../../services/api";
import logoSmart from "../../assets/Imagenes/imagotipo_smart.png";

/** Envuelve toda pantalla autenticada: sidebar en escritorio, barra inferior en móvil. */
export default function AppShell({ children, title }) {
  const { profile, logout, refreshProfile } = useAuth();
  const [unreadCount, setUnreadCount] = useState(0);
  const [editingPhone, setEditingPhone] = useState(false);
  const [phoneValue, setPhoneValue] = useState(profile?.phone || "");

  const links = NAV_BY_ROLE[profile?.role] || [];
  const canSeeNotifications = ["admin", "subadmin", "productor"].includes(profile?.role);
  const isStaff = ["admin", "subadmin", "productor"].includes(profile?.role);

  const { showWarning } = useInactivityLogout(!!profile, logout);

  const savePhone = async () => {
    await api.put("/auth/me/contact", { phone: phoneValue });
    await refreshProfile();
    setEditingPhone(false);
  };

  useEffect(() => {
    if (!canSeeNotifications) return;
    api.get("/notifications").then((res) => {
      setUnreadCount(res.data.filter((n) => !n.read).length);
    }).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile?.role]);

  return (
    <div className="app-shell">
      {profile?.mustChangePassword && <ForcePasswordChangeModal />}
      {showWarning && (
        <div style={{
          position: "fixed", top: 0, left: 0, right: 0, zIndex: 9999,
          background: "var(--color-warning, #b45309)", color: "#fff", textAlign: "center",
          padding: "8px 12px", fontSize: "0.85rem",
        }}>
          Tu sesión se cerrará por inactividad en menos de 1 minuto. Mueve el mouse o toca la pantalla para seguir conectado.
        </div>
      )}
      <nav className="sidebar" aria-label="Navegación principal">
        <div className="sidebar-brand">
          <img
                      src={logoSmart}
                      alt="S-MART Power"
                      className="logo_menu"
                    />
        </div>
        <div className="sidebar-role">{ROLE_LABEL[profile?.role] || ""}</div>

        {links.map((link) => (
          <NavLink
            key={link.to}
            to={link.to}
            end={!!link.end}
            className={({ isActive }) => `nav-link ${isActive ? "active" : ""}`}
          >
            <link.icon size={18} strokeWidth={2} aria-hidden="true" />
            {link.label}
            {link.showBadge && unreadCount > 0 && (
              <span className="badge badge-warning" style={{ marginLeft: 4 }}>{unreadCount}</span>
            )}
          </NavLink>
        ))}

        <div className="sidebar-footer">
          <div className="sidebar-user">{profile?.email}</div>
          {isStaff && (
            editingPhone ? (
              <div style={{ display: "flex", gap: 4, marginBottom: "var(--space-2)" }}>
                <input className="input" style={{ padding: "4px 8px", fontSize: "0.75rem" }} placeholder="Tu teléfono" value={phoneValue} onChange={(e) => setPhoneValue(e.target.value)} />
                <button className="btn btn-primary btn-sm" onClick={savePhone}>OK</button>
              </div>
            ) : (
              <button className="nav-link" style={{ fontSize: "0.75rem", padding: "4px 8px" }} onClick={() => setEditingPhone(true)}>
                📞 {profile?.phone || "Agregar mi contacto"}
              </button>
            )
          )}
          <button className="btn btn-secondary btn-sm btn-block" onClick={logout}>
            Cerrar sesión
          </button>
        </div>
      </nav>

      <div className="main-area">
        <header className="topbar">
          <strong>{title}</strong>
        </header>

        <main className="page-content">{children}</main>
      </div>
    </div>
  );
}
