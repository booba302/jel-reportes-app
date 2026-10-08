"use client";

import { useEffect, useMemo, useState } from "react";
import { collection, query, where } from "firebase/firestore";
import { subDays } from "date-fns";
import { db } from "@/lib/firebase";
import { veGrupo, type Evaluacion } from "@/lib/evaluacion";
import type { ParsedRole } from "@/lib/roles";
import { toDiaStr } from "@/components/reportes/fechas";
import { fechaISO, getDocsConRespaldo } from "./consultas";

export type PendienteDia = { fecha: string; cantidad: number };

type Crudo = { fecha: string; operador: string; grupo?: string };

/**
 * Evaluaciones pendientes de los últimos `dias` días (sin contar hoy),
 * agrupadas por fecha, de la más reciente a la más antigua.
 */
export function usePendientesAnteriores({
  rol,
  esExcluido,
  listo,
  version = 0,
  dias = 7,
}: {
  rol: ParsedRole;
  esExcluido: (nombre: string) => boolean;
  /** false mientras no se conozcan el rol y los excluidos. */
  listo: boolean;
  version?: number;
  dias?: number;
}) {
  const [hoy] = useState(() => toDiaStr(new Date()));
  const [resultado, setResultado] = useState<{ key: string; crudos: Crudo[] } | null>(
    null,
  );
  const key = `${hoy}|${dias}|${version}`;

  useEffect(() => {
    if (!listo) return;
    let cancelado = false;
    const desde = fechaISO(toDiaStr(subDays(new Date(`${hoy}T12:00:00`), dias)));
    const hasta = fechaISO(hoy);
    const ref = collection(db, "evaluaciones_desempeno");

    getDocsConRespaldo(
      query(
        ref,
        where("estado", "==", "Pendiente"),
        where("fecha", ">=", desde),
        where("fecha", "<", hasta),
      ),
      query(ref, where("fecha", ">=", desde), where("fecha", "<", hasta)),
      "evaluaciones_desempeno (estado + fecha)",
    )
      .then((snap) => {
        const crudos: Crudo[] = [];
        snap.forEach((d) => {
          const ev = d.data() as Evaluacion;
          if (ev.estado !== "Pendiente") return;
          crudos.push({
            fecha: String(ev.fecha).slice(0, 10),
            operador: ev.operador,
            grupo: ev.grupoMoneda,
          });
        });
        if (!cancelado) setResultado({ key, crudos });
      })
      .catch((err) => console.error("Error buscando evaluaciones pendientes:", err));

    return () => {
      cancelado = true;
    };
  }, [key, listo, hoy, dias]);

  const pendientes = useMemo<PendienteDia[] | null>(() => {
    if (!resultado) return null;
    const porFecha = new Map<string, number>();
    for (const c of resultado.crudos) {
      if (!veGrupo(rol, c.grupo) || esExcluido(c.operador)) continue;
      porFecha.set(c.fecha, (porFecha.get(c.fecha) ?? 0) + 1);
    }
    return [...porFecha.entries()]
      .map(([fecha, cantidad]) => ({ fecha, cantidad }))
      .sort((a, b) => b.fecha.localeCompare(a.fecha));
  }, [resultado, rol, esExcluido]);

  return { pendientes, hoy };
}
