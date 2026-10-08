// Reglas de la evaluación diaria de operadores (sin cambios respecto de la versión anterior).

export interface Evaluacion {
  id: string;
  fecha: string; // "YYYY-MM-DDT00:00:00.000Z"
  operador: string;
  grupoMoneda?: string; // "inter" | "nacional"
  moneda?: string; // moneda principal del operador ese día (opcional)
  totalRetiros: number;
  cumplimientoSlaPct: number;
  tiempoPromedioMin: number;
  exonerados?: number;
  /** Retiros sin exonerar (base del SLA y del tiempo). */
  retirosEvaluables?: number;
  /** Evaluables con Cumple === true. */
  retirosCumplidos?: number;
  /** Suma de Tiempo de los evaluables. */
  tiempoTotalMin?: number;
  puntajeSla: number;
  puntajeTiempo: number;
  puntualidad: number;
  proactividad: number;
  completoTurno: boolean;
  tuvoInconveniente: boolean;
  comentarioInconveniente: string;
  puntajeFinal?: number;
  estado: "Pendiente" | "Confirmado";
  confirmadoEl?: string;
  confirmadoPor?: string;
  reaperturas?: { por: string; el: string }[];
}

export const calcularPuntajeSLA = (pct: number) =>
  pct >= 100 ? 10 : pct <= 0 ? 0 : Number((pct / 10).toFixed(1));

export const calcularPuntajeTiempo = (min: number) => {
  if (min >= 0 && min <= 10) return 10;
  if (min <= 15) return 9;
  if (min <= 20) return 8;
  if (min <= 25) return 7;
  if (min <= 30) return 6;
  if (min <= 35) return 5;
  if (min <= 40) return 4;
  if (min <= 45) return 3;
  return 0;
};

export const PESOS = {
  sla: 0.3,
  tiempo: 0.3,
  puntualidad: 0.2,
  proactividad: 0.2,
} as const;

type ParaNota = Pick<
  Evaluacion,
  "puntajeSla" | "puntajeTiempo" | "puntualidad" | "proactividad"
>;

/** Aporte de cada parte a la nota final (suman la nota). */
export const aportes = (ev: ParaNota) => ({
  sla: (ev.puntajeSla || 0) * PESOS.sla,
  tiempo: (ev.puntajeTiempo || 0) * PESOS.tiempo,
  puntualidad: (Number(ev.puntualidad) || 0) * PESOS.puntualidad,
  proactividad: (Number(ev.proactividad) || 0) * PESOS.proactividad,
});

export const calcularPuntajeFinal = (ev: ParaNota) => {
  const a = aportes(ev);
  return a.sla + a.tiempo + a.puntualidad + a.proactividad;
};

/** Nota a mostrar: la guardada si está confirmada; si no, la calculada con los valores actuales. */
export const notaDe = (ev: Evaluacion) =>
  ev.estado === "Confirmado" && typeof ev.puntajeFinal === "number"
    ? ev.puntajeFinal
    : calcularPuntajeFinal(ev);

export const TRAMOS_TIEMPO = [
  { hasta: 10, pts: 10, label: "≤10" },
  { hasta: 15, pts: 9, label: "15" },
  { hasta: 20, pts: 8, label: "20" },
  { hasta: 25, pts: 7, label: "25" },
  { hasta: 30, pts: 6, label: "30" },
  { hasta: 35, pts: 5, label: "35" },
  { hasta: 40, pts: 4, label: "40" },
  { hasta: 45, pts: 3, label: "45" },
  { hasta: Infinity, pts: 0, label: "+45" },
] as const;

export const UMBRAL_BUENA = 8;
export const UMBRAL_REVISAR = 6;

/** Color de texto según la nota: ≥8 verde, ≥6 ámbar, <6 rojo. */
export const colorNota = (n: number) =>
  n >= UMBRAL_BUENA
    ? "text-success-text"
    : n >= UMBRAL_REVISAR
      ? "text-warning-text"
      : "text-danger-text";

export const fondoNota = (n: number) =>
  n >= UMBRAL_BUENA ? "bg-success" : n >= UMBRAL_REVISAR ? "bg-warning" : "bg-danger";

/** Para comparar nombres sin errores de mayúsculas o espacios. */
export const normalizarNombre = (s: string) =>
  s.trim().replace(/\s+/g, " ").toLocaleLowerCase("es");

/** Visibilidad por grupo según el rol (los admin ven todo). */
export function veGrupo(
  rol: { isAdmin: boolean; isInter: boolean; esNacional: boolean },
  grupo?: string,
) {
  if (rol.isAdmin) return true;
  if (rol.isInter && grupo === "nacional") return false;
  if (rol.esNacional && grupo === "inter") return false;
  return true;
}
