import { collection, doc, getDocs, query, setDoc, updateDoc, where } from "firebase/firestore";
import { addDays } from "date-fns";
import { toast } from "sonner";
import { db } from "@/lib/firebase";

/** Días de validez del enlace público desde la última vez que se copió. */
export const DIAS_VALIDEZ_ENLACE = 60;

/**
 * Crea (o reutiliza) el enlace público del expediente y lo copia.
 * Copiarlo de nuevo renueva su vencimiento.
 */
export async function copiarEnlaceExpediente(operador: string, mes: string, creadoPor: string) {
  try {
    const expiraEl = addDays(new Date(), DIAS_VALIDEZ_ENLACE).toISOString();
    const snap = await getDocs(
      query(
        collection(db, "enlaces_expedientes"),
        where("operador", "==", operador),
        where("mes", "==", mes),
      ),
    );
    let linkId: string;
    if (!snap.empty) {
      linkId = snap.docs[0].id;
      await updateDoc(snap.docs[0].ref, { expiraEl });
    } else {
      const newRef = doc(collection(db, "enlaces_expedientes"));
      await setDoc(newRef, {
        operador,
        mes,
        creadoEl: new Date().toISOString(),
        creadoPor,
        expiraEl,
      });
      linkId = newRef.id;
    }
    await navigator.clipboard.writeText(`${window.location.origin}/evaluacion-operador/${linkId}`);
    toast.success(`Enlace del expediente de ${operador} copiado`, {
      description: `Válido por ${DIAS_VALIDEZ_ENLACE} días.`,
    });
  } catch (err) {
    console.error("Error al generar el enlace:", err);
    toast.error("Error al generar el enlace.");
  }
}
