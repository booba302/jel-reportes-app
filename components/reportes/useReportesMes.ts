"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  collection,
  getDocs,
  query,
  where,
  type QuerySnapshot,
} from "firebase/firestore";
import { addMonths, getDaysInMonth } from "date-fns";
import { FirebaseError } from "firebase/app";
import { db } from "@/lib/firebase";
import { parseMesStr, toMesStr } from "./fechas";

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
  const desde = `${mes}-01T00:00:00.000Z`;
  const hasta = `${toMesStr(addMonths(parseMesStr(mes), 1))}-01T00:00:00.000Z`;

  let snap: QuerySnapshot;
  try {
    snap = await getDocs(
      query(
        collection(db, "historial_reportes"),
        where("moneda", "==", currency),
        where("fechaReporte", ">=", desde),
        where("fechaReporte", "<", hasta),
      ),
    );
  } catch (err) {
    // Sin el índice compuesto (moneda + fechaReporte) Firestore responde
    // "failed-precondition" con el enlace para crearlo. Mientras tanto se usa
    // la consulta anterior (toda la moneda) y se filtra en memoria.
    if (!(err instanceof FirebaseError) || err.code !== "failed-precondition")
      throw err;
    console.warn(
      "Falta el índice historial_reportes (moneda + fechaReporte). Créalo desde este enlace:",
      err.message,
    );
    snap = await getDocs(
      query(
        collection(db, "historial_reportes"),
        where("moneda", "==", currency),
      ),
    );
  }

  const data: HistorialReporte[] = [];
  snap.forEach((d) => {
    const r = d.data() as HistorialReporte;
    if (r.fechaReporte >= desde && r.fechaReporte < hasta)
      data.push({ ...r, id: r.id ?? d.id });
  });
  return data;
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
