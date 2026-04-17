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
  // 🔴 CORRECCIÓN: Se agrega >= 0 por si un operador tiene todos sus retiros exonerados
  if (minutos >= 0 && minutos <= 10) return 10;
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

    console.log(qOps);
    const snapOps = await getDocs(qOps);
    console.log(snapOps);

    // 🔴 NUEVA ESTRUCTURA: Separamos lo Total de lo Evaluable
    const agtMap: Record<
      string,
      {
        totalGeneral: number; // Volumen de trabajo total
        totalEvaluable: number; // Solo los NO exonerados
        cumpleEvaluable: number;
        tiempoEvaluable: number;
        monedaPrincipal: string;
      }
    > = {};

    snapOps.forEach((docItem) => {
      const data = docItem.data();
      const op = data.Operador || "Desconocido";
      const moneda = data.Moneda || "";

      // FILTROS: Jefes, Autopagos y Monedas según Rol
      if (JEFES_EXCLUIDOS.includes(op)) return;
      if (op.toLowerCase().includes("autopago")) return;
      if (!monedasPermitidas.includes(moneda)) return;

      if (!agtMap[op]) {
        agtMap[op] = {
          totalGeneral: 0,
          totalEvaluable: 0,
          cumpleEvaluable: 0,
          tiempoEvaluable: 0,
          monedaPrincipal: moneda,
        };
      }

      // Sumamos al volumen general siempre
      agtMap[op].totalGeneral++;

      // 🔴 REVISAMOS SI ESTÁ EXONERADO (Tiene comentario de brecha)
      const isExonerated =
        data.comentarioBrecha && data.comentarioBrecha.trim() !== "";

      // Si no está exonerado, afecta sus métricas
      if (!isExonerated) {
        agtMap[op].totalEvaluable++;
        agtMap[op].tiempoEvaluable += Number(data.Tiempo) || 0;
        if (data.Cumple === true) agtMap[op].cumpleEvaluable++;
      }
    });

    console.log(agtMap);

    const batch = writeBatch(db);
    let procesados = 0;

    for (const op of Object.keys(agtMap)) {
      const metrics = agtMap[op];

      // 🔴 CÁLCULO FINAL: Basado SOLO en los evaluables
      // Si totalEvaluable es 0 (ej. todos fueron exonerados), se le da 100% de SLA y 0 min promedio.
      const slaPct =
        metrics.totalEvaluable > 0
          ? (metrics.cumpleEvaluable / metrics.totalEvaluable) * 100
          : 100;

      const avgTime =
        metrics.totalEvaluable > 0
          ? metrics.tiempoEvaluable / metrics.totalEvaluable
          : 0;

      const idUnico = `${fecha}_${op.replace(/\s+/g, "_")}`;
      const docRef = doc(db, "evaluaciones_desempeno", idUnico);

      const grupo = metrics.monedaPrincipal === "VES" ? "nacional" : "inter";
      console.log(grupo);

      batch.set(
        docRef,
        {
          id: idUnico,
          fecha: `${fecha}T00:00:00.000Z`,
          operador: op,
          totalRetiros: metrics.totalGeneral, // Mostramos su volumen real de trabajo
          cumplimientoSlaPct: Number(slaPct.toFixed(1)),
          tiempoPromedioMin: Number(avgTime.toFixed(1)),
          puntajeSla: calcularPuntajeSLA(slaPct),
          puntajeTiempo: calcularPuntajeTiempo(avgTime),
          grupoMoneda: grupo,
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

    const ap = await batch.commit();
    console.log(ap);
    return NextResponse.json({
      success: true,
      mensaje: `Sincronizados ${procesados} operadores.`,
    });
  } catch (error) {
    console.log(error)
    return NextResponse.json(
      { success: false, error: "Error interno" },
      { status: 500 },
    );
  }
}
