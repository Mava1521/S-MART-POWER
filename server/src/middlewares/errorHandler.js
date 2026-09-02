import multer from "multer";

export function errorHandler(err, req, res, next) {
  console.error(err);

  // Los errores de Multer (archivo muy pesado, campo inesperado, etc.) son errores del
  // pedido del cliente, no del servidor — antes cualquiera de ellos caía en el genérico
  // 500 "Error interno del servidor", que no le decía nada útil a quien subía el archivo.
  if (err instanceof multer.MulterError) {
    const message = err.code === "LIMIT_FILE_SIZE"
      ? "La imagen pesa demasiado (máximo 20MB). Comprímela un poco e inténtalo de nuevo."
      : "No se pudo procesar el archivo enviado.";
    return res.status(400).json({ error: message });
  }

  const status = err.status || 500;
  res.status(status).json({
    error: err.publicMessage || "Error interno del servidor",
  });
}
