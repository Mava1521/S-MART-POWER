import { useState } from "react";

/**
 * Tutorial paso a paso. Se muestra solo, automáticamente, la primera vez que la persona
 * entra a esa pantalla (guardado en localStorage por pantalla), y siempre queda disponible
 * un botón "?" para volver a verlo cuando quiera.
 */
export default function GuidedTour({ steps, storageKey }) {
  const alreadySeen = typeof window !== "undefined" && localStorage.getItem(storageKey) === "true";
  const [open, setOpen] = useState(!alreadySeen);
  const [stepIndex, setStepIndex] = useState(0);

  const finish = () => {
    localStorage.setItem(storageKey, "true");
    setOpen(false);
    setStepIndex(0);
  };

  const step = steps[stepIndex];
  const isLast = stepIndex === steps.length - 1;

  return (
    <>
      <button
        type="button"
        onClick={() => { setStepIndex(0); setOpen(true); }}
        aria-label="Ver ayuda paso a paso"
        title="Ver ayuda paso a paso"
        style={{
          position: "fixed", bottom: "calc(var(--bottomnav-height, 0px) + 20px)", right: 20, zIndex: 60,
          width: 48, height: 48, borderRadius: "50%", border: "none", cursor: "pointer",
          background: "var(--color-accent)", color: "var(--color-accent-text)",
          fontSize: "1.2rem", fontWeight: 700, boxShadow: "var(--shadow-card)",
        }}
      >
        ?
      </button>

      {open && (
        <div style={{
          position: "fixed", inset: 0, zIndex: 70, background: "rgba(0,0,0,0.6)",
          display: "flex", alignItems: "center", justifyContent: "center", padding: "var(--space-4)",
        }}>
          <div className="card" style={{ maxWidth: 420, width: "100%" }}>
            <div style={{ display: "flex", gap: 6, marginBottom: "var(--space-4)" }}>
              {steps.map((_, i) => (
                <div key={i} style={{
                  flex: 1, height: 4, borderRadius: 2,
                  background: i <= stepIndex ? "var(--color-accent)" : "var(--color-border)",
                }} />
              ))}
            </div>

            <div style={{
              width: 40, height: 40, borderRadius: "50%", background: "rgba(255,176,32,0.14)",
              color: "var(--color-accent)", display: "flex", alignItems: "center", justifyContent: "center",
              fontFamily: "var(--font-mono)", fontWeight: 700, marginBottom: "var(--space-3)",
            }}>
              {stepIndex + 1}
            </div>

            <h2>{step.title}</h2>
            <p>{step.description}</p>

            <div style={{ display: "flex", justifyContent: "space-between", marginTop: "var(--space-5)" }}>
              <button className="btn btn-secondary btn-sm" onClick={finish}>Saltar</button>
              <div style={{ display: "flex", gap: "var(--space-2)" }}>
                {stepIndex > 0 && (
                  <button className="btn btn-secondary btn-sm" onClick={() => setStepIndex((i) => i - 1)}>Atrás</button>
                )}
                {isLast ? (
                  <button className="btn btn-primary btn-sm" onClick={finish}>Entendido</button>
                ) : (
                  <button className="btn btn-primary btn-sm" onClick={() => setStepIndex((i) => i + 1)}>Siguiente</button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
