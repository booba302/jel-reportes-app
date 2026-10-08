import {
  SLA_META_PCT,
  SLA_RIESGO,
  TIEMPO_META_MIN,
  TIEMPO_RIESGO,
} from "@/lib/constants";
import { formatDecimal } from "@/lib/format";

/** Monitor regional (§21): cálculos puros, sin Firestore. */

export const MONEDAS = ["CLP", "PEN", "MXN", "USD", "VES"] as const;
export type Moneda = (typeof MONEDAS)[number];

export const PAIS_MONEDA: Record<Moneda, string> = {
  CLP: "Chile",
  PEN: "Perú",
  MXN: "México",
  USD: "Dólar",
  VES: "Venezuela",
};

/** Supuesto de la lectura de la franja crítica: se recuperan 6 de cada 10 brechas. */
export const RECUPERACION_ESTIMADA = 0.6;

/** Grupo de retiros iguales (lo que manda la API y se guarda en caché). */
export type OpMonitor = {
  dia: number; // día del mes del reporte
  hora: number | null; // hora de la operación (0–23); solo viene en brechas
  moneda: Moneda;
  autopago: boolean;
  vip: boolean;
  cumple: boolean;
  tiempo: number; // suma de minutos del grupo
  exonerado: boolean;
  n: number; // cantidad de retiros del grupo
};

/** Forma compacta de una celda para la caché de sessionStorage. */
export type Tupla = [number, number, number, 0 | 1, 0 | 1, 0 | 1, number, 0 | 1, number];

export const aTupla = (o: OpMonitor): Tupla => [
  o.dia,
  o.hora ?? -1,
  MONEDAS.indexOf(o.moneda),
  o.autopago ? 1 : 0,
  o.vip ? 1 : 0,
  o.cumple ? 1 : 0,
  o.tiempo,
  o.exonerado ? 1 : 0,
  o.n,
];

export const deTupla = (t: Tupla): OpMonitor => ({
  dia: t[0],
  hora: t[1] < 0 ? null : t[1],
  moneda: MONEDAS[t[2]],
  autopago: t[3] === 1,
  vip: t[4] === 1,
  cumple: t[5] === 1,
  tiempo: t[6],
  exonerado: t[7] === 1,
  n: t[8],
});

export type Seg = {
  total: number;
  autopago: number;
  exonerados: number;
  evaluables: number;
  cumplidos: number;
  tiempoTotal: number;
  brechas: number;
  brechasHora: number[];
};

export type DiaSeg = Seg & { dia: number; sla: number | null; tiempo: number | null };
export type MonedaAgg = { mes: Seg; dias: DiaSeg[] };
export type MesAgg = Partial<Record<Moneda, MonedaAgg>>;

export const segVacio = (): Seg => ({
  total: 0,
  autopago: 0,
  exonerados: 0,
  evaluables: 0,
  cumplidos: 0,
  tiempoTotal: 0,
  brechas: 0,
  brechasHora: Array(24).fill(0),
});

export const slaDe = (s: Seg) => (s.evaluables ? (s.cumplidos / s.evaluables) * 100 : null);
export const tiempoDe = (s: Seg) => (s.evaluables ? s.tiempoTotal / s.evaluables : null);

function sumarEn(a: Seg, op: OpMonitor) {
  a.total += op.n;
  if (op.autopago) {
    a.autopago += op.n;
    return;
  }
  if (op.exonerado) {
    a.exonerados += op.n;
    return;
  }
  a.evaluables += op.n;
  a.tiempoTotal += op.tiempo;
  if (op.cumple) a.cumplidos += op.n;
  else {
    a.brechas += op.n;
    if (op.hora != null && op.hora >= 0 && op.hora < 24) a.brechasHora[op.hora] += op.n;
  }
}

/** Suma conteos (el SLA regional sale de los conteos, no del promedio de porcentajes). */
export function sumarSegs(segs: Seg[]): Seg {
  const t = segVacio();
  for (const s of segs) {
    t.total += s.total;
    t.autopago += s.autopago;
    t.exonerados += s.exonerados;
    t.evaluables += s.evaluables;
    t.cumplidos += s.cumplidos;
    t.tiempoTotal += s.tiempoTotal;
    t.brechas += s.brechas;
    s.brechasHora.forEach((n, h) => (t.brechasHora[h] += n));
  }
  return t;
}

/**
 * Agrega el mes por moneda y por día. `limiteDia` corta el mes (comparar el mes
 * en curso contra los mismos días del anterior). Las monedas sin retiros no aparecen.
 */
