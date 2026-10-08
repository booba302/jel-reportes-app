"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { doc, onSnapshot, setDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { normalizarNombre } from "@/lib/evaluacion";

const ref = () => doc(db, "configuracion", "evaluacion");

/** Lista manual de operadores excluidos (`configuracion/evaluacion`). */
export function useExcluidos(actualizadoPor: string) {
  const [lista, setLista] = useState<string[] | null>(null);

  useEffect(
    () =>
      onSnapshot(
        ref(),
        (snap) => setLista((snap.data()?.operadoresExcluidos as string[]) ?? []),
        (err) => {
          console.error("Error leyendo operadores excluidos:", err);
          setLista([]);
        },
      ),
    [],
  );

  const set = useMemo(
    () => new Set((lista ?? []).map(normalizarNombre)),
    [lista],
  );

  const guardar = useCallback(
    (operadoresExcluidos: string[]) =>
      setDoc(
        ref(),
        {
          operadoresExcluidos,
          actualizadoEl: new Date().toISOString(),
          actualizadoPor,
        },
        { merge: true },
      ),
    [actualizadoPor],
  );

  return {
    /** null mientras carga. */
    lista,
    cargando: lista === null,
    esExcluido: useCallback((nombre: string) => set.has(normalizarNombre(nombre)), [set]),
    agregar: useCallback(
      (nombre: string) => guardar([...(lista ?? []), nombre.trim().replace(/\s+/g, " ")]),
      [lista, guardar],
    ),
    quitar: useCallback(
      (nombre: string) =>
        guardar(
          (lista ?? []).filter((n) => normalizarNombre(n) !== normalizarNombre(nombre)),
        ),
      [lista, guardar],
    ),
  };
}
