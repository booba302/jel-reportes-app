// Expediente mensual de un operador (§20). Funciona igual en el cliente
// (modo interno) y en el servidor (enlace público) gracias al `Cargador`.

import { addMonths, format, getDaysInMonth } from "date-fns";
import { isExonerated } from "@/lib/utils";
import {
  normalizarNombre,
  notaDe,
  PESOS,
  type Evaluacion,
} from "@/lib/evaluacion";
import { conteosDe, vigenteDelMes, type RankingFila } from "@/lib/cierre";

export type RetiroOperador = {
  Moneda?: string;
  Cumple?: boolean;
  comentarioBrecha?: string;
};

/** Acceso a datos (Firestore cliente o Admin SDK). */
export interface Cargador {
  /** Evaluaciones con `fecha` en [desde, hasta] (ISO). */
  evaluaciones(desde: string, hasta: string): Promise<Evaluacion[]>;
  cierre(id: string): Promise<Record<string, unknown> | null>;
  retirosOperador(operador: string, desde: string, hasta: string): Promise<RetiroOperador[]>;
  excluidos(): Promise<string[]>;
}

export type DiaExpediente = {
  fecha: string; // YYYY-MM-DD
  nota: number;
  estado: Evaluacion["estado"];
  retiros: number;
  sla: number;
  tiempo: number;
  puntualidad: number;
  proactividad: number;
  completoTurno: boolean;
  tuvoInconveniente: boolean;
  comentario: string;
};

export type Criterio = {
  key: "sla" | "tiempo" | "puntualidad" | "proactividad";
  label: string;
  peso: number;
  puntaje: number; // promedio del puntaje diario
  equipo: number;
  aporte: number; // redondeado a 2 decimales (suman la nota)
};

export type ExpedienteData = {
  estado: "ok";
  operador: string;
  mes: string;
  grupo: string; // "Internacional" | "Nacional" | "Global"
  cerrado: boolean;
  /** Solo en modo interno (el enlace público no revela el puesto). */
  ranking?: { puesto: number | null; total: number; puestoAnterior: number | null; nombres: string[] };
  kpis: {
    nota: number;
    sla: number;
    tiempo: number;
    retiros: number;
    dias: number;
    inconvenientes: number;
    turnosIncompletos: number;
  };
  anterior: { nota: number; sla: number; tiempo: number; retiros: number } | null;
  equipo: { nota: number; sla: number; tiempo: number };
  desglose: Criterio[];
  monedas: { moneda: string; retiros: number; sla: number }[];
  dias: DiaExpediente[];
  diasDelMes: number;
  pendientes: number;
};

export type ResultadoExpediente =
  | ExpedienteData
  | { estado: "excluido"; operador: string; mes: string }
  | { estado: "sin-datos"; operador: string; mes: string }
  | { estado: "revision"; operador: string; mes: string };

const r1 = (n: number) => Math.round(n * 10) / 10;
const r2 = (n: number) => Math.round(n * 100) / 100;
const prom = (xs: number[]) => (xs.length ? xs.reduce((s, x) => s + x, 0) / xs.length : 0);

export const inicioMes = (mes: string) => `${mes}-01T00:00:00.000Z`;
export const finMes = (mes: string) => {
  const [y, m] = mes.split("-").map(Number);
  const dias = getDaysInMonth(new Date(y, m - 1, 1));
  return `${mes}-${String(dias).padStart(2, "0")}T23:59:59.999Z`;
};
export const mesAnterior = (mes: string) => {
  const [y, m] = mes.split("-").map(Number);
  return format(addMonths(new Date(y, m - 1, 1), -1), "yyyy-MM");
};

const GRUPOS: Record<string, string> = { inter: "Internacional", nacional: "Nacional" };

/** Métricas de un operador a partir de sus días. */
function metricasOperador(dias: Evaluacion[]) {
  let ev = 0,
    cum = 0,
    t = 0;
  for (const d of dias) {
    const c = conteosDe(d);
    ev += c.evaluables;
    cum += c.cumplidos;
    t += c.tiempoTot;
  }
  return {
    nota: prom(dias.map(notaDe)),
    sla: ev ? (cum / ev) * 100 : 0,
    tiempo: ev ? t / ev : 0,
    retiros: dias.reduce((s, d) => s + (d.totalRetiros || 0), 0),
    ptsSla: prom(dias.map((d) => d.puntajeSla || 0)),
    ptsTiempo: prom(dias.map((d) => d.puntajeTiempo || 0)),
    puntualidad: prom(dias.map((d) => Number(d.puntualidad) || 0)),
    proactividad: prom(dias.map((d) => Number(d.proactividad) || 0)),
  };
}

