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

// 1. Cálculo de SLA
const calcularPuntajeSLA = (porcentaje: number) => {
  if (porcentaje >= 100) return 10;
  if (porcentaje <= 0) return 0;
  return Number((porcentaje / 10).toFixed(1));
};

// 2. Cálculo de Tiempo (Fórmula exacta del Excel original)
const calcularPuntajeTiempo = (minutos: number) => {
  if (minutos > 0 && minutos <= 10) return 10;
  if (minutos > 10 && minutos <= 15) return 9;
  if (minutos > 15 && minutos <= 20) return 8;
  if (minutos > 20 && minutos <= 25) return 7;
  if (minutos > 25 && minutos <= 30) return 6;
  if (minutos > 30 && minutos <= 35) return 5;
  if (minutos > 35 && minutos <= 40) return 4;
  if (minutos > 40 && minutos <= 45) return 3;
  if (minutos > 45 && minutos <= 50) return 2;
  if (minutos > 50) return 1;
  return 0; // En caso de que sea 0 o un valor negativo
};

export async function POST(request: Request) {
  try {
    const { fecha } = await request.json();

    if (!fecha) {
      return NextResponse.json(
        { success: false, error: "Falta la fecha." },
        { status: 400 },
      );
    }

    const [year, month, day] = fecha.split("T")[0].split("-");
    const dateOnly = `${year}-${month}-${day}`;

    // 1. Buscamos todas las operaciones del día (sin importar la moneda)
    const qOps = query(
      collection(db, "operaciones_retiros"),
      where("Fecha del reporte", "==", fecha),
    );
    const snapshotOps = await getDocs(qOps);

    if (snapshotOps.empty) {
      return NextResponse.json(
        { success: false, error: "No hay retiros para este día." },
        { status: 404 },
      );
    }

    // 2. Agrupamos por Operador
    const agtMap: Record<
      string,
      { total: number; slaCount: number; totalTime: number }
    > = {};
    snapshotOps.forEach((docSnap) => {
      const data = docSnap.data();
      const op = data.Operador;

      if (!op || op === "Autopago" || op === "Desconocido") return;

      if (!agtMap[op]) agtMap[op] = { total: 0, slaCount: 0, totalTime: 0 };

      agtMap[op].total++;

      const tiempoVal =
        typeof data.Tiempo === "string"
          ? parseFloat(data.Tiempo.replace(",", "."))
          : Number(data.Tiempo);
      agtMap[op].totalTime += isNaN(tiempoVal) ? 0 : tiempoVal;

      const cumpleStr = String(data.Cumple).trim().toUpperCase();
      if (
        data.Cumple === true ||
        cumpleStr === "SI" ||
        cumpleStr === "SÍ" ||
        cumpleStr === "TRUE" ||
        cumpleStr === "1"
      ) {
        agtMap[op].slaCount++;
      }
    });

    // Extraemos las evaluaciones que ya existen para no borrar las notas de actitud
    const qEval = query(
      collection(db, "evaluaciones_desempeno"),
      where("fecha", "==", fecha),
    );
    const evalSnap = await getDocs(qEval);
    const evaluacionesExistentes: Record<string, any> = {};
    evalSnap.forEach(
      (docSnap) => (evaluacionesExistentes[docSnap.id] = docSnap.data()),
    );

    const batch = writeBatch(db);
    let procesados = 0;

    for (const [op, metrics] of Object.entries(agtMap)) {
      const idUnico = `${dateOnly}_${op.replace(/\s+/g, "")}`;
      const docRef = doc(db, "evaluaciones_desempeno", idUnico);
      const existente = evaluacionesExistentes[idUnico];

      const slaPct = (metrics.slaCount / metrics.total) * 100;
      const avgTime = metrics.totalTime / metrics.total;

      const puntajeSla = calcularPuntajeSLA(slaPct);
      const puntajeTiempo = calcularPuntajeTiempo(avgTime);

      const puntualidad = existente?.puntualidad ?? 10;
      const proactividad = existente?.proactividad ?? 10;

      // Cálculo del puntaje final promediando los 4 pilares
      const puntajeFinal = Number(
        ((puntajeSla + puntajeTiempo + puntualidad + proactividad) / 4).toFixed(
          1,
        ),
      );

      const datosNuevos = {
        id: idUnico,
        fecha: fecha,
        operador: op,
        totalRetiros: metrics.total,
        cumplimientoSlaPct: Number(slaPct.toFixed(1)),
        tiempoPromedioMin: Number(avgTime.toFixed(1)),
        puntajeSla,
        puntajeTiempo,
        puntajeFinal,
        puntualidad,
        proactividad,
      };

      if (existente) {
        batch.set(docRef, datosNuevos, { merge: true });
      } else {
        batch.set(
          docRef,
          {
            ...datosNuevos,
            completoTurno: true,
            tuvoInconveniente: false,
            comentarioInconveniente: "",
            estado: "Pendiente",
          },
          { merge: true },
        );
      }
      procesados++;
    }

    await batch.commit();

    return NextResponse.json({
      success: true,
      message: `Evaluación global generada para ${procesados} operadores.`,
    });
  } catch (error) {
    console.error("Error en sincronización global:", error);
    return NextResponse.json(
      { success: false, error: "Error interno del servidor." },
      { status: 500 },
    );
  }
}
