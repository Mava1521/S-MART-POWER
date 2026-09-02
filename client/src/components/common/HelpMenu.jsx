import { useEffect, useRef, useState } from "react";
import { useLocation } from "react-router-dom";
import { HelpCircle, X } from "lucide-react";
import { getHelpContent } from "../../config/helpContent";
import "../../styles/HelpMenu.css";

/**
 * Ícono de ayuda contextual, fijo arriba a la derecha en toda vista autenticada (ver
 * AppShell.jsx). Al hacer clic muestra varias opciones ("temas") explicando qué se puede
 * hacer en la pantalla donde está el usuario en ese momento — un mini-tutorial por vista,
 * en vez de una sola ayuda genérica igual en toda la app.
 */
export default function HelpMenu() {
  const location = useLocation();
  const [open, setOpen] = useState(false);
  const [openTopic, setOpenTopic] = useState(null);
  const panelRef = useRef(null);
  const content = getHelpContent(location.pathname);

  // Al cambiar de página, cerramos el panel y olvidamos qué tema estaba abierto, para que
  // la próxima vez que se abra muestre la lista de temas de la vista nueva.
  useEffect(() => {
    setOpen(false);
    setOpenTopic(null);
  }, [location.pathname]);

  useEffect(() => {
    if (!open) return;
    const handleClickOutside = (e) => {
      if (panelRef.current && !panelRef.current.contains(e.target)) setOpen(false);
    };
    const handleEscape = (e) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleEscape);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [open]);

  return (
    <div className="help-menu" ref={panelRef}>
      <button
        type="button"
        className="help-menu-trigger"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="true"
        aria-expanded={open}
        aria-label="Ayuda de esta vista"
        title="Ayuda de esta vista"
      >
        <HelpCircle size={20} />
      </button>

      {open && (
        <div className="help-menu-panel" role="dialog" aria-label={`Ayuda: ${content.title}`}>
          <div className="help-menu-panel-header">
            <span>Ayuda · {content.title}</span>
            <button type="button" className="help-menu-close" onClick={() => setOpen(false)} aria-label="Cerrar ayuda">
              <X size={16} />
            </button>
          </div>

          <div className="help-menu-topics">
            {content.topics.map((topic, i) => {
              const isOpenTopic = openTopic === i;
              return (
                <div key={i} className="help-menu-topic">
                  <button
                    type="button"
                    className="help-menu-topic-question"
                    onClick={() => setOpenTopic(isOpenTopic ? null : i)}
                    aria-expanded={isOpenTopic}
                  >
                    <span>{topic.q}</span>
                    <span className="help-menu-topic-caret">{isOpenTopic ? "−" : "+"}</span>
                  </button>
                  {isOpenTopic && <p className="help-menu-topic-answer">{topic.a}</p>}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
