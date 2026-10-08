import {
  collection,
  doc,
  getDocs,
  query,
  where,
  writeBatch,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { apiFetch } from "@/lib/apiFetch";
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
/** Retiros del día de un operador en una moneda (lo arma el servidor, ya sin Autopago). */
type GrupoDia = {
  operador: string;
  moneda: string;
  total: number;
  exonerados: number;
  evaluables: number;
  cumplen: number;
  tiempo: number;
};

export async function sincronizarDia({
  dia,
  esExcluido,
}: {
  dia: string;
  esExcluido: (nombre: string) => boolean;
}) {
  // El servidor ya filtra por las monedas del grupo de quien llama.
  const { grupos } = await apiFetch<{ grupos: GrupoDia[] }>(
    `/api/evaluacion/retiros-dia?fecha=${dia}`,
  );

  const porOperador: Record<string, Acumulado> = {};
  for (const g of grupos) {
    if (esExcluido(g.operador)) continue;
    const a = (porOperador[g.operador] ??= {
      total: 0,
      evaluables: 0,
      cumplen: 0,
      tiempo: 0,
      exonerados: 0,
      monedas: {},
    });
    a.total += g.total;
    a.monedas[g.moneda] = (a.monedas[g.moneda] ?? 0) + g.total;
    a.exonerados += g.exonerados;
    a.evaluables += g.evaluables;
    a.cumplen += g.cumplen;
    a.tiempo += g.tiempo;
  }

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
