"use client";

import { useCallback, useEffect, useState } from "react";
import { apiFetch } from "@/lib/apiFetch";
import type { HistorialReporte } from "./useReportesMes";

export type DetalleDia = { sla: number; exonerados: number };

/** SLA del día (sin Autopago ni exonerados), calculado bajo demanda y cacheado por id. */
export function useDiaDetalle(historial: HistorialReporte | null) {
  const [cache, setCache] = useState<Record<string, DetalleDia | "error">>({});
  const id = historial?.id;
  const moneda = historial?.moneda;
  const fechaReporte = historial?.fechaReporte;
  const enCache = id ? cache[id] : undefined;

  useEffect(() => {
    if (!id || !moneda || !fechaReporte || enCache) return;
    let cancelado = false;

    apiFetch<DetalleDia>(
      `/api/reportes/dia?moneda=${encodeURIComponent(moneda)}&fecha=${fechaReporte.slice(0, 10)}`,
    )
      .then(({ sla, exonerados }) => {
        if (!cancelado) setCache((c) => ({ ...c, [id]: { sla, exonerados } }));
      })
      .catch((err) => {
        console.error("Error calculando SLA del día:", err);
        if (!cancelado) setCache((c) => ({ ...c, [id]: "error" }));
      });

    return () => {
      cancelado = true;
    };
  }, [id, moneda, fechaReporte, enCache]);

  const invalidar = useCallback((idDia: string) => {
    setCache((c) => {
      if (!(idDia in c)) return c;
      const next = { ...c };
      delete next[idDia];
      return next;
    });
  }, []);

  return {
    detalle: enCache && enCache !== "error" ? enCache : null,
    cargando: Boolean(id) && !enCache,
    error: enCache === "error",
    invalidar,
  };
}
