import { Link } from "react-router-dom";

/** Enlace consistente de "volver" para pantallas a las que solo se llega navegando desde otra (no están en el menú). */
export default function BackLink({ to, label = "Volver" }) {
  return (
    <Link
      to={to}
      style={{
        display: "inline-flex", alignItems: "center", gap: 6,
        fontSize: "0.85rem", color: "var(--color-text-muted)", marginBottom: "var(--space-4)",
      }}
    >
      ← {label}
    </Link>
  );
}
