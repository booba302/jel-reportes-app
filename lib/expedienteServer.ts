import { adminDb } from "@/lib/firebaseAdmin";
import type { Evaluacion } from "@/lib/evaluacion";
import type { Cargador } from "@/lib/expediente";
import { retirosDeOperador } from "@/lib/retirosRepo";

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

  retirosOperador: (operador, desde, hasta) => retirosDeOperador(operador, desde, hasta),

  async excluidos() {
    const s = await adminDb.collection("configuracion").doc("evaluacion").get();
    return (s.data()?.operadoresExcluidos as string[] | undefined) ?? [];
  },
};
