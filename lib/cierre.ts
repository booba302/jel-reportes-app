// Cálculo del cierre mensual (§19.4): SLA y tiempo exactos, sin Autopago ni exonerados.

import { normalizarNombre, notaDe, type Evaluacion } from "@/lib/evaluacion";

export interface RankingFila {
  puesto: number;
  operador: string;
  diasTrabajados: number;
  totalRetiros: number;
  retirosEvaluables: number;
  retirosCumplidos: number;
  slaPromedio: number; // %
  tiempoPromedio: number; // min
  puntualidadPromedio: number;
  proactividadPromedio: number;
  notaFinalPromedio: number; // 2 decimales
  inconvenientes: number;
  turnosIncompletos: number;
  /** Puesto en el mes anterior (null = primer mes en el ranking). */
  puestoAnterior: number | null;
}

export interface MetricasMes {
  totalOps: number;
  retirosEvaluables: number;
  retirosCumplidos: number;
  slaGlobal: number;
  tiempoGlobal: number;
  notaPromedio: number;
  operadores: number;
}

export interface HistorialCierre {
  accion: "cierre" | "reapertura";
  por: string;
  porUid: string;
  el: string;
  motivo?: string;
  snapshotAnterior?: {
    metrics: MetricasMes;
    ranking: RankingFila[];
    cerradoEl: string;
    cerradoPor: string;
  };
}

export interface CierreMensual {
  mes: string;
  grupo: string;
  estado: "cerrado" | "reabierto";
  cerradoEl: string | null;
  cerradoPor: string | null;
  cerradoPorUid: string | null;
  metrics: MetricasMes;
  ranking: RankingFila[];
  excluidos: string[];
  historial: HistorialCierre[];
}

export type DiaPendiente = { fecha: string; pendientes: number };

export type ResultadoCierre = {
  ranking: RankingFila[];
  metrics: MetricasMes;
  /** Días con evaluaciones (para el paso 2). */
  diasTotales: number;
  diasConfirmados: number;
  diasPendientes: DiaPendiente[];
};

const r1 = (n: number) => Math.round(n * 10) / 10;
const r2 = (n: number) => Math.round(n * 100) / 100;

/** Conteos exactos del día; respaldo para evaluaciones antiguas sin los campos nuevos. */
export function conteosDe(ev: Evaluacion) {
  const evaluables =
    ev.retirosEvaluables ?? Math.max(0, (ev.totalRetiros || 0) - (ev.exonerados ?? 0));
  const cumplidos =
    ev.retirosCumplidos ?? Math.round(((ev.cumplimientoSlaPct || 0) / 100) * evaluables);
  const tiempoTot = ev.tiempoTotalMin ?? (ev.tiempoPromedioMin || 0) * evaluables;
  return { evaluables, cumplidos, tiempoTot };
}

/** Orden del ranking: nota desc → SLA desc → retiros desc. */
const ordenRanking = (a: RankingFila, b: RankingFila) =>
  b.notaFinalPromedio - a.notaFinalPromedio ||
  b.slaPromedio - a.slaPromedio ||
  b.totalRetiros - a.totalRetiros;

/**
 * Ranking y métricas del mes a partir de las evaluaciones diarias.
 * `excluidos`: nombres normalizados. `rankingAnterior`: para ▲▼.
 */
