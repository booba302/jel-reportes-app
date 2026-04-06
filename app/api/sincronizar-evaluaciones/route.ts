// src/app/api/sincronizar-global/route.ts
import { NextResponse } from "next/server";
import {
  collection,
  query,
  where,
  getDocs,
  writeBatch,
  doc,
} from "firebase/firestore";
import { db } from "@/lib/firebase";

const JEFES_EXCLUIDOS = ["Franklin Sanchez", "Marvin", "Evelyn"];

const calcularPuntajeSLA = (porcentaje: number) => {
  if (porcentaje >= 100) return 10;
  if (porcentaje <= 0) return 0;
  return Number((porcentaje / 10).toFixed(1));
};

const calcularPuntajeTiempo = (minutos: number) => {
  if (minutos > 0 && minutos <= 10) return 10;
  if (minutos > 10 && minutos <= 15) return 9;
  if (minutos > 15 && minutos <= 20) return 8;
  if (minutos > 20 && minutos <= 25) return 7;
  if (minutos > 25 && minutos <= 30) return 6;
  if (minutos > 30 && minutos <= 35) return 5;
  if (minutos > 35 && minutos <= 40) return 4;
  if (minutos > 40 && minutos <= 45) return 3;
  return 0;
};

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { fecha, rol } = body;

    if (!fecha) {
      return NextResponse.json(
        { success: false, error: "La fecha es requerida" },
        { status: 400 },
      );
    }

    // Definición de monedas por rol
    let monedasPermitidas: string[] = [];
    if (rol === "agente_retiros_internacional") {
      monedasPermitidas = ["CLP", "PEN", "USD", "MXN"];
    } else if (rol === "agente_retiros_nacional") {
      monedasPermitidas = ["VES"];
    } else {
      monedasPermitidas = ["CLP", "PEN", "USD", "MXN", "VES"];
    }

    const start = `${fecha}T00:00:00.000Z`;
    const end = `${fecha}T23:59:59.999Z`;

    const qOps = query(
      collection(db, "operaciones_retiros"),
      where("Fecha del reporte", ">=", start),
      where("Fecha del reporte", "<=", end),
    );

    const snapOps = await getDocs(qOps);
    const agtMap: Record<
      string,
      {
        total: number;
        cumple: number;
        tiempoTotal: number;
        monedaPrincipal: string;
      }
    > = {};

    snapOps.forEach((docItem) => {
      const data = docItem.data();
      const op = data.Operador || "Desconocido";
      const moneda = data.Moneda || "";

      // 🔴 FILTROS: Jefes, Autopagos y Monedas según Rol
      if (JEFES_EXCLUIDOS.includes(op)) return;
      if (op.toLowerCase().includes("autopago")) return;
      if (!monedasPermitidas.includes(moneda)) return;

      if (!agtMap[op]) {
        agtMap[op] = {
          total: 0,
          cumple: 0,
          tiempoTotal: 0,
          monedaPrincipal: moneda,
        };
      }

      agtMap[op].total++;
      agtMap[op].tiempoTotal += Number(data.Tiempo) || 0;
      if (data.Cumple === true) agtMap[op].cumple++;
    });

    const batch = writeBatch(db);
    let procesados = 0;

    for (const op of Object.keys(agtMap)) {
      const metrics = agtMap[op];
      const slaPct =
        metrics.total > 0 ? (metrics.cumple / metrics.total) * 100 : 0;
      const avgTime =
        metrics.total > 0 ? metrics.tiempoTotal / metrics.total : 0;

      const idUnico = `${fecha}_${op.replace(/\s+/g, "_")}`;
      const docRef = doc(db, "evaluaciones_desempeno", idUnico);

      // Determinar grupo para el filtrado en la vista
      const grupo = metrics.monedaPrincipal === "VES" ? "nacional" : "inter";

      batch.set(
        docRef,
        {
          id: idUnico,
          fecha: `${fecha}T00:00:00.000Z`,
          operador: op,
          totalRetiros: metrics.total,
          cumplimientoSlaPct: Number(slaPct.toFixed(1)),
          tiempoPromedioMin: Number(avgTime.toFixed(1)),
          puntajeSla: calcularPuntajeSLA(slaPct),
          puntajeTiempo: calcularPuntajeTiempo(avgTime),
          grupoMoneda: grupo, // Campo clave para el filtrado visual
          estado: "Pendiente",
          completoTurno: true,
          tuvoInconveniente: false,
          comentarioInconveniente: "",
          puntualidad: 10,
          proactividad: 10,
        },
        { merge: true },
      );

      procesados++;
    }

    await batch.commit();
    return NextResponse.json({
      success: true,
      mensaje: `Sincronizados ${procesados} operadores.`,
    });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: "Error interno" },
      { status: 500 },
    );
  }
}