export function agregarMes(
  ops: OpMonitor[],
  soloVip: boolean,
  diasDelMes: number,
  limiteDia?: number,
): MesAgg {
  const out: MesAgg = {};
  for (const op of ops) {
    if (soloVip && !op.vip) continue;
    if (limiteDia != null && op.dia > limiteDia) continue;
    if (op.dia < 1 || op.dia > diasDelMes) continue;
    let m = out[op.moneda];
    if (!m) {
      m = {
        mes: segVacio(),
        dias: Array.from({ length: diasDelMes }, (_, i) => ({
          ...segVacio(),
          dia: i + 1,
          sla: null,
          tiempo: null,
        })),
      };
      out[op.moneda] = m;
    }
    sumarEn(m.mes, op);
    sumarEn(m.dias[op.dia - 1], op);
  }
  for (const m of Object.values(out)) {
    for (const d of m!.dias) {
      d.sla = slaDe(d);
      d.tiempo = tiempoDe(d);
    }
  }
  return out;
}

/** Monedas con retiros, en el orden fijo CLP, PEN, MXN, USD, VES. */
export const monedasDe = (agg: MesAgg) => MONEDAS.filter((m) => agg[m]);

/** Último día con retiros en el mes (cualquier moneda). */
export function ultimoDiaConDatos(ops: OpMonitor[], soloVip = false) {
  let max = 0;
  for (const op of ops) if ((!soloVip || op.vip) && op.dia > max) max = op.dia;
  return max;
}

/** Ventana de 3 horas consecutivas con más brechas; empate → la más temprana. */
export function franjaCritica(brechasHora: number[]) {
  let mejor: { inicio: number; brechas: number } | null = null;
  for (let h = 0; h <= 21; h++) {
    const n = brechasHora[h] + brechasHora[h + 1] + brechasHora[h + 2];
    if (n > 0 && (!mejor || n > mejor.brechas)) mejor = { inicio: h, brechas: n };
  }
  return mejor;
}

export const textoFranja = (f: { inicio: number } | null) =>
  f ? `${String(f.inicio).padStart(2, "0")}–${String(f.inicio + 3).padStart(2, "0")} h` : "—";

export type Estado = "Bajo meta" | "En riesgo" | "En meta";

export function estadoMoneda(sla: number | null, tiempo: number | null): Estado {
  const s = sla ?? 100;
  const t = tiempo ?? 0;
  if (s < SLA_META_PCT || t > TIEMPO_META_MIN) return "Bajo meta";
  if (s < SLA_RIESGO || t > TIEMPO_RIESGO) return "En riesgo";
  return "En meta";
}

const GRAVEDAD: Record<Estado, number> = { "Bajo meta": 2, "En riesgo": 1, "En meta": 0 };

/** La moneda con peor estado; si empatan, la de menor SLA. */
export function peorMoneda(
  filas: { moneda: Moneda; estado: Estado; sla: number | null }[],
): Moneda | null {
  let peor: (typeof filas)[number] | null = null;
  for (const f of filas) {
    if (
      !peor ||
      GRAVEDAD[f.estado] > GRAVEDAD[peor.estado] ||
      (GRAVEDAD[f.estado] === GRAVEDAD[peor.estado] && (f.sla ?? 100) < (peor.sla ?? 100))
    )
      peor = f;
  }
  return peor?.moneda ?? null;
}

/** Texto de lectura de la franja crítica de una moneda. */
export function lecturaFranja(moneda: Moneda, s: Seg) {
  const f = franjaCritica(s.brechasHora);
  if (!f || !s.brechas || !s.evaluables) return "Sin brechas este mes.";
  const pct = Math.round((f.brechas / s.brechas) * 100);
  const estimado = Math.min(
    100,
    ((s.cumplidos + f.brechas * RECUPERACION_ESTIMADA) / s.evaluables) * 100,
  );
  const hh = String(f.inicio).padStart(2, "0");
  const fin = String(f.inicio + 3).padStart(2, "0");
  const recuperadas = Math.round(RECUPERACION_ESTIMADA * 10);
  return (
    `El ${pct}% de las brechas de ${moneda} (${f.brechas} de ${s.brechas}) ocurre entre ${hh}:00 y ${fin}:00. ` +
    `Reforzar esa franja y recuperar ${recuperadas} de cada 10 de esas brechas llevaría el SLA de ${moneda} a ~${formatDecimal(estimado)}%.`
  );
}

export type DiaCritico = DiaSeg & { moneda: Moneda; sla: number };

/** Los `n` días-moneda con menor SLA (a igual SLA, más brechas primero). */
export function diasCriticos(agg: MesAgg, n = 5): DiaCritico[] {
  const todos: DiaCritico[] = [];
  for (const m of monedasDe(agg))
    for (const d of agg[m]!.dias) if (d.sla != null) todos.push({ ...d, moneda: m, sla: d.sla });
  return todos.sort((a, b) => a.sla - b.sla || b.brechas - a.brechas).slice(0, n);
}