export function calcularCierre(
  diarias: Evaluacion[],
  excluidos: Set<string>,
  rankingAnterior?: RankingFila[] | null,
): ResultadoCierre {
  type Acc = {
    operador: string;
    dias: number;
    total: number;
    ev: number;
    cum: number;
    tiempo: number;
    punt: number;
    proac: number;
    nota: number;
    inc: number;
    incompletos: number;
  };
  const porOp = new Map<string, Acc>();
  const porDia = new Map<string, { total: number; confirmados: number }>();

  for (const ev of diarias) {
    if (excluidos.has(normalizarNombre(ev.operador ?? ""))) continue;

    const fecha = String(ev.fecha).slice(0, 10);
    const d = porDia.get(fecha) ?? { total: 0, confirmados: 0 };
    d.total++;
    if (ev.estado === "Confirmado") d.confirmados++;
    porDia.set(fecha, d);

    const a = porOp.get(ev.operador) ?? {
      operador: ev.operador,
      dias: 0,
      total: 0,
      ev: 0,
      cum: 0,
      tiempo: 0,
      punt: 0,
      proac: 0,
      nota: 0,
      inc: 0,
      incompletos: 0,
    };
    const c = conteosDe(ev);
    a.dias++;
    a.total += ev.totalRetiros || 0;
    a.ev += c.evaluables;
    a.cum += c.cumplidos;
    a.tiempo += c.tiempoTot;
    a.punt += Number(ev.puntualidad) || 0;
    a.proac += Number(ev.proactividad) || 0;
    // Confirmadas: nota guardada. Pendientes (preliminar): nota con sus valores actuales.
    a.nota += notaDe(ev);
    if (ev.tuvoInconveniente) a.inc++;
    if (!ev.completoTurno) a.incompletos++;
    porOp.set(ev.operador, a);
  }

  const puestosAnteriores = new Map(
    (rankingAnterior ?? []).map((f) => [normalizarNombre(f.operador), f.puesto]),
  );

  const ranking = [...porOp.values()]
    .map<RankingFila>((a) => ({
      puesto: 0,
      operador: a.operador,
      diasTrabajados: a.dias,
      totalRetiros: a.total,
      retirosEvaluables: a.ev,
      retirosCumplidos: a.cum,
      slaPromedio: a.ev ? r1((a.cum / a.ev) * 100) : 0,
      tiempoPromedio: a.ev ? r1(a.tiempo / a.ev) : 0,
      puntualidadPromedio: r1(a.punt / a.dias),
      proactividadPromedio: r1(a.proac / a.dias),
      notaFinalPromedio: r2(a.nota / a.dias),
      inconvenientes: a.inc,
      turnosIncompletos: a.incompletos,
      puestoAnterior: puestosAnteriores.get(normalizarNombre(a.operador)) ?? null,
    }))
    .sort(ordenRanking)
    .map((f, i) => ({ ...f, puesto: i + 1 }));

  const totalOps = ranking.reduce((s, f) => s + f.totalRetiros, 0);
  const ev = ranking.reduce((s, f) => s + f.retirosEvaluables, 0);
  const cum = ranking.reduce((s, f) => s + f.retirosCumplidos, 0);
  const tiempo = [...porOp.values()].reduce((s, a) => s + a.tiempo, 0);

  const metrics: MetricasMes = {
    totalOps,
    retirosEvaluables: ev,
    retirosCumplidos: cum,
    slaGlobal: ev ? r1((cum / ev) * 100) : 0,
    tiempoGlobal: ev ? r1(tiempo / ev) : 0,
    notaPromedio: ranking.length
      ? r2(ranking.reduce((s, f) => s + f.notaFinalPromedio, 0) / ranking.length)
      : 0,
    operadores: ranking.length,
  };

  const dias = [...porDia.entries()].sort((x, y) => x[0].localeCompare(y[0]));
  return {
    ranking,
    metrics,
    diasTotales: dias.length,
    diasConfirmados: dias.filter(([, d]) => d.total === d.confirmados).length,
    diasPendientes: dias
      .filter(([, d]) => d.total !== d.confirmados)
      .map(([fecha, d]) => ({ fecha, pendientes: d.total - d.confirmados })),
  };
}

/**
 * Normaliza un cierre guardado (los antiguos guardaban SLA y tiempo como string,
 * no tienen `estado`, `historial`, `notaPromedio` ni `puestoAnterior`).
 */
