"use client";

import { useCallback, useEffect, useState } from "react";
import { collection, getDocs, query, where } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { isExonerated } from "@/lib/utils";
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

    getDocs(
      query(
        collection(db, "operaciones_retiros"),
        where("Moneda", "==", moneda),
        where("Fecha del reporte", "==", fechaReporte),
      ),
    )
      .then((snap) => {
        let exo = 0,
          cumplidos = 0,
          evaluables = 0;
        snap.forEach((d) => {
          const r = d.data();
          if (r.Operador === "Autopago") return; // Autopago no cuenta para el SLA
          if (isExonerated(r.comentarioBrecha)) {
            exo++;
            return;
          }
          evaluables++;
          if (r.Cumple === true) cumplidos++;
        });
        if (!cancelado)
          setCache((c) => ({
            ...c,
            [id]: {
              sla: evaluables ? (cumplidos / evaluables) * 100 : 0,
              exonerados: exo,
            },
          }));
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
