export const SLA_UMBRAL_MIN = 25; // ya lo usa el sistema (campo Cumple)
export const SLA_META_PCT = 90; // "Meta 90%" en la card SLA y línea roja del gráfico
export const TIEMPO_META_MIN = 25; // "Meta 25 min" en Tiempo promedio, también con Solo VIP
export const SLA_RIESGO = 92; // monitor: "En riesgo" si SLA < 92 …
export const TIEMPO_RIESGO = 22; // … o tiempo > 22 min
export const SLA_VERDE = 90; // badge verde ≥ 90
export const SLA_AMARILLO = 75; // badge ámbar 75–89.9, rojo < 75
export const VIP_LEVELS = ["Nivel 2", "Nivel 3", "Nivel 4"] as const;
