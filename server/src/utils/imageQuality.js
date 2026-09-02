// Lado más largo (ancho o alto) por debajo del cual consideramos que una foto es de
// "baja resolución" y merece el remuestreo + nitidez extra descrito abajo.
const HD_MIN_DIMENSION = 1280;

/**
 * A partir del resultado de `cloudinary.uploader.upload_stream`, arma la URL de entrega
 * en la mejor calidad posible:
 *
 * - El archivo ORIGINAL que subió el usuario siempre queda guardado intacto en Cloudinary,
 *   en su resolución y calidad completas — nunca se recomprime ni se descarta nada al
 *   subirlo. Esta función solo decide cómo se ENTREGA (la URL que se guarda y se muestra).
 * - `q_auto:best` pide la mejor calidad visual que Cloudinary pueda dar (a diferencia de
 *   `q_auto` a secas, que prioriza peso de archivo sobre fidelidad).
 * - Si la foto original es pequeña (menor a HD_MIN_DIMENSION en su lado más largo — típico
 *   de una foto tomada con poca luz, muy comprimida, o una captura de pantalla), además se
 *   reescala hacia arriba (`c_scale`) y se le aplica nitidez (`e_sharpen`). Esto es un
 *   remuestreo + realce estándar de Cloudinary (disponible en cualquier plan, no es un
 *   add-on de pago): mejora de verdad cómo se ve una foto borrosa o pequeña al hacer zoom,
 *   aunque —siendo honestos— no "inventa" detalle que la foto original nunca tuvo, como sí
 *   haría un modelo de super-resolución con IA dedicado.
 *
 * `extraEffects` permite agregar efectos adicionales controlados por el usuario (por
 * ejemplo, `e_grayscale` en el plano del evento) sin duplicar esta lógica en cada sitio.
 */
export function buildHighQualityUrl(uploadResult, extraEffects = []) {
  const { width, height, secure_url } = uploadResult;
  const longSide = Math.max(width || 0, height || 0);

  const transforms = ["q_auto:best", "f_auto", ...extraEffects];
  if (longSide > 0 && longSide < HD_MIN_DIMENSION) {
    transforms.push(`c_scale,w_${HD_MIN_DIMENSION}`, "e_sharpen:60");
  }

  return secure_url.replace("/upload/", `/upload/${transforms.join(",")}/`);
}
