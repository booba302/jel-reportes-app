"use client";

import { useEffect, useMemo, useState } from "react";
import { collection, query, where, getDocs } from "firebase/firestore";
import {
  addDays,
  differenceInCalendarDays,
  format,
  startOfMonth,
  startOfWeek,
  subDays,
} from "date-fns";
import { es } from "date-fns/locale";
import type { DateRange } from "react-day-picker";
import { db } from "@/lib/firebase";
import { isExonerated } from "@/lib/utils";
import { VIP_LEVELS } from "@/lib/constants";
import { capitalizar } from "@/lib/format";

// ---------------------------------------------------------------------------
// Tipos
// ---------------------------------------------------------------------------

export type DateFilter =
  | "current_month"
  | "last_month"
  | "last_3_months"
  | "all_time"
  | "custom";

type Retiro = {
  fecha: string; // YYYY-MM-DD
  Cumple?: boolean;
  Tiempo?: number | string;
  Cantidad?: number | string;
  Operador?: string;
  Nivel?: string;
  comentarioBrecha?: string;
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

export type Periodo = {
  currStart: Date;
  currEnd: Date;
  prevStart: Date;
  prevEnd: Date;
  /** "Octubre 2026", "06 oct – 15 oct 2026"… */
  etiqueta: string;
  /** "septiembre", "trimestre anterior"…; null si no hay comparación. */
  etiquetaAnterior: string | null;
  esHistorico: boolean;
};

export type EstadoDashboard =
  | "sin-periodo"
  | "rango-incompleto"
  | "cargando"
  | "sin-datos"
  | "error"
  | "listo";

// ---------------------------------------------------------------------------
// Período
// ---------------------------------------------------------------------------

const toDateStr = (d: Date) => format(d, "yyyy-MM-dd");

const parseDateStr = (s: string) => {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, m - 1, d);
};

const nombreMes = (d: Date) => format(d, "LLLL", { locale: es });

export function textoRango(range: DateRange | undefined): string {
  if (!range?.from) return "Selecciona un rango";
  const desde = format(range.from, "dd MMM", { locale: es });
  if (!range.to || range.to.getTime() === range.from.getTime())
    return `${desde} – …`;
  return `${desde} – ${format(range.to, "dd MMM yyyy", { locale: es })}`;
}

export function rangoCompleto(range: DateRange | undefined) {
  return Boolean(
    range?.from && range?.to && range.from.getTime() !== range.to.getTime(),
  );
}

export function calcularPeriodo(
  filtro: DateFilter | null,
  range: DateRange | undefined,
  now: Date,
): Periodo | null {
  if (!filtro) return null;
  const y = now.getFullYear();
  const m = now.getMonth();

  switch (filtro) {
    case "current_month":
      return {
        currStart: new Date(y, m, 1),
        currEnd: new Date(y, m + 1, 0),
        prevStart: new Date(y, m - 1, 1),
        prevEnd: new Date(y, m, 0),
        etiqueta: capitalizar(format(now, "LLLL yyyy", { locale: es })),
        etiquetaAnterior: nombreMes(new Date(y, m - 1, 1)),
        esHistorico: false,
      };
    case "last_month": {
      const inicio = new Date(y, m - 1, 1);
      return {
        currStart: inicio,
        currEnd: new Date(y, m, 0),
        prevStart: new Date(y, m - 2, 1),
        prevEnd: new Date(y, m - 1, 0),
        etiqueta: capitalizar(format(inicio, "LLLL yyyy", { locale: es })),
        etiquetaAnterior: nombreMes(new Date(y, m - 2, 1)),
        esHistorico: false,
      };
    }
    case "last_3_months": {
      const inicio = new Date(y, m - 2, 1);
      const mismoAnio = inicio.getFullYear() === y;
      const desde = capitalizar(
        format(inicio, mismoAnio ? "LLLL" : "LLLL yyyy", { locale: es }),
      );
      const hasta = capitalizar(format(now, "LLLL yyyy", { locale: es }));
      return {
        currStart: inicio,
        currEnd: new Date(y, m + 1, 0),
        prevStart: new Date(y, m - 5, 1),
        prevEnd: new Date(y, m - 2, 0),
        etiqueta: `${desde} – ${hasta}`,
        etiquetaAnterior: "trimestre anterior",
        esHistorico: false,
      };
    }
    case "all_time":
      return {
        currStart: new Date(2000, 0, 1),
        currEnd: now,
        prevStart: new Date(0),
        prevEnd: new Date(0),
        etiqueta: "Histórico completo",
        etiquetaAnterior: null,
        esHistorico: true,
      };
    case "custom": {
      if (!range?.from || !range?.to || !rangoCompleto(range)) return null;
      const dias = differenceInCalendarDays(range.to, range.from) + 1;
      const prevEnd = subDays(range.from, 1);
      return {
        currStart: range.from,
        currEnd: range.to,
        prevStart: subDays(prevEnd, dias - 1),
        prevEnd,
        etiqueta: textoRango(range),
        etiquetaAnterior: "período anterior",
        esHistorico: false,
      };
    }
  }
}

