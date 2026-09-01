export const POINT_COLORS = ["#FFB020", "#4CAF7D", "#5B8DEF", "#E5484D", "#B968E8", "#4FC3E8", "#F2789F", "#8BC34A", "#FF8A65", "#26C6DA"];

/** Color estable por electrodoméstico (mismo id -> mismo color siempre). Se calcula igual en frontend y backend. */
export function colorForDevice(deviceId) {
  let hash = 0;
  for (let i = 0; i < deviceId.length; i++) hash = (hash * 31 + deviceId.charCodeAt(i)) % POINT_COLORS.length;
  return POINT_COLORS[hash];
}
