import { collection, doc, getDoc, getDocs, query, where } from "firebase/firestore";
import { db } from "@/lib/firebase";
import type { Evaluacion } from "@/lib/evaluacion";
import type { Cargador, RetiroOperador } from "@/lib/expediente";
import { getDocsConRespaldo } from "@/components/evaluacion/consultas";

/** Cargador con el SDK de cliente (modo interno, usuario logueado). */
export const cargadorCliente: Cargador = {
  async evaluaciones(desde, hasta) {
    const snap = await getDocs(
      query(
        collection(db, "evaluaciones_desempeno"),
        where("fecha", ">=", desde),
        where("fecha", "<=", hasta),
      ),
    );
    return snap.docs.map((d) => d.data() as Evaluacion);
  },

  async cierre(id) {
    const s = await getDoc(doc(db, "evaluaciones_mensuales", id));
    return s.exists() ? (s.data() as Record<string, unknown>) : null;
  },

  async retirosOperador(operador, desde, hasta) {
    const ref = collection(db, "operaciones_retiros");
    const snap = await getDocsConRespaldo(
      query(
        ref,
        where("Operador", "==", operador),
        where("Fecha del reporte", ">=", desde),
        where("Fecha del reporte", "<=", hasta),
      ),
      // Respaldo sin índice: todo el mes (pesado) y se filtra en memoria.
      query(ref, where("Fecha del reporte", ">=", desde), where("Fecha del reporte", "<=", hasta)),
      "operaciones_retiros (Operador + Fecha del reporte)",
    );
    const out: RetiroOperador[] = [];
    snap.forEach((d) => {
      const r = d.data();
      if (r.Operador === operador)
        out.push({ Moneda: r.Moneda, Cumple: r.Cumple, comentarioBrecha: r.comentarioBrecha });
    });
    return out;
  },

  async excluidos() {
    const s = await getDoc(doc(db, "configuracion", "evaluacion"));
    return (s.data()?.operadoresExcluidos as string[] | undefined) ?? [];
  },
};
