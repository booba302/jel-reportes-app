/** Mapeo puro de documentos de Firestore (o filas de una carga) a filas de Postgres. */

export type FilaRetiro = {
  id: string;
  fecha_reporte: string; // YYYY-MM-DD
  moneda: string;
  operador: string;
  jugador: string;
  alias: string;
  cantidad: number;
  nivel: string;
  fecha_operacion: string;
  update_date: string;
  hora: number | null;
  tiempo: number;
  cumple: boolean;
  /** Solo lo trae la copia desde Firestore; las cargas nunca lo pisan. */
  comentario_brecha?: string;
};

export type FilaHistorial = {
  id: string;
  fecha_reporte: string;
  moneda: string;
  subido_el: string; // ISO
  subido_por: string;
  total_registros: number;
};

export type FilaObservacion = {
  moneda: string;
  fecha: string;
  observacion: string;
  fecha_actualizacion: string;
};

const EPOCA = new Date(0).toISOString();

const esDia = (s: string) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const t = Date.parse(`${s}T00:00:00.000Z`);
  return !Number.isNaN(t) && new Date(t).toISOString().startsWith(s);
};

const isoOEpoca = (v: unknown) => {
  const t = Date.parse(String(v ?? ""));
  return Number.isNaN(t) ? EPOCA : new Date(t).toISOString();
};

/** "2026-03-01T00:00:00.000Z" o "2026-03-01" → "2026-03-01"; null si no es un día real. */
export function diaDeReporte(v: unknown): string | null {
  const s = String(v ?? "").split("T")[0];
  return esDia(s) ? s : null;
}

/** Hora (0–23) de "2026-03-01 14:35:00"; null si no tiene. Misma regla que usaba el monitor. */
export function horaDe(fechaOperacion: string): number | null {
  const parte = fechaOperacion.split(" ")[1];
  if (!parte) return null;
  const h = Number(parte.slice(0, 2));
  return Number.isFinite(h) ? h : null;
}

/** Documento de `operaciones_retiros` (o `datos` de una carga) → fila. null si no tiene fecha de reporte válida. */
export function filaRetiro(id: string, d: Record<string, unknown>): FilaRetiro | null {
  const fecha = diaDeReporte(d["Fecha del reporte"]);
  if (!fecha) return null;
  const fechaOperacion = String(d["Fecha de la operación"] ?? "");
  return {
    id,
    fecha_reporte: fecha,
    moneda: String(d.Moneda ?? ""),
    operador: String(d.Operador || "Desconocido"),
    jugador: String(d.Jugador ?? ""),
    alias: String(d.Alias ?? ""),
    cantidad: Number(d.Cantidad) || 0,
    nivel: String(d.Nivel ?? ""),
    fecha_operacion: fechaOperacion,
    update_date: String(d["Update date"] ?? ""),
    hora: horaDe(fechaOperacion),
    tiempo: Number(d.Tiempo) || 0,
    cumple: d.Cumple === true,
  };
}

export function filaHistorial(id: string, d: Record<string, unknown>): FilaHistorial | null {
  const fecha = diaDeReporte(d.fechaReporte);
  if (!fecha) return null;
  return {
    id,
    fecha_reporte: fecha,
    moneda: String(d.moneda ?? ""),
    subido_el: isoOEpoca(d.subidoEl),
    subido_por: String(d.subidoPor ?? ""),
    total_registros: Number(d.totalRegistros) || 0,
  };
}

/** El id de `observaciones_diarias` es "MONEDA_YYYY-MM-DD". */
export function filaObservacion(id: string, d: Record<string, unknown>): FilaObservacion | null {
  const m = id.match(/^([A-Z]+)_(\d{4}-\d{2}-\d{2})$/);
  if (!m || !esDia(m[2])) return null;
  return {
    moneda: m[1],
    fecha: m[2],
    observacion: String(d.observacion ?? ""),
    fecha_actualizacion: isoOEpoca(d.fechaActualizacion),
  };
}