export function normalizarCierre(raw: Record<string, unknown>): CierreMensual {
  const ranking = ((raw.ranking as Partial<RankingFila>[] | undefined) ?? []).map(
    (f, i) => ({
      puesto: f.puesto ?? i + 1,
      operador: String(f.operador ?? ""),
      diasTrabajados: Number(f.diasTrabajados) || 0,
      totalRetiros: Number(f.totalRetiros) || 0,
      retirosEvaluables: Number(f.retirosEvaluables) || 0,
      retirosCumplidos: Number(f.retirosCumplidos) || 0,
      slaPromedio: Number(f.slaPromedio) || 0,
      tiempoPromedio: Number(f.tiempoPromedio) || 0,
      puntualidadPromedio: Number(f.puntualidadPromedio) || 0,
      proactividadPromedio: Number(f.proactividadPromedio) || 0,
      notaFinalPromedio: Number(f.notaFinalPromedio) || 0,
      inconvenientes: Number(f.inconvenientes) || 0,
      turnosIncompletos: Number(f.turnosIncompletos) || 0,
      puestoAnterior: f.puestoAnterior === undefined ? null : f.puestoAnterior,
    }),
  );
  const m = (raw.metrics as Record<string, unknown> | undefined) ?? {};
  return {
    mes: String(raw.mes ?? ""),
    grupo: String(raw.grupo ?? ""),
    estado: raw.estado === "reabierto" ? "reabierto" : "cerrado",
    cerradoEl: (raw.cerradoEl as string | null) ?? null,
    cerradoPor: (raw.cerradoPor as string | null) ?? null,
    cerradoPorUid: (raw.cerradoPorUid as string | null) ?? null,
    metrics: {
      totalOps: Number(m.totalOps) || 0,
      retirosEvaluables: Number(m.retirosEvaluables) || 0,
      retirosCumplidos: Number(m.retirosCumplidos) || 0,
      slaGlobal: Number(m.slaGlobal) || 0,
      tiempoGlobal: Number(m.tiempoGlobal) || 0,
      notaPromedio:
        Number(m.notaPromedio) ||
        (ranking.length
          ? r2(ranking.reduce((s, f) => s + f.notaFinalPromedio, 0) / ranking.length)
          : 0),
      operadores: Number(m.operadores) || ranking.length,
    },
    ranking,
    excluidos: (raw.excluidos as string[] | undefined) ?? [],
    historial: (raw.historial as HistorialCierre[] | undefined) ?? [],
  };
}

/** Puestos que subió (+) o bajó (−); null si es su primer mes. */
export const movimiento = (f: RankingFila) =>
  f.puestoAnterior == null ? null : f.puestoAnterior - f.puesto;

/**
 * Ranking y métricas vigentes de un mes: la foto guardada si está cerrado;
 * si no, el cálculo en vivo. Los cierres antiguos (sin `excluidos`) se filtran
 * con la lista actual y su ▲▼ se completa con el ranking anterior.
 */
export function vigenteDelMes({
  diariasMes,
  excluidos,
  rankingAnterior,
  raw,
}: {
  diariasMes: Evaluacion[];
  excluidos: Set<string>;
  rankingAnterior: RankingFila[] | null;
  /** Documento de `evaluaciones_mensuales` tal como viene de Firestore (o null). */
  raw: Record<string, unknown> | null;
}) {
  const vivo = calcularCierre(diariasMes, excluidos, rankingAnterior);
  const documento = raw ? normalizarCierre(raw) : null;
  const cerrado = documento?.estado === "cerrado";
  let ranking = vivo.ranking;
  let metrics = vivo.metrics;

  if (cerrado && documento) {
    ranking = documento.ranking;
    metrics = documento.metrics;
    if (raw && !("excluidos" in raw)) {
      const previo = new Map(
        (rankingAnterior ?? []).map((f) => [normalizarNombre(f.operador), f.puesto]),
      );
      ranking = ranking
        .filter((f) => !excluidos.has(normalizarNombre(f.operador)))
        .map((f, i) => ({
          ...f,
          puesto: i + 1,
          puestoAnterior: previo.get(normalizarNombre(f.operador)) ?? null,
        }));
    }
  }
  return { cerrado, ranking, metrics, vivo, documento };
}
