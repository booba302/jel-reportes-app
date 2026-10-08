"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { getDaysInMonth } from "date-fns";
import { apiFetch } from "@/lib/apiFetch";
import { parseMesStr } from "./fechas";

export type HistorialReporte = {
  id: string;
  fechaReporte: string; // "2026-08-24T00:00:00.000Z"
  moneda: string;
  totalRegistros?: number;
  subidoPor?: string;
  subidoEl: string;
};

export type EstadoDia = "cargado" | "faltante" | "en-curso" | "no-disponible";

export type DiaInfo = {
  dia: string; // "YYYY-MM-DD"
  numero: number;
  estado: EstadoDia;
  historial: HistorialReporte | null;
};

type Resultado =
  | { key: string; ok: true; historial: HistorialReporte[] }
  | { key: string; ok: false };

async function consultarMes(currency: string, mes: string) {
  const { historial } = await apiFetch<{ historial: HistorialReporte[] }>(
    `/api/reportes/mes?moneda=${encodeURIComponent(currency)}&mes=${mes}`,
  );
  return historial;
}

/** Historial del mes, estado de cada día y pendientes por cargar. */
export function useReportesMes(currency: string, mes: string, hoy: string) {
  const [version, setVersion] = useState(0);
  const [resultado, setResultado] = useState<Resultado | null>(null);

  const key = `${currency}|${mes}|${version}`;

  useEffect(() => {
    let cancelado = false;
    consultarMes(currency, mes)
      .then((historial) => {
        if (!cancelado) setResultado({ key, ok: true, historial });
      })
      .catch((err) => {
        console.error("Error obteniendo historial:", err);
        if (!cancelado) setResultado({ key, ok: false });
      });
    return () => {
      cancelado = true;
    };
  }, [key, currency, mes]);

  const cargando = !resultado || resultado.key !== key;
  // Mientras recarga (version), se siguen mostrando los datos anteriores del mismo mes.
  const vigente =
    resultado?.ok && resultado.key.startsWith(`${currency}|${mes}|`)
      ? resultado.historial
      : null;
  const error = !cargando && resultado?.ok === false;

  const dias = useMemo<DiaInfo[] | null>(() => {
    if (!vigente) return null;
    const porDia = new Map(vigente.map((h) => [h.fechaReporte.slice(0, 10), h]));
    const total = getDaysInMonth(parseMesStr(mes));
    return Array.from({ length: total }, (_, i) => {
      const dia = `${mes}-${String(i + 1).padStart(2, "0")}`;
      const historial = porDia.get(dia) ?? null;
      const estado: EstadoDia =
        dia > hoy
          ? "no-disponible"
          : dia === hoy
            ? "en-curso"
            : historial
              ? "cargado"
              : "faltante";
      return { dia, numero: i + 1, estado, historial };
    });
  }, [vigente, mes, hoy]);

  const recargar = useCallback(() => setVersion((v) => v + 1), []);

  return {
    dias,
    /** true solo en la primera carga del mes (no al recargar). */
    cargandoMes: cargando && !dias,
    error,
    recargar,
  };
}
