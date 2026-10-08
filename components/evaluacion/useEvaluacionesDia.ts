"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  arrayUnion,
  collection,
  doc,
  getDocs,
  query,
  updateDoc,
  where,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { calcularPuntajeFinal, veGrupo, type Evaluacion } from "@/lib/evaluacion";
import type { ParsedRole } from "@/lib/roles";
import { fechaISO } from "./consultas";

type Resultado =
  | { key: string; ok: true; evals: Evaluacion[] }
  | { key: string; ok: false };

/** Campos editables de una evaluación pendiente (viven en memoria hasta confirmar). */
export type Borrador = Partial<
  Pick<
    Evaluacion,
    | "puntualidad"
    | "proactividad"
    | "completoTurno"
    | "tuvoInconveniente"
    | "comentarioInconveniente"
  >
>;

const normalizar = (raw: Evaluacion): Evaluacion => ({
  ...raw,
  puntualidad: Number(raw.puntualidad) || 0,
  proactividad: Number(raw.proactividad) || 0,
  comentarioInconveniente: raw.comentarioInconveniente ?? "",
});

/** Evaluaciones del día (filtradas por grupo y excluidos) con borradores en memoria. */
export function useEvaluacionesDia({
  dia,
  rol,
  esExcluido,
  usuario,
}: {
  dia: string; // "YYYY-MM-DD"
  rol: ParsedRole;
  esExcluido: (nombre: string) => boolean;
  usuario: string;
}) {
  const [version, setVersion] = useState(0);
  const [resultado, setResultado] = useState<Resultado | null>(null);
  const [borradores, setBorradores] = useState<Record<string, Borrador>>({});
  const key = `${dia}|${version}`;

  useEffect(() => {
    let cancelado = false;
    getDocs(query(collection(db, "evaluaciones_desempeno"), where("fecha", "==", fechaISO(dia))))
      .then((snap) => {
        const evals = snap.docs.map((d) => normalizar({ ...(d.data() as Evaluacion), id: d.id }));
        if (!cancelado) setResultado({ key, ok: true, evals });
      })
      .catch((err) => {
        console.error("Error cargando evaluaciones:", err);
        if (!cancelado) setResultado({ key, ok: false });
      });
    return () => {
      cancelado = true;
    };
  }, [key, dia]);

  // Al recargar (version) se siguen mostrando los datos anteriores del mismo día.
  const vigente =
    resultado?.ok && resultado.key.startsWith(`${dia}|`) ? resultado.evals : null;

  const evaluaciones = useMemo(() => {
    if (!vigente) return null;
    return vigente
      .filter((ev) => veGrupo(rol, ev.grupoMoneda) && !esExcluido(ev.operador))
      .map((ev) =>
        ev.estado === "Pendiente" && borradores[ev.id]
          ? { ...ev, ...borradores[ev.id] }
          : ev,
      )
      .sort((a, b) => a.operador.localeCompare(b.operador));
  }, [vigente, rol, esExcluido, borradores]);

  const actualizar = useCallback((id: string, patch: Borrador) => {
    setBorradores((b) => ({ ...b, [id]: { ...b[id], ...patch } }));
  }, []);

  const enMemoria = useCallback((id: string, patch: Partial<Evaluacion>) => {
    setResultado((r) =>
      r?.ok
        ? { ...r, evals: r.evals.map((ev) => (ev.id === id ? { ...ev, ...patch } : ev)) }
        : r,
    );
  }, []);

  const confirmar = useCallback(
    async (ev: Evaluacion) => {
      const cambios = {
        puntualidad: ev.puntualidad,
        proactividad: ev.proactividad,
        completoTurno: ev.completoTurno,
        tuvoInconveniente: ev.tuvoInconveniente,
        comentarioInconveniente: ev.tuvoInconveniente
          ? ev.comentarioInconveniente.trim()
          : "",
        puntajeFinal: calcularPuntajeFinal(ev),
        estado: "Confirmado" as const,
        confirmadoEl: new Date().toISOString(),
        confirmadoPor: usuario,
      };
      await updateDoc(doc(db, "evaluaciones_desempeno", ev.id), cambios);
      enMemoria(ev.id, cambios);
      setBorradores((b) => {
        const next = { ...b };
        delete next[ev.id];
        return next;
      });
      return cambios.puntajeFinal;
    },
    [usuario, enMemoria],
  );

  const reabrir = useCallback(
    async (ev: Evaluacion) => {
      const reapertura = { por: usuario, el: new Date().toISOString() };
      await updateDoc(doc(db, "evaluaciones_desempeno", ev.id), {
        estado: "Pendiente",
        reaperturas: arrayUnion(reapertura),
      });
      enMemoria(ev.id, {
        estado: "Pendiente",
        reaperturas: [...(ev.reaperturas ?? []), reapertura],
      });
    },
    [usuario, enMemoria],
  );

  return {
    evaluaciones,
    cargando: !vigente && !(resultado?.key === key && !resultado.ok),
    error: resultado?.key === key && !resultado.ok,
    /** Hay pendientes con cambios sin confirmar. */
    hayBorradores: Object.keys(borradores).length > 0,
    actualizar,
    confirmar,
    reabrir,
    recargar: useCallback(() => setVersion((v) => v + 1), []),
  };
}