/** Redondea los aportes a 2 decimales de modo que sumen exactamente la nota redondeada. */
function aportesExactos(valores: number[]) {
  const total = Math.round(valores.reduce((s, v) => s + v, 0) * 100);
  const base = valores.map((v) => Math.floor(v * 100));
  let resto = total - base.reduce((s, v) => s + v, 0);
  const orden = valores
    .map((v, i) => ({ i, frac: v * 100 - Math.floor(v * 100) }))
    .sort((a, b) => b.frac - a.frac);
  for (const { i } of orden) {
    if (resto <= 0) break;
    base[i]++;
    resto--;
  }
  return base.map((v) => v / 100);
}

/** Armado puro del expediente. */
export function armarExpediente({
  operador,
  mes,
  diariasMes,
  excluidos,
  ranking,
  rankingAnterior,
  cerrado,
  retiros,
  grupo,
}: {
  operador: string;
  mes: string;
  diariasMes: Evaluacion[]; // del alcance (grupo), todos los operadores
  excluidos: Set<string>;
  ranking: RankingFila[];
  rankingAnterior: RankingFila[] | null;
  cerrado: boolean;
  retiros: RetiroOperador[];
  grupo: string;
}): ExpedienteData {
  const clave = normalizarNombre(operador);
  const porOp = new Map<string, Evaluacion[]>();
  for (const ev of diariasMes) {
    const k = normalizarNombre(ev.operador ?? "");
    if (excluidos.has(k)) continue;
    porOp.set(k, [...(porOp.get(k) ?? []), ev]);
  }
  const propios = (porOp.get(clave) ?? []).sort((a, b) => a.fecha.localeCompare(b.fecha));
  const m = metricasOperador(propios);

  // Equipo: promedio simple entre operadores.
  const todos = [...porOp.values()].map(metricasOperador);
  const eq = {
    nota: prom(todos.map((x) => x.nota)),
    sla: prom(todos.map((x) => x.sla)),
    tiempo: prom(todos.map((x) => x.tiempo)),
    ptsSla: prom(todos.map((x) => x.ptsSla)),
    ptsTiempo: prom(todos.map((x) => x.ptsTiempo)),
    puntualidad: prom(todos.map((x) => x.puntualidad)),
    proactividad: prom(todos.map((x) => x.proactividad)),
  };

  const puntajes = [m.ptsSla, m.ptsTiempo, m.puntualidad, m.proactividad];
  const pesos = [PESOS.sla, PESOS.tiempo, PESOS.puntualidad, PESOS.proactividad];
  const aportes = aportesExactos(puntajes.map((p, i) => p * pesos[i]));
  const desglose: Criterio[] = (
    [
      ["sla", "SLA", eq.ptsSla],
      ["tiempo", "Tiempo", eq.ptsTiempo],
      ["puntualidad", "Puntualidad", eq.puntualidad],
      ["proactividad", "Proactividad", eq.proactividad],
    ] as const
  ).map(([key, label, equipo], i) => ({
    key,
    label,
    peso: pesos[i],
    puntaje: r2(puntajes[i]),
    equipo: r2(equipo),
    aporte: aportes[i],
  }));

  // SLA por moneda (sin exonerados).
  const mon = new Map<string, { total: number; ev: number; cum: number }>();
  for (const r of retiros) {
    const k = r.Moneda || "—";
    const x = mon.get(k) ?? { total: 0, ev: 0, cum: 0 };
    x.total++;
    if (!isExonerated(r.comentarioBrecha)) {
      x.ev++;
      if (r.Cumple === true) x.cum++;
    }
    mon.set(k, x);
  }
  const monedas = [...mon.entries()]
    .map(([moneda, x]) => ({ moneda, retiros: x.total, sla: x.ev ? r1((x.cum / x.ev) * 100) : 0 }))
    .sort((a, b) => b.sla - a.sla);

  const fila = ranking.find((f) => normalizarNombre(f.operador) === clave) ?? null;
  const filaAnt = rankingAnterior?.find((f) => normalizarNombre(f.operador) === clave) ?? null;

  return {
    estado: "ok",
    operador: propios[0]?.operador ?? operador,
    mes,
    grupo,
    cerrado,
    ranking: {
      puesto: fila?.puesto ?? null,
      total: ranking.length,
      puestoAnterior: fila?.puestoAnterior ?? null,
      nombres: ranking.map((f) => f.operador),
    },
    kpis: {
      nota: r2(aportes.reduce((s, a) => s + a, 0)),
      sla: r1(m.sla),
      tiempo: r1(m.tiempo),
      retiros: m.retiros,
      dias: propios.length,
      inconvenientes: propios.filter((d) => d.tuvoInconveniente).length,
      turnosIncompletos: propios.filter((d) => !d.completoTurno).length,
    },
    anterior: filaAnt
      ? {
          nota: filaAnt.notaFinalPromedio,
          sla: filaAnt.slaPromedio,
          tiempo: filaAnt.tiempoPromedio,
          retiros: filaAnt.totalRetiros,
        }
      : null,
    equipo: { nota: r2(eq.nota), sla: r1(eq.sla), tiempo: r1(eq.tiempo) },
    desglose,
    monedas,
    dias: propios.map((d) => ({
      fecha: String(d.fecha).slice(0, 10),
      nota: r2(notaDe(d)),
      estado: d.estado,
      retiros: d.totalRetiros || 0,
      sla: Number(d.cumplimientoSlaPct) || 0,
      tiempo: Number(d.tiempoPromedioMin) || 0,
      puntualidad: Number(d.puntualidad) || 0,
      proactividad: Number(d.proactividad) || 0,
      completoTurno: d.completoTurno !== false,
      tuvoInconveniente: Boolean(d.tuvoInconveniente),
      comentario: d.comentarioInconveniente ?? "",
    })),
    diasDelMes: Number(finMes(mes).slice(8, 10)),
    pendientes: propios.filter((d) => d.estado === "Pendiente").length,
  };
}

