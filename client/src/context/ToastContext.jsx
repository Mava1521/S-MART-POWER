import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";

const ToastContext = createContext(null);

let idCounter = 0;

/** Puente para que módulos que no son componentes (como services/api.js) puedan mostrar un
 *  toast sin depender de useContext — el ToastProvider se "registra" aquí al montar. */
export const toastBridge = { showError: null };

/**
 * Sistema de mensajes (toasts) único para toda la app: reemplaza los "badge-success" y
 * "error-message" sueltos que cada página manejaba a su manera (algunos aparecían, otros no,
 * cada uno con su propio texto y duración). Ahora toda acción que guarda/borra/envía algo
 * puede avisar con `showSuccess(...)` / `showError(...)` y se ve igual en cualquier pantalla.
 */
export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const timers = useRef({});

  const dismiss = useCallback((id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
    clearTimeout(timers.current[id]);
    delete timers.current[id];
  }, []);

  const push = useCallback((message, type = "success", durationMs = 4000) => {
    const id = ++idCounter;
    setToasts((prev) => [...prev, { id, message, type }]);
    timers.current[id] = setTimeout(() => dismiss(id), durationMs);
    return id;
  }, [dismiss]);

  const showSuccess = useCallback((message) => push(message, "success"), [push]);
  const showError = useCallback((message) => push(message, "error", 6000), [push]);
  const showInfo = useCallback((message) => push(message, "info"), [push]);

  useEffect(() => {
    toastBridge.showError = showError;
    return () => { toastBridge.showError = null; };
  }, [showError]);

  return (
    <ToastContext.Provider value={{ showSuccess, showError, showInfo }}>
      {children}
      <div className="toast-stack" role="status" aria-live="polite">
        {toasts.map((t) => (
          <div key={t.id} className={`toast toast-${t.type}`} onClick={() => dismiss(t.id)}>
            {t.message}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

/** Úsalo así: const { showSuccess, showError } = useToast(); showSuccess("Guardado"); */
export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast debe usarse dentro de <ToastProvider>");
  return ctx;
}

/** Extrae un mensaje de error legible de una respuesta de axios, con un texto por defecto. */
export function apiErrorMessage(err, fallback = "Algo salió mal. Intenta de nuevo.") {
  return err?.response?.data?.error || fallback;
}
