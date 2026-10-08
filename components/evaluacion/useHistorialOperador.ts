"use client";

import { useEffect, useState } from "react";
import { collection, query, where } from "firebase/firestore";
import { addDays, format } from "date-fns";
import { es } from "date-fns/locale";
import { db } from "@/lib/firebase";
import { notaDe, type Evaluacion } from "@/lib/evaluacion";
import { parseDiaStr, toDiaStr } from "@/components/reportes/fechas";
import { fechaISO, getDocsConRespaldo } from "./consultas";

export type PuntoNota = { dia: string; etiqueta: string; nota: number | null };

export type Historial = {
  puntos: PuntoNota[]; // ventana actual (N días, el último es el día seleccionado)
  promedio: number | null;
  promedioAnterior: number | null;
  diasBajo6: number;
};

const promedio = (xs: (number | null)[]) => {
  const v = xs.filter((x): x is number => x !== null);
  return v.length ? v.reduce((s, x) => s + x, 0) / v.length : null;
};

/** Nota diaria del operador en los últimos N días (+ N previos para comparar). */
export function useHistorialOperador(
  operador: string | null,
  dia: string,
  n: 7 | 30,
  /** Cambia cuando se confirma/reabre, para refrescar el día actual. */
  version: number,
) {
  const [cache, setCache] = useState<Record<string, Historial | "error">>({});
  const key = operador ? `${operador}|${n}|${dia}|${version}` : null;
  const enCache = key ? cache[key] : undefined;

  useEffect(() => {
    if (!operador || !key || enCache) return;
    let cancelado = false;

    const fin = parseDiaStr(dia);
    const desde = toDiaStr(addDays(fin, -(2 * n - 1)));
    const ref = collection(db, "evaluaciones_desempeno");

    getDocsConRespaldo(
      query(
        ref,
        where("operador", "==", operador),
        where("fecha", ">=", fechaISO(desde)),
        where("fecha", "<=", fechaISO(dia)),
      ),
      query(ref, where("operador", "==", operador)),
      "evaluaciones_desempeno (operador + fecha)",
    )
      .then((snap) => {
        const porDia = new Map<string, number>();
        snap.forEach((d) => {
          const ev = d.data() as Evaluacion;
          const f = String(ev.fecha).slice(0, 10);
          if (f >= desde && f <= dia) porDia.set(f, notaDe(ev));
        });
        const dias = Array.from({ length: 2 * n }, (_, i) =>
          toDiaStr(addDays(fin, -(2 * n - 1) + i)),
        );
        const anteriores = dias.slice(0, n).map((d) => porDia.get(d) ?? null);
        const puntos = dias.slice(n).map((d) => ({
          dia: d,
          etiqueta: format(parseDiaStr(d), "d MMM", { locale: es }),
          nota: porDia.get(d) ?? null,
        }));
        const h: Historial = {
          puntos,
          promedio: promedio(puntos.map((p) => p.nota)),
          promedioAnterior: promedio(anteriores),
          diasBajo6: puntos.filter((p) => p.nota !== null && p.nota < 6).length,
        };
        if (!cancelado) setCache((c) => ({ ...c, [key]: h }));
      })
      .catch((err) => {
        console.error("Error cargando historial del operador:", err);
        if (!cancelado) setCache((c) => ({ ...c, [key]: "error" }));
      });

    return () => {
      cancelado = true;
    };
  }, [operador, key, enCache, dia, n]);

  return {
    historial: enCache && enCache !== "error" ? enCache : null,
    cargando: Boolean(key) && !enCache,
    error: enCache === "error",
  };
}
