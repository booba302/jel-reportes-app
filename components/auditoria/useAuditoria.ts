"use client";

import { useCallback, useEffect, useState } from "react";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  setDoc,
  updateDoc,
  where,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import type { OperacionRow } from "./calculos";

type Resultado =
  | { key: string; ok: true; ops: OperacionRow[]; nota: string }
  | { key: string; ok: false };

async function cargarDia(currency: string, fecha: string) {
  const snapshot = await getDocs(
    query(
      collection(db, "operaciones_retiros"),
      where("Fecha del reporte", "==", `${fecha}T00:00:00.000Z`),
      where("Moneda", "==", currency),
    ),
  );

  const ops: OperacionRow[] = [];
  snapshot.forEach((d) => {
    const data = d.data();
    const dateStr = String(data["Fecha de la operación"]);
    ops.push({
      id: d.id,
      hora: dateStr.includes(" ") ? dateStr.split(" ")[1] : "00:00:00",
      alias: data.Alias ?? "",
      cantidad: Number(data.Cantidad) || 0,
      tiempo: Number(data.Tiempo) || 0,
      cumple: data.Cumple === true,
      operador: data.Operador || "Desconocido",
      nivel: data.Nivel || "Estándar",
      comentarioBrecha: data.comentarioBrecha || "",
    });
  });
  ops.sort((a, b) => a.hora.localeCompare(b.hora));

  const obs = await getDoc(doc(db, "observaciones_diarias", `${currency}_${fecha}`));
  const nota: string = obs.exists() ? obs.data().observacion || "" : "";

  return { ops, nota };
}

/** Retiros y nota de un día; las ediciones se reflejan en memoria sin reconsultar. */
export function useAuditoria(currency: string, fecha: string) {
  const [resultado, setResultado] = useState<Resultado | null>(null);
  const key = `${currency}|${fecha}`;

  useEffect(() => {
    let cancelado = false;
    cargarDia(currency, fecha)
      .then(({ ops, nota }) => {
        if (!cancelado) setResultado({ key, ok: true, ops, nota });
      })
      .catch((err) => {
        console.error("Error cargando reporte diario:", err);
        if (!cancelado) setResultado({ key, ok: false });
      });
    return () => {
      cancelado = true;
    };
  }, [key, currency, fecha]);

  const vigente = resultado?.key === key ? resultado : null;

  /** Guarda el comentario de brecha y actualiza la fila en memoria. */
  const guardarComentario = useCallback(async (id: string, valor: string) => {
    await updateDoc(doc(db, "operaciones_retiros", id), { comentarioBrecha: valor });
    setResultado((r) =>
      r?.ok
        ? {
            ...r,
            ops: r.ops.map((op) =>
              op.id === id ? { ...op, comentarioBrecha: valor } : op,
            ),
          }
        : r,
    );
  }, []);

  const guardarNota = useCallback(
    async (observacion: string) => {
      await setDoc(
        doc(db, "observaciones_diarias", `${currency}_${fecha}`),
        { observacion, fechaActualizacion: new Date().toISOString() },
        { merge: true },
      );
      setResultado((r) => (r?.ok && r.key === key ? { ...r, nota: observacion } : r));
    },
    [currency, fecha, key],
  );

  return {
    cargando: !vigente,
    error: vigente?.ok === false,
    ops: vigente?.ok ? vigente.ops : null,
    nota: vigente?.ok ? vigente.nota : "",
    guardarComentario,
    guardarNota,
  };
}
