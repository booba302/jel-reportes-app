import {
  getDocs,
  type DocumentData,
  type Query,
  type QuerySnapshot,
} from "firebase/firestore";
import { FirebaseError } from "firebase/app";

/**
 * Ejecuta una consulta que necesita un índice compuesto. Si el índice todavía
 * no existe ("failed-precondition"), usa la consulta de respaldo (más amplia)
 * y deja en consola el enlace para crearlo. El llamador filtra en memoria.
 */
export async function getDocsConRespaldo(
  principal: Query<DocumentData>,
  respaldo: Query<DocumentData>,
  indice: string,
): Promise<QuerySnapshot<DocumentData>> {
  try {
    return await getDocs(principal);
  } catch (err) {
    if (!(err instanceof FirebaseError) || err.code !== "failed-precondition")
      throw err;
    console.warn(`Falta el índice ${indice}. Créalo desde este enlace:`, err.message);
    return getDocs(respaldo);
  }
}

/** "2026-10-05" → "2026-10-05T00:00:00.000Z" (formato de `fecha`). */
export const fechaISO = (dia: string) => `${dia}T00:00:00.000Z`;
