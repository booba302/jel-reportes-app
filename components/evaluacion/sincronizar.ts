import {
  collection,
  doc,
  getDocs,
  query,
  where,
  writeBatch,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { isExonerated } from "@/lib/utils";
import { getMonedasByRol } from "@/lib/roles";
import {
  calcularPuntajeFinal,
  calcularPuntajeSLA,
  calcularPuntajeTiempo,
  type Evaluacion,
} from "@/lib/evaluacion";
import { fechaISO } from "./consultas";

type Acumulado = {
  total: number;
  evaluables: number;
  cumplen: number;
  tiempo: number;
  exonerados: number;
  monedas: Record<string, number>;
};

/**
 * Crea o actualiza las evaluaciones del día a partir de los retiros.
 * - Nuevas: automáticos + valores por defecto (Pendiente).
 * - Existentes: SOLO los automáticos; no toca estado ni cualitativos.
 *   Si estaba confirmada, recalcula su puntajeFinal.
 * Devuelve la cantidad de operadores procesados.
 */
export async function sincronizarDia({
  dia,
  rol,
  esExcluido,
}: {
  dia: string;
  rol?: string;
  esExcluido: (nombre: string) => boolean;
}) {
  const monedasPermitidas = getMonedasByRol(rol);

  const snapOps = await getDocs(
    query(
      collection(db, "operaciones_retiros"),
      where("Fecha del reporte", ">=", `${dia}T00:00:00.000Z`),
      where("Fecha del reporte", "<=", `${dia}T23:59:59.999Z`),
    ),
  );

  const porOperador: Record<string, Acumulado> = {};
  snapOps.forEach((d) => {
    const data = d.data();
    const op: string = data.Operador || "Desconocido";
    const moneda: string = data.Moneda || "";
    if (op.toLowerCase().includes("autopago")) return;
    if (esExcluido(op)) return;
    if (!monedasPermitidas.includes(moneda)) return;

    const a = (porOperador[op] ??= {
      total: 0,
      evaluables: 0,
      cumplen: 0,
      tiempo: 0,
      exonerados: 0,
      monedas: {},
    });
    a.total++;
    a.monedas[moneda] = (a.monedas[moneda] ?? 0) + 1;
    if (isExonerated(data.comentarioBrecha)) {
      a.exonerados++;
      return;
    }
    a.evaluables++;
    a.tiempo += Number(data.Tiempo) || 0;
    if (data.Cumple === true) a.cumplen++;
  });

  const operadores = Object.keys(porOperador);
  if (operadores.length === 0) return 0;

  const fecha = fechaISO(dia);
  const existentes = new Map(
    (await getDocs(query(collection(db, "evaluaciones_desempeno"), where("fecha", "==", fecha))))
      .docs.map((d) => [d.id, d.data() as Evaluacion]),
  );

  for (let i = 0; i < operadores.length; i += 500) {
    const batch = writeBatch(db);
    for (const op of operadores.slice(i, i + 500)) {
      const a = porOperador[op];
      const slaPct = a.evaluables > 0 ? (a.cumplen / a.evaluables) * 100 : 100;
      const avgTime = a.evaluables > 0 ? a.tiempo / a.evaluables : 0;
      const moneda = Object.entries(a.monedas).sort((x, y) => y[1] - x[1])[0][0];
      const id = `${dia}_${op.replace(/\s+/g, "_")}`;
      const ref = doc(db, "evaluaciones_desempeno", id);

      const automaticos = {
        id,
        fecha,
        operador: op,
        grupoMoneda: moneda === "VES" ? "nacional" : "inter",
        moneda,
        totalRetiros: a.total,
        cumplimientoSlaPct: Number(slaPct.toFixed(1)),
        tiempoPromedioMin: Number(avgTime.toFixed(1)),
        exonerados: a.exonerados,
        // Conteos exactos para el cierre mensual (§19.4)
        retirosEvaluables: a.evaluables,
        retirosCumplidos: a.cumplen,
        tiempoTotalMin: Number(a.tiempo.toFixed(2)),
        puntajeSla: calcularPuntajeSLA(slaPct),
        puntajeTiempo: calcularPuntajeTiempo(avgTime),
      };

      const prev = existentes.get(id);
      if (!prev) {
        batch.set(ref, {
          ...automaticos,
          estado: "Pendiente",
          puntualidad: 10,
          proactividad: 10,
          completoTurno: true,
          tuvoInconveniente: false,
          comentarioInconveniente: "",
        });
      } else if (prev.estado === "Confirmado") {
        batch.update(ref, {
          ...automaticos,
          puntajeFinal: calcularPuntajeFinal({ ...prev, ...automaticos }),
        });
      } else {
        batch.update(ref, automaticos);
      }
    }
    await batch.commit();
  }

  return operadores.length;
}
