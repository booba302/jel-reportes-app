import { collection, doc, getDoc, getDocs, query, where } from "firebase/firestore";
import { db } from "@/lib/firebase";
import type { Evaluacion } from "@/lib/evaluacion";
import type { Cargador, RetiroOperador } from "@/lib/expediente";
import { apiFetch } from "@/lib/apiFetch";

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
    const qs = new URLSearchParams({ operador, desde, hasta });
    const { retiros } = await apiFetch<{ retiros: RetiroOperador[] }>(`/api/expediente/retiros?${qs}`);
    return retiros;
  },

  async excluidos() {
    const s = await getDoc(doc(db, "configuracion", "evaluacion"));
    return (s.data()?.operadoresExcluidos as string[] | undefined) ?? [];
  },
};
