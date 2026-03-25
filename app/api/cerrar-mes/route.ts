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
    const { mes } = await request.json(); // Formato esperado: "YYYY-MM"

    if (!mes) {
      return NextResponse.json(
        { success: false, error: "Mes no proporcionado" },
        { status: 400 },
      );
    }

    // 1. RESTRICCIÓN DE TIEMPO: Un mes solo se puede cerrar si ya terminó
    const today = new Date();
    const currentMonthStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}`;

    if (mes >= currentMonthStr) {
      return NextResponse.json(
        {
          success: false,
          error: `Aún no puedes cerrar ${mes}. Debes esperar al mes siguiente para realizar esta acción.`,
        },
        { status: 400 },
      );
    }

    const fechaInicio = `${mes}-01T00:00:00.000Z`;
    const fechaFin = `${mes}-31T23:59:59.999Z`;

    // 2. BUSCAR DÍAS CARGADOS (Historial de archivos subidos)
    const qHistorial = query(
      collection(db, "historial_reportes"),
      where("fechaReporte", ">=", fechaInicio),
      where("fechaReporte", "<=", fechaFin),
    );
    const snapHistorial = await getDocs(qHistorial);
    const diasCargadosPorMoneda: Record<string, Set<string>> = {};

    snapHistorial.docs.forEach((doc) => {
      const data = doc.data();
      if (!diasCargadosPorMoneda[data.moneda])
        diasCargadosPorMoneda[data.moneda] = new Set();
      diasCargadosPorMoneda[data.moneda].add(data.fechaReporte);
    });

    // 3. BUSCAR EVALUACIONES DIARIAS
    const qEval = query(
      collection(db, "evaluaciones_diarias"),
      where("fecha", ">=", fechaInicio),
      where("fecha", "<=", fechaFin),
    );
    const snapEval = await getDocs(qEval);

    if (snapEval.empty) {
      return NextResponse.json(
        { success: false, error: "No hay evaluaciones para este mes." },
        { status: 404 },
      );
    }

    const evaluaciones = snapEval.docs.map((doc) => doc.data());

    // 4. VALIDAR PENDIENTES E INCONSISTENCIAS
    const pendientes = evaluaciones.filter((ev) => ev.estado !== "Confirmado");
    if (pendientes.length > 0) {
      return NextResponse.json(
        {
          success: false,
          error: `Hay operadores con evaluaciones pendientes. Confírmalas todas antes de cerrar el mes.`,
        },
        { status: 400 },
      );
    }

    const diasEvaluadosPorMoneda: Record<string, Set<string>> = {};
    evaluaciones.forEach((ev) => {
      if (!diasEvaluadosPorMoneda[ev.moneda])
        diasEvaluadosPorMoneda[ev.moneda] = new Set();
      diasEvaluadosPorMoneda[ev.moneda].add(ev.fecha);
    });

    // CRUCE DE DATOS: Asegurarse de que coincida lo subido con lo evaluado
    for (const moneda of Object.keys(diasCargadosPorMoneda)) {
      const cargados = diasCargadosPorMoneda[moneda].size;
      const evaluados = diasEvaluadosPorMoneda[moneda]?.size || 0;

      if (cargados !== evaluados) {
        return NextResponse.json(
          {
            success: false,
            error: `Inconsistencia en ${moneda}: Subiste Excels para ${cargados} días, pero solo evaluaste ${evaluados} días.`,
          },
          { status: 400 },
        );
      }
    }

    // 5. AGRUPAR Y CALCULAR PROMEDIOS MENSUALES
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

    // 6. GUARDAR EN LA BASE DE DATOS MENSULARES (BATCH)
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