// ---------------------------------------------------------------------------
// Cálculos puros
// ---------------------------------------------------------------------------

const isVip = (d: Retiro) =>
  (VIP_LEVELS as readonly string[]).includes(String(d.Nivel ?? "").trim());

export function resumir(rows: Retiro[]): Resumen {
  let total = 0,
    exo = 0,
    cum = 0,
    inc = 0,
    t = 0,
    monto = 0,
    auto = 0,
    vip = 0;
  for (const d of rows) {
    total++;
    monto += (Number(d.Cantidad) || 0) / 100;
    if (isVip(d)) vip++;
    // Regla única de SLA: Autopago y exonerados no cuentan para SLA ni tiempo.
    if (d.Operador === "Autopago") {
      auto++;
      continue;
    }
    if (isExonerated(d.comentarioBrecha)) {
      exo++;
      continue;
    }
    t += Number(d.Tiempo) || 0;
    if (d.Cumple === true) cum++;
    else inc++;
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
export function serieDiaria(rows: Retiro[], desde: Date, hasta: Date): Punto[] {
  if (hasta < desde) return [];
  const dias = differenceInCalendarDays(hasta, desde) + 1;
  const agrupacion: Agrupacion =
    dias > 200 ? "mes" : dias > 62 ? "semana" : "dia";

  const acc = new Map<
    string,
    { base: ReturnType<typeof bucketDe>; total: number; cum: number; ev: number }
  >();
  for (let d = desde; d <= hasta; d = addDays(d, 1)) {
    const base = bucketDe(d, agrupacion);
    if (!acc.has(base.clave)) acc.set(base.clave, { base, total: 0, cum: 0, ev: 0 });
  }

  for (const r of rows) {
    const b = acc.get(bucketDe(parseDateStr(r.fecha), agrupacion).clave);
    if (!b) continue;
    b.total++;
    if (r.Operador === "Autopago" || isExonerated(r.comentarioBrecha)) continue;
    b.ev++;
    if (r.Cumple === true) b.cum++;
  }

  return [...acc.values()].map(({ base, total, cum, ev }) => ({
    ...base,
    volumen: total,
    sla: ev ? Math.round((cum / ev) * 1000) / 10 : null,
  }));
}

const NIVELES: NivelKey[] = ["Estándar", "Nivel 2", "Nivel 3", "Nivel 4"];

export function porNivel(rows: Retiro[]): NivelRow[] {
  const cuenta: Record<NivelKey, number> = {
    Estándar: 0,
    "Nivel 2": 0,
    "Nivel 3": 0,
    "Nivel 4": 0,
  };
  for (const r of rows) {
    const n = String(r.Nivel ?? "").trim();
    cuenta[isVip(r) ? (n as NivelKey) : "Estándar"]++;
  }
  return NIVELES.map((nivel) => ({ nivel, cantidad: cuenta[nivel] }));
}

export function porOperador(rows: Retiro[]): OperadorRow[] {
  const map = new Map<
    string,
    { total: number; cum: number; inc: number; ev: number; t: number }
  >();
  for (const r of rows) {
    if (r.Operador === "Autopago") continue;
    const nombre = r.Operador || "Desconocido";
    const o = map.get(nombre) ?? { total: 0, cum: 0, inc: 0, ev: 0, t: 0 };
    o.total++;
    if (!isExonerated(r.comentarioBrecha)) {
      o.ev++;
      o.t += Number(r.Tiempo) || 0;
      if (r.Cumple === true) o.cum++;
      else o.inc++;
    }
    map.set(nombre, o);
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
        a.brechas - b.brechas || b.sla - a.sla || b.retiros - a.retiros,
    );
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

type Resultado =
  | { key: string; ok: true; todos: Vista; vip: Vista }
  | { key: string; ok: false };

export function useDashboardData(
  currency: string,
  dateFilter: DateFilter | null,
  customRange: DateRange | undefined,
) {
  // "Hoy" fijo durante la vida de la página.
  const [now] = useState(() => new Date());
  const [resultado, setResultado] = useState<Resultado | null>(null);

  const periodo = useMemo(
    () => calcularPeriodo(dateFilter, customRange, now),
    [dateFilter, customRange, now],
  );

  const key = periodo
    ? `${currency}|${dateFilter}|${toDateStr(periodo.currStart)}|${toDateStr(periodo.currEnd)}`
    : null;

  useEffect(() => {
    if (!key || !periodo) return;
    let cancelado = false;

    const cargar = async () => {
      try {
        const q =
          currency === "GLOBAL"
            ? query(collection(db, "operaciones_retiros"))
            : query(
                collection(db, "operaciones_retiros"),
                where("Moneda", "==", currency),
              );
        const snapshot = await getDocs(q);

        const currStartStr = toDateStr(periodo.currStart);
        const currEndStr = toDateStr(periodo.currEnd);
        const prevStartStr = toDateStr(periodo.prevStart);
        const prevEndStr = toDateStr(periodo.prevEnd);

        const curr: Retiro[] = [];
        const prev: Retiro[] = [];
        let minFecha: string | null = null;

        snapshot.forEach((doc) => {
          const data = doc.data();
          const fecha = String(data["Fecha del reporte"] ?? "").split("T")[0];
          const row: Retiro = {
            fecha,
            Cumple: data.Cumple,
            Tiempo: data.Tiempo,
            Cantidad: data.Cantidad,
            Operador: data.Operador,
            Nivel: data.Nivel,
            comentarioBrecha: data.comentarioBrecha,
          };

          if (periodo.esHistorico) {
            if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha)) return;
            curr.push(row);
            if (!minFecha || fecha < minFecha) minFecha = fecha;
          } else if (fecha >= currStartStr && fecha <= currEndStr) {
            curr.push(row);
          } else if (fecha >= prevStartStr && fecha <= prevEndStr) {
            prev.push(row);
          }
        });

        const desde =
          periodo.esHistorico && minFecha
            ? parseDateStr(minFecha)
            : periodo.currStart;
        const hasta = periodo.currEnd < now ? periodo.currEnd : now;

        const vista = (soloVip: boolean): Vista => {
          const c = soloVip ? curr.filter(isVip) : curr;
          const p = soloVip ? prev.filter(isVip) : prev;
          return {
            actual: resumir(c),
            anterior: resumir(p),
            diaria: serieDiaria(c, desde, hasta),
            niveles: porNivel(curr), // siempre sobre el total; la card decide qué mostrar
            operadores: porOperador(c),
          };
        };

        if (!cancelado)
          setResultado({ key, ok: true, todos: vista(false), vip: vista(true) });
      } catch (error) {
        console.error("Error cargando métricas:", error);
        if (!cancelado) setResultado({ key, ok: false });
      }
    };

    cargar();
    return () => {
      cancelado = true;
    };
  }, [key, periodo, currency, now]);

  let estado: EstadoDashboard;
  if (!dateFilter) estado = "sin-periodo";
  else if (!periodo) estado = "rango-incompleto";
  else if (!resultado || resultado.key !== key) estado = "cargando";
  else if (!resultado.ok) estado = "error";
  else if (resultado.todos.actual.total === 0) estado = "sin-datos";
  else estado = "listo";

  const data = estado === "listo" && resultado?.ok ? resultado : null;

  return { estado, periodo, data };
}
