"use client";

import { useEffect, useMemo, useState } from "react";
import { differenceInCalendarDays, format, subDays } from "date-fns";
import { es } from "date-fns/locale";
import type { DateRange } from "react-day-picker";
import { apiFetch } from "@/lib/apiFetch";
import { capitalizar } from "@/lib/format";
import { toDateStr, type Vista } from "@/lib/dashboard";

export type { NivelKey, NivelRow, OperadorRow, Punto, Resumen, Vista } from "@/lib/dashboard";

// ---------------------------------------------------------------------------
// Tipos
// ---------------------------------------------------------------------------

export type DateFilter =
  | "current_month"
  | "last_month"
  | "last_3_months"
  | "all_time"
  | "custom";

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
        const hasta = periodo.currEnd < now ? periodo.currEnd : now;
        const qs = new URLSearchParams({
          moneda: currency,
          desde: toDateStr(periodo.currStart),
          hasta: toDateStr(periodo.currEnd),
          prevDesde: toDateStr(periodo.prevStart),
          prevHasta: toDateStr(periodo.prevEnd),
          serieHasta: toDateStr(hasta),
          historico: periodo.esHistorico ? "1" : "0",
        });
        const { todos, vip } = await apiFetch<{ todos: Vista; vip: Vista }>(`/api/dashboard?${qs}`);
        if (!cancelado) setResultado({ key, ok: true, todos, vip });
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
