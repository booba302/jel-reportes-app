// src/app/api/cerrar-mes/route.ts
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

export async function POST(request: Request) {
  try {
    const { mes } = await request.json(); // Formato esperado: "YYYY-MM" (ej: "2026-03")

    if (!mes) {
      return NextResponse.json(
        { success: false, error: "Mes no proporcionado" },
        { status: 400 },
      );
    }

    // Rango del mes para buscar en la base de datos
    const fechaInicio = `${mes}-01T00:00:00.000Z`;
    const fechaFin = `${mes}-31T23:59:59.999Z`;

    // 1. Buscamos todas las evaluaciones de ese mes
    const q = query(
      collection(db, "evaluaciones_diarias"),
      where("fecha", ">=", fechaInicio),
      where("fecha", "<=", fechaFin),
    );

    const snapshot = await getDocs(q);

    if (snapshot.empty) {
      return NextResponse.json(
        { success: false, error: "No hay datos para este mes." },
        { status: 404 },
      );
    }

    const evaluaciones = snapshot.docs.map((doc) => doc.data());

    // 2. Validar que NO haya evaluaciones pendientes
    const pendientes = evaluaciones.filter((ev) => ev.estado !== "Confirmado");
    if (pendientes.length > 0) {
      return NextResponse.json(
        {
          success: false,
          error: `Hay ${pendientes.length} evaluaciones diarias pendientes. Confírmalas todas antes de cerrar el mes.`,
        },
        { status: 400 },
      );
    }

    // 3. Agrupar la data por Operador
    const reporteOperadores: Record<string, any> = {};

    evaluaciones.forEach((ev) => {
      const op = ev.operador;
      if (!reporteOperadores[op]) {
        reporteOperadores[op] = {
          diasTrabajados: 0,
          totalRetiros: 0,
          sumaSlaPct: 0,
          sumaTiempoMin: 0,
          sumaPuntajeSla: 0,
          sumaPuntajeTiempo: 0,
          sumaPuntualidad: 0,
          sumaProactividad: 0,
          sumaNotaFinal: 0,
          inconvenientes: 0,
        };
      }

      reporteOperadores[op].diasTrabajados += 1;
      reporteOperadores[op].totalRetiros += ev.totalRetiros;
      reporteOperadores[op].sumaSlaPct += ev.cumplimientoSlaPct;
      reporteOperadores[op].sumaTiempoMin += ev.tiempoPromedioMin;
      reporteOperadores[op].sumaPuntajeSla += ev.puntajeSla;
      reporteOperadores[op].sumaPuntajeTiempo += ev.puntajeTiempo;
      reporteOperadores[op].sumaPuntualidad += ev.puntualidad;
      reporteOperadores[op].sumaProactividad += ev.proactividad;
      reporteOperadores[op].sumaNotaFinal += ev.puntajeFinal;
      if (ev.tuvoInconveniente) reporteOperadores[op].inconvenientes += 1;
    });

    // 4. Calcular Promedios y Guardar en la nueva colección
    const batch = writeBatch(db);
    const mensualesRef = collection(db, "evaluaciones_mensuales");
    let procesados = 0;

    for (const [nombre, data] of Object.entries(reporteOperadores)) {
      const dias = data.diasTrabajados;

      const docId = `${mes}_${nombre.replace(/\s+/g, "_").toLowerCase()}`;
      const docRef = doc(mensualesRef, docId);

      batch.set(docRef, {
        id: docId,
        mes: mes,
        operador: nombre,
        diasTrabajados: dias,
        totalRetiros: data.totalRetiros,
        promedioSlaPct: Number((data.sumaSlaPct / dias).toFixed(2)),
        promedioTiempoMin: Number((data.sumaTiempoMin / dias).toFixed(2)),
        promedioPuntajeSla: Number((data.sumaPuntajeSla / dias).toFixed(2)),
        promedioPuntajeTiempo: Number(
          (data.sumaPuntajeTiempo / dias).toFixed(2),
        ),
        promedioPuntualidad: Number((data.sumaPuntualidad / dias).toFixed(2)),
        promedioProactividad: Number((data.sumaProactividad / dias).toFixed(2)),
        notaFinalMes: Number((data.sumaNotaFinal / dias).toFixed(2)),
        totalInconvenientes: data.inconvenientes,
        fechaCierre: new Date().toISOString(),
      });

      procesados++;
    }

    await batch.commit();

    return NextResponse.json({
      success: true,
      message: `Mes cerrado exitosamente. Se generaron reportes para ${procesados} operadores.`,
    });
  } catch (error) {
    console.error("Error cerrando mes:", error);
    return NextResponse.json(
      { success: false, error: "Error interno del servidor." },
      { status: 500 },
    );
  }
}
