// Copia completa de Firestore → Postgres. VACÍA las tres tablas antes de copiar:
// se puede correr las veces que haga falta y el resultado es siempre una foto fiel.
import postgres from "postgres";
import { FieldPath, type QueryDocumentSnapshot } from "firebase-admin/firestore";
import { adminDb } from "@/lib/firebaseAdmin";
import { filaHistorial, filaObservacion, filaRetiro, type FilaRetiro } from "@/lib/retirosFila";
import { guardarHistorial, guardarObservaciones, guardarRetiros } from "@/lib/retirosRepo";

// Después del corte Postgres es la fuente de verdad: vaciarlo borra lo cargado o exonerado desde entonces.
if (!process.argv.includes("--confirmo-vaciar")) {
  console.error(
    "Este script VACÍA retiros, historial y notas en Postgres y los reemplaza con Firestore.\n" +
      "Úsalo solo antes del corte. Para continuar: npm run db:copiar -- --confirmo-vaciar",
  );
  process.exit(1);
}

const db = postgres(process.env.DIRECT_URL!, { max: 2, onnotice: () => {} });
const PAGINA = 5000;

async function* paginas(coleccion: string) {
  let ultimo: QueryDocumentSnapshot | undefined;
  for (;;) {
    let q = adminDb.collection(coleccion).orderBy(FieldPath.documentId()).limit(PAGINA);
    if (ultimo) q = q.startAfter(ultimo);
    const snap = await q.get();
    if (snap.empty) return;
    yield snap.docs;
    ultimo = snap.docs[snap.docs.length - 1];
  }
}

async function copiar<T>(
  coleccion: string,
  mapear: (id: string, d: Record<string, unknown>) => T | null,
  guardar: (filas: T[]) => Promise<void>,
) {
  let leidos = 0, copiados = 0;
  const descartados: string[] = [];
  for await (const docs of paginas(coleccion)) {
    const filas: T[] = [];
    for (const d of docs) {
      const f = mapear(d.id, d.data());
      if (f) filas.push(f);
      else descartados.push(d.id);
    }
    await guardar(filas);
    leidos += docs.length;
    copiados += filas.length;
    process.stdout.write(`\r${coleccion}: ${copiados} de ${leidos}`);
  }
  console.log(`\n${coleccion}: ${copiados} copiados, ${descartados.length} descartados`);
  if (descartados.length) console.log("  descartados (primeros 20):", descartados.slice(0, 20).join(", "));
}

try {
  const t0 = Date.now();
  await db`truncate retiros, historial_reportes, observaciones_diarias`;
  await copiar(
    "operaciones_retiros",
    (id, d): FilaRetiro | null => {
      const f = filaRetiro(id, d);
      return f && { ...f, comentario_brecha: String(d.comentarioBrecha ?? "") };
    },
    (filas) => guardarRetiros(filas, db, true),
  );
  await copiar("historial_reportes", filaHistorial, (f) => guardarHistorial(f, db));
  await copiar("observaciones_diarias", filaObservacion, (f) => guardarObservaciones(f, db));
  console.log(`Listo en ${Math.round((Date.now() - t0) / 1000)} s.`);
} finally {
  await db.end();
}
process.exit(0); // firebase-admin deja conexiones abiertas
