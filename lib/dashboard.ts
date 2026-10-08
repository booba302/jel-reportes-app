import { addDays, differenceInCalendarDays, format, startOfMonth, startOfWeek } from "date-fns";
import { es } from "date-fns/locale";
import { VIP_LEVELS } from "@/lib/constants";
import { capitalizar } from "@/lib/format";

/** Cálculos del dashboard sobre celdas: grupos de retiros iguales que arma Postgres. */

/** Grupo de retiros iguales en todo lo que mira el dashboard. `tiempo` y `monto` son sumas. */
export type Celda = {
  fecha: string; // YYYY-MM-DD
  operador: string;
  nivel: string;
  cumple: boolean;
  exonerado: boolean;
  n: number;
  tiempo: number;
  monto: number;
};

export type Resumen = {
  total: number;
  exonerados: number;
  evaluables: number;
  cumplidos: number;
  incumplidos: number;
  sla: number;
  tiempo: number;
  monto: number;
  autopago: number;
  automatizacion: number;
  vipTotal: number;
};

export type Punto = {
  clave: string;
  dia: string; // rótulo del eje X
  etiqueta: string; // rótulo del tooltip
  volumen: number;
  sla: number | null;
};

export type NivelKey = "Estándar" | "Nivel 2" | "Nivel 3" | "Nivel 4";
export type NivelRow = { nivel: NivelKey; cantidad: number };

export type OperadorRow = {
  nombre: string;
  retiros: number;
  brechas: number;
  tiempo: number;
  sla: number;
};

export type Vista = {
  actual: Resumen;
  anterior: Resumen;
  diaria: Punto[];
  niveles: NivelRow[];
  operadores: OperadorRow[];
};

export const toDateStr = (d: Date) => format(d, "yyyy-MM-dd");

export const parseDateStr = (s: string) => {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, m - 1, d);
};

const esVip = (c: Celda) => (VIP_LEVELS as readonly string[]).includes(c.nivel.trim());
const esAutopago = (c: Celda) => c.operador === "Autopago";

export function resumir(celdas: Celda[]): Resumen {
  let total = 0,
    exo = 0,
    cum = 0,
    inc = 0,
    t = 0,
    monto = 0,
    auto = 0,
    vip = 0;
  for (const c of celdas) {
    total += c.n;
    monto += c.monto / 100;
    if (esVip(c)) vip += c.n;
    // Regla única de SLA: Autopago y exonerados no cuentan para SLA ni tiempo.
    if (esAutopago(c)) {
      auto += c.n;
      continue;
    }
    if (c.exonerado) {
      exo += c.n;
      continue;
    }
    t += c.tiempo;
    if (c.cumple) cum += c.n;
    else inc += c.n;
  }
  const ev = cum + inc; // manuales no exonerados
  return {
    total,
    exonerados: exo,
    evaluables: ev,
    cumplidos: cum,
    incumplidos: inc,
    sla: ev ? (cum / ev) * 100 : 0,
    tiempo: ev ? t / ev : 0,
    monto,
    autopago: auto,
    automatizacion: total ? (auto / total) * 100 : 0,
    vipTotal: vip,
  };
}

type Agrupacion = "dia" | "semana" | "mes";

function bucketDe(d: Date, agrupacion: Agrupacion) {
  if (agrupacion === "semana") {
    const s = startOfWeek(d, { weekStartsOn: 1 });
    const txt = format(s, "dd MMM", { locale: es });
    return { clave: toDateStr(s), dia: `sem ${txt}`, etiqueta: `Semana del ${txt}` };
  }
  if (agrupacion === "mes") {
    const s = startOfMonth(d);
    return {
      clave: format(s, "yyyy-MM"),
      dia: format(s, "MMM yy", { locale: es }),
      etiqueta: capitalizar(format(s, "LLLL yyyy", { locale: es })),
    };
  }
  return {
    clave: toDateStr(d),
    dia: format(d, "dd"),
    etiqueta: format(d, "dd MMM", { locale: es }),
  };
}

/** Agrupa por día (o semana/mes en rangos largos) y rellena los huecos. */
export function serieDiaria(celdas: Celda[], desde: Date, hasta: Date): Punto[] {
  if (hasta < desde) return [];
  const dias = differenceInCalendarDays(hasta, desde) + 1;
  const agrupacion: Agrupacion = dias > 200 ? "mes" : dias > 62 ? "semana" : "dia";

  const acc = new Map<
    string,
    { base: ReturnType<typeof bucketDe>; total: number; cum: number; ev: number }
  >();
  for (let d = desde; d <= hasta; d = addDays(d, 1)) {
    const base = bucketDe(d, agrupacion);
    if (!acc.has(base.clave)) acc.set(base.clave, { base, total: 0, cum: 0, ev: 0 });
  }

  for (const c of celdas) {
    const b = acc.get(bucketDe(parseDateStr(c.fecha), agrupacion).clave);
    if (!b) continue;
    b.total += c.n;
    if (esAutopago(c) || c.exonerado) continue;
    b.ev += c.n;
    if (c.cumple) b.cum += c.n;
  }

  return [...acc.values()].map(({ base, total, cum, ev }) => ({
    ...base,
    volumen: total,
    sla: ev ? Math.round((cum / ev) * 1000) / 10 : null,
  }));
}

const NIVELES: NivelKey[] = ["Estándar", "Nivel 2", "Nivel 3", "Nivel 4"];

export function porNivel(celdas: Celda[]): NivelRow[] {
  const cuenta: Record<NivelKey, number> = {
    Estándar: 0,
    "Nivel 2": 0,
    "Nivel 3": 0,
    "Nivel 4": 0,
  };
  for (const c of celdas) cuenta[esVip(c) ? (c.nivel.trim() as NivelKey) : "Estándar"] += c.n;
  return NIVELES.map((nivel) => ({ nivel, cantidad: cuenta[nivel] }));
}

export function porOperador(celdas: Celda[]): OperadorRow[] {
  const map = new Map<string, { total: number; cum: number; inc: number; ev: number; t: number }>();
  for (const c of celdas) {
    if (esAutopago(c)) continue;
    const o = map.get(c.operador) ?? { total: 0, cum: 0, inc: 0, ev: 0, t: 0 };
    o.total += c.n;
    if (!c.exonerado) {
      o.ev += c.n;
      o.t += c.tiempo;
      if (c.cumple) o.cum += c.n;
      else o.inc += c.n;
    }
    map.set(c.operador, o);
  }
  return [...map.entries()]
    .map(([nombre, o]) => ({
      nombre,
      retiros: o.total,
      brechas: o.inc,
      tiempo: o.ev ? o.t / o.ev : 0,
      sla: o.ev ? (o.cum / o.ev) * 100 : 0,
    }))
    .sort(
      (a, b) =>
        a.brechas - b.brechas ||
        b.sla - a.sla ||
        b.retiros - a.retiros ||
        a.nombre.localeCompare(b.nombre), // empates: orden estable
    );
}

/** Las dos vistas del dashboard (todas y solo VIP). */
export function armarVistas(curr: Celda[], prev: Celda[], desde: Date, hasta: Date) {
  const vista = (soloVip: boolean): Vista => {
    const c = soloVip ? curr.filter(esVip) : curr;
    const p = soloVip ? prev.filter(esVip) : prev;
    return {
      actual: resumir(c),
      anterior: resumir(p),
      diaria: serieDiaria(c, desde, hasta),
      niveles: porNivel(curr), // siempre sobre el total; la card decide qué mostrar
      operadores: porOperador(c),
    };
  };
  return { todos: vista(false), vip: vista(true) };
}
