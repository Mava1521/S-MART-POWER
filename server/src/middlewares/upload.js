import multer from "multer";

// Guardamos el archivo en memoria (buffer) para subirlo directo a Cloudinary,
// nunca se escribe a disco ni se guarda en la base de datos.
const storage = multer.memoryStorage();

export const upload = multer({
  storage,
  // 20MB: una foto de buena calidad (celular reciente o cámara) fácilmente pesa
  // 8-15MB. Con el límite anterior de 5MB, subir una imagen de verdadera alta
  // calidad se rechazaba antes de siquiera intentarlo.
  limits: { fileSize: 20 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (!file.mimetype.startsWith("image/")) {
      return cb(new Error("Solo se permiten imágenes"));
    }
    cb(null, true);
  },
});
