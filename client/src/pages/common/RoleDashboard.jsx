import { Link } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { NAV_BY_ROLE } from "../../config/navigation";
import "../../styles/RoleDashboardAdmin.css"; // Asegúrate de ajustar los "../" según la profundidad real del archivo

export default function RoleDashboard() {
  const { profile } = useAuth();
  const role = profile?.role;
  const items = (NAV_BY_ROLE[role] || []).filter((item) => !item.end);

  return (
    <div className="dashboard-container">
      {/* Encabezado Principal */}
      <header className="dashboard-header">
        <div className="dashboard-title-wrapper">
          <span className="title-accent-bar" aria-hidden="true" />
          <h1 className="dashboard-title">
            <span>PANEL</span> <span className="highlight">DE CONTROL</span>
          </h1>
        </div>

        <p className="dashboard-subtitle-bold">
          Gestiona toda la operación desde un solo lugar.
        </p>
        <p className="dashboard-subtitle-text">
          Accede a eventos, cronograma, entregas, recursos y usuarios para mantener cada proyecto organizado y bajo control.
        </p>
      </header>

      {/* Grid de Tarjetas */}
      <div className="dashboard-feature-grid">
        {items.map((item) => (
          <Link key={item.to} to={item.to} className="dashboard-feature-card">
            <div className="card-top-row">
              <div className="card-icon-box">
                <item.icon size={22} strokeWidth={2.2} />
              </div>
              <h3 className="card-title">{item.label}</h3>
              <div className="card-arrow" aria-hidden="true">
                <svg
                  width="20"
                  height="20"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="#E5533D"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <polyline points="9 18 15 12 9 6" />
                </svg>
              </div>
            </div>
            <p className="card-description">{item.desc}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}