"use client";

import { useCallback, useEffect, useState } from "react";
import { apiFetch } from "@/lib/apiFetch";
import type { OperacionRow } from "./calculos";

type Resultado =
  | { key: string; ok: true; ops: OperacionRow[]; nota: string }
  | { key: string; ok: false };

function cargarDia(currency: string, fecha: string) {
  return apiFetch<{ ops: OperacionRow[]; nota: string }>(
    `/api/auditoria?moneda=${encodeURIComponent(currency)}&fecha=${fecha}`,
  );
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
    await apiFetch("/api/auditoria/comentario", {
      method: "PATCH",
      body: JSON.stringify({ id, comentario: valor }),
    });
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
      await apiFetch("/api/auditoria/nota", {
        method: "PUT",
        body: JSON.stringify({ moneda: currency, fecha, observacion }),
      });
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
