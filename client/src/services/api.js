import axios from "axios";
import { auth } from "./firebase";
import { toastBridge } from "../context/ToastContext";

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL,
});

// Antes de cada petición, adjuntamos el ID token de Firebase vigente.
// El backend lo verifica con el Admin SDK; nunca enviamos el rol manualmente.
api.interceptors.request.use(async (config) => {
  const user = auth.currentUser;
  if (user) {
    const token = await user.getIdToken();
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Cualquier error de la API se avisa siempre con un toast — así ningún error se pasa por
// alto en silencio (como pasaba antes: una página se quedaba "cargando" para siempre sin
// que nadie se enterara de que en realidad falló). Una página puede seguir mostrando además
// su propio mensaje en el formulario si quiere más detalle; para evitar el toast en un caso
// puntual, se le puede pasar `{ skipGlobalErrorToast: true }` en la config del request.
api.interceptors.response.use(
  (response) => response,
  (error) => {
    const skip = error.config?.skipGlobalErrorToast || axios.isCancel(error);
    if (!skip && toastBridge.showError) {
      const message = error.response?.data?.error || "No se pudo completar la acción. Intenta de nuevo.";
      toastBridge.showError(message);
    }
    return Promise.reject(error);
  }
);

export default api;
