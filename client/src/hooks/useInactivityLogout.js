import { useEffect, useRef, useState } from "react";

const INACTIVITY_LIMIT_MS = 30 * 60 * 1000; // 30 minutos sin actividad
const WARNING_BEFORE_MS = 60 * 1000; // avisa 1 minuto antes de cerrar sesión

const ACTIVITY_EVENTS = ["mousedown", "mousemove", "keydown", "scroll", "touchstart", "click"];

/**
 * Cierra la sesión automáticamente tras un rato sin actividad (mouse, teclado, scroll, touch).
 * Muestra un aviso 1 minuto antes por si la persona sigue ahí pero quieta (leyendo, por ejemplo),
 * y cualquier movimiento durante ese aviso cancela el cierre.
 */
export function useInactivityLogout(isLoggedIn, onLogout) {
  const [showWarning, setShowWarning] = useState(false);
  const timeoutRef = useRef(null);
  const warningRef = useRef(null);

  useEffect(() => {
    if (!isLoggedIn) {
      setShowWarning(false);
      return;
    }

    const clearTimers = () => {
      clearTimeout(timeoutRef.current);
      clearTimeout(warningRef.current);
    };

    const reset = () => {
      clearTimers();
      setShowWarning(false);
      warningRef.current = setTimeout(() => setShowWarning(true), INACTIVITY_LIMIT_MS - WARNING_BEFORE_MS);
      timeoutRef.current = setTimeout(() => onLogout(), INACTIVITY_LIMIT_MS);
    };

    ACTIVITY_EVENTS.forEach((evt) => window.addEventListener(evt, reset));
    reset();

    return () => {
      clearTimers();
      ACTIVITY_EVENTS.forEach((evt) => window.removeEventListener(evt, reset));
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoggedIn]);

  return { showWarning };
}
