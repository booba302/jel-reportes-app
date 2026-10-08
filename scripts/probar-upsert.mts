// Inserta un retiro de prueba con comentario, lo "recarga" y comprueba que el comentario sigue.
import postgres from "postgres";
import { guardarRetiros } from "@/lib/retirosRepo";
import type { FilaRetiro } from "@/lib/retirosFila";

const db = postgres(process.env.DIRECT_URL!, { max: 1 });
const fila: FilaRetiro = {
  id: "PRUEBA_UPSERT", fecha_reporte: "2000-01-01", moneda: "CLP", operador: "Prueba",
  jugador: "", alias: "", cantidad: 0, nivel: "", fecha_operacion: "2000-01-01 10:00:00",
  update_date: "", hora: 10, tiempo: 40, cumple: false,
};
try {
  await guardarRetiros([{ ...fila, comentario_brecha: "Falla banco" }], db, true);
  await guardarRetiros([{ ...fila, tiempo: 41 }], db); // recarga del día, sin comentario
  const [r] = await db`select tiempo, comentario_brecha, exonerado from retiros where id = 'PRUEBA_UPSERT'`;
  if (r.comentario_brecha !== "Falla banco" || r.exonerado !== true || r.tiempo !== 41) {
    console.error("FALLA:", r);
    process.exitCode = 1;
  } else console.log("OK: la recarga actualizó el tiempo y conservó la exoneración.");
} finally {
  await db`delete from retiros where id = 'PRUEBA_UPSERT'`;
  await db.end();
}
