/**
 * Ray casting: ¿el punto (x,y) cae dentro del polígono de vértices `coords`?
 * Se usa en placements y en points para no permitir nada fuera de la zona asignada.
 */
export function isPointInPolygon(x, y, coords) {
  let inside = false;
  for (let i = 0, j = coords.length - 1; i < coords.length; j = i++) {
    const xi = coords[i].x, yi = coords[i].y;
    const xj = coords[j].x, yj = coords[j].y;
    const intersects = yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi;
    if (intersects) inside = !inside;
  }
  return inside;
}
