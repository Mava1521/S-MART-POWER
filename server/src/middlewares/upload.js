import multer from "multer";

// Guardamos el archivo en memoria (buffer) para subirlo directo a Cloudinary,
// nunca se escribe a disco ni se guarda en la base de datos.
const storage = multer.memoryStorage();

export const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
  fileFilter: (req, file, cb) => {
    if (!file.mimetype.startsWith("image/")) {
      return cb(new Error("Solo se permiten imágenes"));
    }
    cb(null, true);
  },
});
