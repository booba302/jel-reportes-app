import { adminDb } from "@/lib/firebaseAdmin";
import type { Evaluacion } from "@/lib/evaluacion";
import type { Cargador, RetiroOperador } from "@/lib/expediente";

/** Cargador con el Admin SDK (enlace público: el servidor valida el enlace). */
export const cargadorServidor: Cargador = {
  async evaluaciones(desde, hasta) {
    const snap = await adminDb
      .collection("evaluaciones_desempeno")
      .where("fecha", ">=", desde)
      .where("fecha", "<=", hasta)
      .get();
    return snap.docs.map((d) => d.data() as Evaluacion);
  },

  async cierre(id) {
    const s = await adminDb.collection("evaluaciones_mensuales").doc(id).get();
    return s.exists ? (s.data() as Record<string, unknown>) : null;
  },

  async retirosOperador(operador, desde, hasta) {
    const ref = adminDb.collection("operaciones_retiros");
    let docs;
    try {
      docs = (
        await ref
          .where("Operador", "==", operador)
          .where("Fecha del reporte", ">=", desde)
          .where("Fecha del reporte", "<=", hasta)
          .get()
      ).docs;
    } catch (err) {
      // Sin el índice (Operador + Fecha del reporte): todo el mes y se filtra.
      console.warn("Falta el índice operaciones_retiros (Operador + Fecha del reporte):", err);
      docs = (
        await ref.where("Fecha del reporte", ">=", desde).where("Fecha del reporte", "<=", hasta).get()
      ).docs.filter((d) => d.data().Operador === operador);
    }
    return docs.map((d): RetiroOperador => {
      const r = d.data();
      return { Moneda: r.Moneda, Cumple: r.Cumple, comentarioBrecha: r.comentarioBrecha };
    });
  },

  async excluidos() {
    const s = await adminDb.collection("configuracion").doc("evaluacion").get();
    return (s.data()?.operadoresExcluidos as string[] | undefined) ?? [];
  },
};
