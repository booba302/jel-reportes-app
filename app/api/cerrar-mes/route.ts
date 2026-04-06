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
    const { mes, grupo, rol } = await request.json();

    if (!mes || !grupo) {
      return NextResponse.json(
        { success: false, error: "Datos insuficientes" },
        { status: 400 },
      );
    }

    // 1. RESTRICCIÓN DE TIEMPO: El mes debe haber terminado
    const today = new Date();
    const currentMonthStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}`;
    if (mes >= currentMonthStr) {
      return NextResponse.json(
        {
          success: false,
          error: "Solo puedes cerrar meses que ya han finalizado por completo.",
        },
        { status: 400 },
      );
    }

    const start = `${mes}-01T00:00:00.000Z`;
    const end = `${mes}-31T23:59:59.999Z`;

    // 2. CONSULTA FILTRADA POR GRUPO
    const qEvals = query(
      collection(db, "evaluaciones_desempeno"),
      where("fecha", ">=", start),
      where("fecha", "<=", end),
    );

    const snapshot = await getDocs(qEvals);
    const evalsFiltradas = snapshot.docs
      .map((d) => d.data())
      .filter((d) => (grupo === "global" ? true : d.grupoMoneda === grupo));

    // 3. VALIDACIÓN: ¿Están todos confirmados en este grupo?
    const pendientes = evalsFiltradas.filter((e) => e.estado === "Pendiente");
    if (pendientes.length > 0) {
      return NextResponse.json(
        {
          success: false,
          error: `Hay ${pendientes.length} evaluaciones pendientes en tu grupo. Debes confirmarlas todas antes de cerrar el mes.`,
        },
        { status: 400 },
      );
    }

    // 4. AGREGACIÓN DE DATOS MENSUALES
    const reporteOperadores: Record<string, any> = {};

    evalsFiltradas.forEach((data) => {
      const nombre = data.operador;
      if (!reporteOperadores[nombre]) {
        reporteOperadores[nombre] = {
          totalRetiros: 0,
          dias: 0,
          sumaSla: 0,
          sumaTiempo: 0,
          sumaNota: 0,
          inconvenientes: 0,
        };
      }
      reporteOperadores[nombre].dias++;
      reporteOperadores[nombre].totalRetiros += data.totalRetiros;
      reporteOperadores[nombre].sumaSla += data.cumplimientoSlaPct;
      reporteOperadores[nombre].sumaTiempo += data.tiempoPromedioMin;
      reporteOperadores[nombre].sumaNota += data.puntajeFinal;
      if (data.tuvoInconveniente) reporteOperadores[nombre].inconvenientes++;
    });

    const batch = writeBatch(db);

    // Guardar promedios mensuales
    for (const [nombre, metrics] of Object.entries(reporteOperadores)) {
      const docId = `${mes}_${nombre.replace(/\s+/g, "_").toLowerCase()}`;
      const docRef = doc(db, "evaluaciones_mensuales", docId);

      batch.set(
        docRef,
        {
          id: docId,
          mes,
          operador: nombre,
          totalRetiros: metrics.totalRetiros,
          diasTrabajados: metrics.dias,
          promedioSlaPct: Number((metrics.sumaSla / metrics.dias).toFixed(1)),
          promedioTiempoMin: Number(
            (metrics.sumaTiempo / metrics.dias).toFixed(1),
          ),
          notaFinalMes: Number((metrics.sumaNota / metrics.dias).toFixed(1)),
          totalInconvenientes: metrics.inconvenientes,
          grupoMoneda: grupo,
          fechaCierre: new Date().toISOString(),
        },
        { merge: true },
      );
    }

    // Registrar estatus del cierre para este grupo
    const statusId = `${mes}_${grupo}`;
    const statusRef = doc(db, "cierres_mensuales_status", statusId);
    batch.set(statusRef, {
      mes,
      grupo,
      estado: "Cerrado",
      cerradoPor: rol,
      fechaCierre: new Date().toISOString(),
    });

    await batch.commit();

    return NextResponse.json({ success: true, message: "Cierre completado" });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: "Error en el servidor" },
      { status: 500 },
    );
  }
}
