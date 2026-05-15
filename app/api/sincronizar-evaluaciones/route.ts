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
import { getMonedasByRol } from "@/lib/roles";
import { isExonerated } from "@/lib/utils";

const JEFES_EXCLUIDOS = ["Franklin Sanchez", "Marvin", "Evelyn"];

const calcularPuntajeSLA = (porcentaje: number) => {
  if (porcentaje >= 100) return 10;
  if (porcentaje <= 0) return 0;
  return Number((porcentaje / 10).toFixed(1));
};

const calcularPuntajeTiempo = (minutos: number) => {
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

    const monedasPermitidas = getMonedasByRol(rol);

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
        totalGeneral: number;
        totalEvaluable: number;
        cumpleEvaluable: number;
        tiempoEvaluable: number;
        monedaPrincipal: string;
      }
    > = {};

    snapOps.forEach((docItem) => {
      const data = docItem.data();
      const op = data.Operador || "Desconocido";
      const moneda = data.Moneda || "";

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

      agtMap[op].totalGeneral++;

      if (!isExonerated(data.comentarioBrecha)) {
        agtMap[op].totalEvaluable++;
        agtMap[op].tiempoEvaluable += Number(data.Tiempo) || 0;
        if (data.Cumple === true) agtMap[op].cumpleEvaluable++;
      }
    });

    const operadores = Object.keys(agtMap);
    const chunks: string[][] = [];
    for (let i = 0; i < operadores.length; i += 500) {
      chunks.push(operadores.slice(i, i + 500));
    }

    for (const chunk of chunks) {
      const batch = writeBatch(db);
      for (const op of chunk) {
        const metrics = agtMap[op];

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

        batch.set(
          docRef,
          {
            id: idUnico,
            fecha: `${fecha}T00:00:00.000Z`,
            operador: op,
            totalRetiros: metrics.totalGeneral,
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
      }
      await batch.commit();
    }

    return NextResponse.json({
      success: true,
      mensaje: `Sincronizados ${operadores.length} operadores.`,
    });
  } catch (error) {
    console.error(error)
    return NextResponse.json(
      { success: false, error: "Error interno" },
      { status: 500 },
    );
  }
}
