/**
 * Filtra un texto a solo letras (incluye acentos, ñ/Ñ y espacios) y lo pasa a mayúsculas.
 * Se usa en los campos de nombre de categoría: al forzar siempre el mismo formato
 * ("SONIDO" en vez de mezclar "Sonido"/"sonido"/"SONIDO"), evitamos que la misma categoría
 * termine duplicada por simple diferencia de mayúsculas/minúsculas al escribirla.
 */
export function toUppercaseLettersOnly(value) {
  return value
    .toUpperCase()
    .replace(/[^A-ZÁÉÍÓÚÑÜ\s]/g, "");
}
