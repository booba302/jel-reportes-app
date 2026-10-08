"use client";

import { useEffect, useState } from "react";
import { collection, getDocs, query, where } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { isExonerated } from "@/lib/utils";
import { VIP_LEVELS } from "@/lib/constants";
import { MONEDAS, type Moneda, type OpMonitor } from "@/lib/monitor";

// Caché por mes cerrado (no cambia): tuplas compactas para no pasar el límite de sessionStorage.
type Tupla = [number, number, number, 0 | 1, 0 | 1, 0 | 1, number, 0 | 1];
const clave = (mes: string) => `monitor:${mes}`;

const aTupla = (o: OpMonitor): Tupla => [
  o.dia,
  o.hora ?? -1,
  MONEDAS.indexOf(o.moneda),
  o.autopago ? 1 : 0,
  o.vip ? 1 : 0,
  o.cumple ? 1 : 0,
  o.tiempo,
  o.exonerado ? 1 : 0,
];
const deTupla = (t: Tupla): OpMonitor => ({
  dia: t[0],
  hora: t[1] < 0 ? null : t[1],
  moneda: MONEDAS[t[2]],
  autopago: t[3] === 1,
  vip: t[4] === 1,
  cumple: t[5] === 1,
  tiempo: t[6],
  exonerado: t[7] === 1,
});

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
  const snap = await getDocs(
    query(
      collection(db, "operaciones_retiros"),
      where("Fecha del reporte", ">=", `${mes}-01T00:00:00.000Z`),
      where("Fecha del reporte", "<=", `${mes}-31T23:59:59.999Z`),
    ),
  );
  const ops: OpMonitor[] = [];
  snap.forEach((d) => {
    const data = d.data();
    const moneda = data.Moneda as Moneda;
    if (!MONEDAS.includes(moneda)) return;
    const hora = Number(String(data["Fecha de la operación"] ?? "").split(" ")[1]?.slice(0, 2));
    ops.push({
      dia: Number(String(data["Fecha del reporte"]).slice(8, 10)),
      hora: Number.isFinite(hora) ? hora : null,
      moneda,
      autopago: data.Operador === "Autopago",
      vip: (VIP_LEVELS as readonly string[]).includes(String(data.Nivel ?? "").trim()),
      cumple: data.Cumple === true,
      tiempo: Number(data.Tiempo) || 0,
      exonerado: isExonerated(data.comentarioBrecha),
    });
  });
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
