import { adminDb } from "@/lib/firebaseAdmin";
import { normalizarNombre } from "@/lib/evaluacion";

/** Operadores excluidos de la evaluación (`configuracion/evaluacion`), normalizados. */
export async function cargarExcluidosServer(): Promise<Set<string>> {
  const snap = await adminDb.collection("configuracion").doc("evaluacion").get();
  const lista = (snap.data()?.operadoresExcluidos as string[] | undefined) ?? [];
  return new Set(lista.map(normalizarNombre));
}
