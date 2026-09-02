import { useState } from "react";
import api from "../../services/api";
import { useToast } from "../../context/ToastContext";
import { X, UploadCloud, Calendar, Clock } from "lucide-react";

const todayISO = () => new Date().toISOString().slice(0, 10);

export default function CreateEventModal({ isOpen, onClose, onEventCreated }) {
  const { showSuccess } = useToast();
  const [name, setName] = useState("");
  const [venueImage, setVenueImage] = useState(null);
  const [grayscale, setGrayscale] = useState(false);
  const [scheduleStartDate, setScheduleStartDate] = useState(todayISO());
  const [scheduleDurationDays, setScheduleDurationDays] = useState(7);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [isDragActive, setIsDragActive] = useState(false);

  if (!isOpen) return null;

  const acceptFile = (file) => {
    if (file && file.type.startsWith("image/")) setVenueImage(file);
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    setIsDragActive(true);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    setIsDragActive(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragActive(false);
    acceptFile(e.dataTransfer.files?.[0]);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setSaving(true);
    try {
      const formData = new FormData();
      formData.append("name", name);
      formData.append("scheduleStartDate", scheduleStartDate);
      formData.append("scheduleDurationDays", scheduleDurationDays);
      formData.append("grayscale", grayscale);
      if (venueImage) formData.append("venueImage", venueImage);

      await api.post("/events", formData, {
        headers: { "Content-Type": "multipart/form-data" },
        skipGlobalErrorToast: true,
      });

      showSuccess("Evento creado");
      onEventCreated();
      onClose();
    } catch (err) {
      setError(err.response?.data?.error || "No se pudo crear el evento");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="modal-overlay">
      <div className="modal-card">
        {/* Header del Modal */}
        <div className="modal-header">
          <div className="title-wrapper">
            <span className="accent-bar" />
            <h2>Nuevo Evento</h2>
          </div>
          <button className="btn-close" onClick={onClose} aria-label="Cerrar">
            <X size={24} />
          </button>
        </div>

        {error && <div className="error-message">{error}</div>}

        <form onSubmit={handleSubmit} className="modal-form">
          {/* Nombre del evento */}
          <div className="form-group">
            <label className="label">Nombre del evento</label>
            <input
              className="input-text"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          </div>

          {/* Carga de Imagen / Dropzone */}
          <div className="form-group">
            <label className="label">Plano del recinto (imagen)</label>
            <div
              className={`dropzone${isDragActive ? " dropzone-active" : ""}`}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
            >
              <UploadCloud size={40} className="dropzone-icon" />
              <p className="dropzone-text">
                Arrastra aquí tu imagen o haz clic para seleccionarla
              </p>
              {/* El backend (multer fileFilter) solo acepta imágenes, así que el texto
                  no debe ofrecer PDF: prometer un formato que luego el servidor rechaza
                  es peor experiencia que no mencionarlo. */}
              <span className="dropzone-subtext">Formatos: JPG, PNG · hasta 20MB · se sube en la mejor calidad posible</span>

              <label htmlFor="file-upload" className="btn-select-file">
                + Seleccionar archivos
              </label>
              <input
                id="file-upload"
                type="file"
                accept="image/*"
                onChange={(e) => acceptFile(e.target.files[0])}
                style={{ display: "none" }}
              />
              {venueImage && <span className="selected-filename">{venueImage.name}</span>}
            </div>

            <label className="checkbox-label">
              <input
                type="checkbox"
                checked={grayscale}
                onChange={(e) => setGrayscale(e.target.checked)}
              />
              <span>
                Convertir a blanco y negro <em>(reduce el peso del archivo, sin quitarle nada al plano)</em>
              </span>
            </label>
          </div>

          {/* Fechas y Duración */}
          <div className="form-row">
            <div className="form-group flex-1">
              <label className="label">Inicio del cronograma</label>
              <div className="input-icon-wrapper">
                <Calendar size={18} className="input-icon" />
                <input
                  className="input-text with-icon"
                  type="date"
                  value={scheduleStartDate}
                  onChange={(e) => setScheduleStartDate(e.target.value)}
                  required
                />
              </div>
            </div>

            <div className="form-group flex-1">
              <label className="label">Duración (días)</label>
              <div className="input-icon-wrapper">
                <Clock size={18} className="input-icon" />
                <input
                  className="input-text with-icon"
                  type="number"
                  min={1}
                  step={1}
                  value={scheduleDurationDays}
                  onChange={(e) => setScheduleDurationDays(e.target.value)}
                  required
                />
              </div>
            </div>
          </div>

          {/* Botón de acción */}
          <div className="modal-actions">
            <button type="submit" className="btn-submit" disabled={saving}>
              {saving ? "Creando..." : "Crear Evento"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}