/** Color del mapa de calor: ≥ 90 / 80–89,9 / < 80 / sin datos. */
export type NivelCelda = "buena" | "revisar" | "mala" | "vacio";
export const nivelCelda = (sla: number | null): NivelCelda =>
  sla == null ? "vacio" : sla >= SLA_META_PCT ? "buena" : sla >= 80 ? "revisar" : "mala";

/** "+1,2 pts", "-0,8 min", "=" (variaciones de la tabla y el PDF). */
export function delta(n: number | null, unidad: string, dec = 1) {
  if (n == null) return "—";
  if (Math.abs(n) < 0.05) return "=";
  return `${n > 0 ? "+" : "-"}${formatDecimal(Math.abs(n), dec)}${unidad ? ` ${unidad}` : ""}`;
}

export type FilaMoneda = {
  moneda: Moneda;
  pais: string;
  seg: Seg;
  sla: number | null;
  tiempo: number | null;
  estado: Estado;
  /** Variación contra el mes anterior (null si no hubo retiros de esa moneda). */
  dSla: number | null;
  dTiempo: number | null;
  dias: DiaSeg[];
  franja: { inicio: number; brechas: number } | null;
  pctTotal: number;
  pctAutopago: number;
};

export type ModeloMonitor = {
  diasDelMes: number;
  enCurso: boolean;
  /** Días con datos en el mes en curso (el límite de la comparación). */
  diasConDatos: number;
  filas: FilaMoneda[];
  total: Seg;
  sla: number | null;
  tiempo: number | null;
  previo: { total: Seg; sla: number | null; tiempo: number | null; bajoMeta: number } | null;
  bajoMeta: Moneda[];
  criticos: DiaCritico[];
};

const resta = (a: number | null, b: number | null) => (a == null || b == null ? null : a - b);

/**
 * Todo lo que muestran la página y el PDF. El mes en curso se compara contra
 * los mismos días del mes anterior; un mes cerrado, contra el anterior completo.
 */
export function armarModelo({
  actual,
  anterior,
  soloVip,
  diasDelMes,
  diasMesAnterior,
  enCurso,
}: {
  actual: OpMonitor[];
  anterior: OpMonitor[];
  soloVip: boolean;
  diasDelMes: number;
  diasMesAnterior: number;
  enCurso: boolean;
}): ModeloMonitor {
  const agg = agregarMes(actual, soloVip, diasDelMes);
  const diasConDatos = ultimoDiaConDatos(actual, soloVip);
  const aggPrev = agregarMes(anterior, soloVip, diasMesAnterior, enCurso ? diasConDatos : undefined);

  const monedas = monedasDe(agg);
  const total = sumarSegs(monedas.map((m) => agg[m]!.mes));
  const filas: FilaMoneda[] = monedas.map((m) => {
    const { mes: s, dias } = agg[m]!;
    const p = aggPrev[m]?.mes;
    const sla = slaDe(s);
    const tiempo = tiempoDe(s);
    return {
      moneda: m,
      pais: PAIS_MONEDA[m],
      seg: s,
      sla,
      tiempo,
      estado: estadoMoneda(sla, tiempo),
      dSla: p ? resta(sla, slaDe(p)) : null,
      dTiempo: p ? resta(tiempo, tiempoDe(p)) : null,
      dias,
      franja: franjaCritica(s.brechasHora),
      pctTotal: total.total ? (s.total / total.total) * 100 : 0,
      pctAutopago: s.total ? (s.autopago / s.total) * 100 : 0,
    };
  });

  const monedasPrev = monedasDe(aggPrev);
  const totalPrev = sumarSegs(monedasPrev.map((m) => aggPrev[m]!.mes));
  const previo = totalPrev.total
    ? {
        total: totalPrev,
        sla: slaDe(totalPrev),
        tiempo: tiempoDe(totalPrev),
        bajoMeta: monedasPrev.filter((m) => {
          const s = aggPrev[m]!.mes;
          return estadoMoneda(slaDe(s), tiempoDe(s)) === "Bajo meta";
        }).length,
      }
    : null;

  return {
    diasDelMes,
    enCurso,
    diasConDatos,
    filas,
    total,
    sla: slaDe(total),
    tiempo: tiempoDe(total),
    previo,
    bajoMeta: filas.filter((f) => f.estado === "Bajo meta").map((f) => f.moneda),
    criticos: diasCriticos(agg),
  };
}
