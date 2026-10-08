import type postgres from "postgres";
import { sql } from "@/lib/db";
import type { RetiroOperador } from "@/lib/expediente";
import { sinDuplicados, type FilaHistorial, type FilaObservacion, type FilaRetiro } from "@/lib/retirosFila";

/** Conexión normal o transacción en curso. */
type Db = postgres.Sql | postgres.TransactionSql;

const LOTE = 2000; // 2000 filas × 14 columnas, lejos del límite de 65.535 parámetros

const COLUMNAS = [
  "id", "fecha_reporte", "moneda", "operador", "jugador", "alias", "cantidad",
  "nivel", "fecha_operacion", "update_date", "hora", "tiempo", "cumple",
] as const satisfies readonly (keyof FilaRetiro)[];

/**
 * Inserta o actualiza retiros. Al actualizar NUNCA toca comentario_brecha:
 * recargar un día ya auditado conserva sus exoneraciones (igual que el merge de Firestore).
 * `conComentario` solo lo usa la copia inicial, que inserta en tablas vacías.
 */
export async function guardarRetiros(todas: FilaRetiro[], db: Db = sql, conComentario = false) {
  const filas = sinDuplicados(todas);
  const cols: (keyof FilaRetiro)[] = conComentario ? [...COLUMNAS, "comentario_brecha"] : [...COLUMNAS];
  for (let i = 0; i < filas.length; i += LOTE) {
    const lote = filas.slice(i, i + LOTE);
    await db`
      insert into retiros ${db(lote, cols)}
      on conflict (id) do update set
        fecha_reporte = excluded.fecha_reporte, moneda = excluded.moneda,
        operador = excluded.operador, jugador = excluded.jugador, alias = excluded.alias,
        cantidad = excluded.cantidad, nivel = excluded.nivel,
        fecha_operacion = excluded.fecha_operacion, update_date = excluded.update_date,
        hora = excluded.hora, tiempo = excluded.tiempo, cumple = excluded.cumple`;
  }
}

export async function guardarHistorial(filas: FilaHistorial[], db: Db = sql) {
  for (let i = 0; i < filas.length; i += LOTE) {
    await db`
      insert into historial_reportes ${db(filas.slice(i, i + LOTE))}
      on conflict (id) do update set
        fecha_reporte = excluded.fecha_reporte, moneda = excluded.moneda,
        subido_el = excluded.subido_el, subido_por = excluded.subido_por,
        total_registros = excluded.total_registros`;
  }
}

export async function guardarObservaciones(filas: FilaObservacion[], db: Db = sql) {
  for (let i = 0; i < filas.length; i += LOTE) {
    await db`
      insert into observaciones_diarias ${db(filas.slice(i, i + LOTE))}
      on conflict (moneda, fecha) do update set
        observacion = excluded.observacion, fecha_actualizacion = excluded.fecha_actualizacion`;
  }
}

/** Retiros + historial de una carga, todo o nada. */
export async function guardarReporte(retiros: FilaRetiro[], historial: FilaHistorial[]) {
  await sql.begin(async (tx) => {
    await guardarRetiros(retiros, tx);
    await guardarHistorial(historial, tx);
  });
}

/** Retiros de un operador con fecha de reporte en [desde, hasta] (acepta ISO o YYYY-MM-DD). */
export async function retirosDeOperador(operador: string, desde: string, hasta: string): Promise<RetiroOperador[]> {
  const filas = await sql`
    select moneda, cumple, comentario_brecha
    from retiros
    where operador = ${operador}
      and fecha_reporte between ${desde.slice(0, 10)}::date and ${hasta.slice(0, 10)}::date`;
  return filas.map((r) => ({ Moneda: r.moneda, Cumple: r.cumple, comentarioBrecha: r.comentario_brecha }));
}
