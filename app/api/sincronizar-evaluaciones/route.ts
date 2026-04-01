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

// 🔴 LISTA DE JEFES EXCLUIDOS DE LA EVALUACIÓN
// Agrega aquí los nombres exactamente como aparecen en los reportes
const JEFES_EXCLUIDOS = ["Franklin Sánchez","Marvin"];

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
  return 0; // Más de 45 min
};

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { fecha } = body; // Ej: "2026-03-31"

    if (!fecha) {
      return NextResponse.json(
        { success: false, error: "La fecha es requerida" },
        { status: 400 },
      );
    }

    const start = `${fecha}T00:00:00.000Z`;
    const end = `${fecha}T23:59:59.999Z`;

    // 1. Obtener todas las operaciones de retiros del día
    const qOps = query(
      collection(db, "operaciones_retiros"),
      where("Fecha del reporte", ">=", start),
      where("Fecha del reporte", "<=", end),
    );

    const snapOps = await getDocs(qOps);
    const agtMap: Record<
      string,
      { total: number; cumple: number; tiempoTotal: number }
    > = {};

    // 2. Agrupar las operaciones por Operador
    snapOps.forEach((docItem) => {
      const data = docItem.data();
      const op = data.Operador || "Desconocido";

      // 🔴 FILTRO: Omitir si el operador es un jefe
      if (JEFES_EXCLUIDOS.includes(op)) return;

      if (!agtMap[op]) {
        agtMap[op] = { total: 0, cumple: 0, tiempoTotal: 0 };
      }

      const tiempoOp = Number(data.Tiempo) || 0;
      const cumpleSla = data.Cumple === true;

      agtMap[op].total++;
      agtMap[op].tiempoTotal += tiempoOp;
      if (cumpleSla) agtMap[op].cumple++;
    });

    // 3. Obtener evaluaciones existentes para no sobreescribir las notas manuales
    const qEvals = query(
      collection(db, "evaluaciones_desempeno"),
      where("fecha", ">=", start),
      where("fecha", "<=", end),
    );
    const snapEvals = await getDocs(qEvals);
    const evalsExistentes: Record<string, any> = {};

    snapEvals.forEach((d) => {
      evalsExistentes[d.data().operador] = d.data();
    });

    const batch = writeBatch(db);
    let procesados = 0;

    // 4. Calcular métricas finales y preparar el guardado
    for (const op of Object.keys(agtMap)) {
      const metrics = agtMap[op];

      const slaPct =
        metrics.total > 0 ? (metrics.cumple / metrics.total) * 100 : 0;
      const avgTime =
        metrics.total > 0 ? metrics.tiempoTotal / metrics.total : 0;

      const puntajeSla = calcularPuntajeSLA(slaPct);
      const puntajeTiempo = calcularPuntajeTiempo(avgTime);

      const existente = evalsExistentes[op];
      const idUnico = existente?.id || `${fecha}_${op.replace(/\s+/g, "_")}`;
      const docRef = doc(db, "evaluaciones_desempeno", idUnico);

      // Mantener notas manuales (actitud) si ya existen, si no, por defecto es 10
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
        fecha: `${fecha}T12:00:00.000Z`, // Normalizamos para evitar problemas de zona horaria
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

    // Ejecutar todas las escrituras a la vez
    await batch.commit();

    return NextResponse.json({
      success: true,
      mensaje: `Sincronizados ${procesados} operadores exitosamente.`,
    });
  } catch (error) {
    console.error("Error al sincronizar evaluaciones:", error);
    return NextResponse.json(
      { success: false, error: "Error interno del servidor al procesar datos" },
      { status: 500 },
    );
  }
}