/** Grupo mayoritario de las evaluaciones del operador ("inter" | "nacional"). */
function grupoDe(evs: Evaluacion[]) {
  const c: Record<string, number> = {};
  for (const e of evs) if (e.grupoMoneda) c[e.grupoMoneda] = (c[e.grupoMoneda] ?? 0) + 1;
  return Object.entries(c).sort((a, b) => b[1] - a[1])[0]?.[0] ?? "inter";
}

/**
 * Carga y arma el expediente.
 * - interno: el alcance (grupo e id del cierre) lo decide el rol de quien mira.
 * - publico: se usa el cierre del grupo del operador (o el global) y debe estar cerrado.
 */
export async function construirExpediente(
  cargar: Cargador,
  {
    operador,
    mes,
    alcance,
  }: {
    operador: string;
    mes: string;
    alcance:
      | { modo: "interno"; idCierre: (mes: string) => string; incluye: (grupo?: string) => boolean }
      | { modo: "publico" };
  },
): Promise<ResultadoExpediente> {
  const listaExcluidos = await cargar.excluidos();
  const excluidos = new Set(listaExcluidos.map(normalizarNombre));
  if (excluidos.has(normalizarNombre(operador))) return { estado: "excluido", operador, mes };

  const prev = mesAnterior(mes);
  const [evalsMes, evalsPrev] = await Promise.all([
    cargar.evaluaciones(inicioMes(mes), finMes(mes)),
    cargar.evaluaciones(inicioMes(prev), finMes(prev)),
  ]);
  const clave = normalizarNombre(operador);
  const propios = evalsMes.filter((e) => normalizarNombre(e.operador ?? "") === clave);
  if (propios.length === 0) return { estado: "sin-datos", operador, mes };

  // Alcance: qué cierre y qué evaluaciones forman el ranking.
  let idCierre: (m: string) => string;
  let incluye: (g?: string) => boolean;
  let grupo: string;
  let rawMes: Record<string, unknown> | null;

  if (alcance.modo === "interno") {
    ({ idCierre, incluye } = alcance);
    const g = grupoDe(propios);
    grupo = GRUPOS[g] ?? g;
    rawMes = await cargar.cierre(idCierre(mes));
  } else {
    const g = grupoDe(propios);
    const delGrupo = await cargar.cierre(`${mes}_${g}`);
    const cerradoGrupo = delGrupo && delGrupo.estado !== "reabierto";
    const global = cerradoGrupo ? null : await cargar.cierre(mes);
    const cerradoGlobal = global && global.estado !== "reabierto";
    if (!cerradoGrupo && !cerradoGlobal) return { estado: "revision", operador, mes };
    if (cerradoGrupo) {
      idCierre = (m) => `${m}_${g}`;
      incluye = (x) => x === g;
      grupo = GRUPOS[g] ?? g;
      rawMes = delGrupo;
    } else {
      idCierre = (m) => m;
      incluye = () => true;
      grupo = "Global";
      rawMes = global;
    }
  }

  const rawPrev = await cargar.cierre(idCierre(prev));
  const vPrev = vigenteDelMes({
    diariasMes: evalsPrev.filter((e) => incluye(e.grupoMoneda)),
    excluidos,
    rankingAnterior: null,
    raw: rawPrev,
  });
  const diariasMes = evalsMes.filter((e) => incluye(e.grupoMoneda));
  const vMes = vigenteDelMes({
    diariasMes,
    excluidos,
    rankingAnterior: vPrev.ranking,
    raw: rawMes,
  });

  const retiros = await cargar.retirosOperador(propios[0].operador, inicioMes(mes), finMes(mes));

  const data = armarExpediente({
    operador,
    mes,
    diariasMes,
    excluidos,
    ranking: vMes.ranking,
    rankingAnterior: vPrev.ranking.length ? vPrev.ranking : null,
    cerrado: vMes.cerrado,
    retiros,
    grupo,
  });

  // El enlace público no revela el puesto ni los nombres del ranking.
  if (alcance.modo === "publico") delete data.ranking;
  return data;
}
