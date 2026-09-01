import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { 
  CheckCircle2, 
  Eye, 
  Send, 
  Edit3, 
  MapPin, 
  Package, 
  ArrowRight, 
  Check 
} from "lucide-react";
import api from "../../services/api";
import "../../styles/Notifications.css";

const TYPE_LABEL = {
  device_request: "Producto pedido por un usuario",
  schedule_sent: "Cronograma enviado",
  schedule_review_pending: "Te toca revisar un cronograma",
  schedule_approved: "Cronograma aprobado",
  schedule_changes_requested: "Se pidieron cambios a un cronograma",
  zone_assigned: "Zona asignada",
};

/**
 * Configuración visual dinámica según el tipo de notificación (Colores, Badges e Íconos)
 */
const NOTIF_CONFIG = {
  schedule_approved: {
    bg: "#DCFCE7",
    iconColor: "#16A34A",
    badgeBg: "#DCFCE7",
    badgeColor: "#15803D",
    Icon: CheckCircle2,
  },
  schedule_review_pending: {
    bg: "#FEF9C3",
    iconColor: "#CA8A04",
    badgeBg: "#FEF9C3",
    badgeColor: "#A16207",
    Icon: Eye,
  },
  schedule_sent: {
    bg: "#E0F2FE",
    iconColor: "#0284C7",
    badgeBg: "#E0F2FE",
    badgeColor: "#0369A1",
    Icon: Send,
  },
  schedule_changes_requested: {
    bg: "#FEE2E2",
    iconColor: "#DC2626",
    badgeBg: "#FEE2E2",
    badgeColor: "#B91C1C",
    Icon: Edit3,
  },
  zone_assigned: {
    bg: "#F3E8FF",
    iconColor: "#9333EA",
    badgeBg: "#F3E8FF",
    badgeColor: "#7E22CE",
    Icon: MapPin,
  },
  device_request: {
    bg: "#FFEDD5",
    iconColor: "#EA580C",
    badgeBg: "#FFEDD5",
    badgeColor: "#C2410C",
    Icon: Package,
  },
};

function timeAgo(iso) {
  const diffMs = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return "justo ahora";
  if (mins < 60) return `hace ${mins} min`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `hace ${hours} h`;
  return new Date(iso).toLocaleDateString();
}

export default function Notifications() {
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = () => {
    setLoading(true);
    api.get("/notifications")
      .then((res) => setNotifications(res.data))
      .finally(() => setLoading(false));
  };

  useEffect(load, []);

  const markAsRead = async (id) => {
    await api.patch(`/notifications/${id}/read`);
    setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, read: true } : n)));
  };

  const unreadCount = notifications.filter((n) => !n.read).length;

  return (
    <div className="notifications-container">
      {/* Header Principal */}
      <div className="notif-header">
        <div className="notif-title-row">
          <h1 className="notif-title">NOTIFICACIONES</h1>
          {unreadCount > 0 && (
            <span className="notif-badge-unread">{unreadCount} sin leer</span>
          )}
        </div>
        <div className="notif-title-underline" />
        <p className="notif-subtitle">
          Avisos de cronogramas enviados e ítems nuevos agregados a la biblioteca por usuarios.
        </p>
      </div>

      {/* Carga o Estado Vacío */}
      {loading && (
        <div className="notif-empty-state">
          <p>Cargando notificaciones...</p>
        </div>
      )}

      {!loading && notifications.length === 0 && (
        <div className="notif-empty-state">
          <p>No tienes notificaciones todavía.</p>
        </div>
      )}

      {/* Lista de Notificaciones */}
      {!loading && notifications.length > 0 && (
        <ul className="notif-list">
          {notifications.map((n) => {
            const config = NOTIF_CONFIG[n.type] || NOTIF_CONFIG.schedule_sent;
            const IconComponent = config.Icon;

            return (
              <li
                key={n.id}
                className={`notif-card ${!n.read ? "notif-card-unread" : ""}`}
              >
                {/* Ícono Círculo */}
                <div
                  className="notif-icon-circle"
                  style={{ backgroundColor: config.bg }}
                >
                  <IconComponent size={22} color={config.iconColor} />
                </div>

                {/* Contenido */}
                <div className="notif-content">
                  <span
                    className="notif-type-badge"
                    style={{
                      backgroundColor: config.badgeBg,
                      color: config.badgeColor,
                    }}
                  >
                    {TYPE_LABEL[n.type] || n.type}
                  </span>
                  <p className="notif-message">{n.message}</p>
                  <span className="notif-time">{timeAgo(n.createdAt)}</span>
                </div>

                {/* Acciones (Alineadas a la derecha) */}
                <div className="notif-actions">
                  {n.type === "schedule_sent" && n.eventId && (
                    <Link
                      to={`/admin/events/${n.eventId}/zones/${n.relatedId}/schedules`}
                      className="notif-btn-link"
                    >
                      <span>Ver Cronograma</span>
                      <ArrowRight size={14} />
                    </Link>
                  )}

                  {!n.read && (
                    <button
                      className="notif-btn-read"
                      onClick={() => markAsRead(n.id)}
                      title="Marcar como leída"
                    >
                      <Check size={14} />
                      <span>Marcar como leída</span>
                    </button>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}