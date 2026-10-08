"use client";

import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/apiFetch";
import { aTupla, deTupla, type OpMonitor, type Tupla } from "@/lib/monitor";

// Caché por mes cerrado (no cambia). "monitor2": las tuplas viejas no traen n.
const clave = (mes: string) => `monitor2:${mes}`;

function leerCache(mes: string): OpMonitor[] | null {
  try {
    const raw = sessionStorage.getItem(clave(mes));
    return raw ? (JSON.parse(raw) as Tupla[]).map(deTupla) : null;
  } catch {
    return null;
  }
}

function guardarCache(mes: string, ops: OpMonitor[]) {
  try {
    sessionStorage.setItem(clave(mes), JSON.stringify(ops.map(aTupla)));
  } catch {
    // Sin espacio o almacenamiento bloqueado: se vuelve a consultar la próxima vez.
  }
}

async function consultarMes(mes: string): Promise<OpMonitor[]> {
  const { ops } = await apiFetch<{ ops: OpMonitor[] }>(`/api/monitor?mes=${mes}`);
  return ops;
}

async function cargarMes(mes: string, cerrado: boolean) {
  if (cerrado) {
    const c = leerCache(mes);
    if (c) return c;
  }
  const ops = await consultarMes(mes);
  if (cerrado) guardarCache(mes, ops);
  return ops;
}

type Resultado =
  | { key: string; ok: true; actual: OpMonitor[]; anterior: OpMonitor[] }
  | { key: string; ok: false };

/** Retiros del mes y del anterior (en paralelo). `intento` fuerza un reintento. */
export function useMonitor(mes: string, mesAnterior: string, mesActual: string, intento: number) {
  const key = `${mes}|${intento}`;
  const [res, setRes] = useState<Resultado | null>(null);

  useEffect(() => {
    let cancelado = false;
    Promise.all([cargarMes(mes, mes < mesActual), cargarMes(mesAnterior, mesAnterior < mesActual)])
      .then(([actual, anterior]) => {
        if (!cancelado) setRes({ key, ok: true, actual, anterior });
      })
      .catch((err) => {
        console.error("Error al cargar el monitor regional:", err);
        if (!cancelado) setRes({ key, ok: false });
      });
    return () => {
      cancelado = true;
    };
  }, [key, mes, mesAnterior, mesActual]);

  const vigente = res?.key === key ? res : null;
  return {
    cargando: !vigente,
    error: vigente ? !vigente.ok : false,
    actual: vigente?.ok ? vigente.actual : null,
    anterior: vigente?.ok ? vigente.anterior : null,
  };
}
