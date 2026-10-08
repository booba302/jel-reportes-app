import { NextResponse } from "next/server";
import { errorResponse, HttpError, requireUser } from "@/lib/authServer";
import { sql } from "@/lib/db";
import { exigirMoneda } from "@/lib/monedasServer";
import { diaDeReporte } from "@/lib/retirosFila";
import type { OperacionRow } from "@/components/auditoria/calculos";

/** Retiros de un día y moneda, ordenados por hora, más la nota del día. */
export async function GET(request: Request) {
  try {
    const yo = await requireUser(request);
    const { searchParams } = new URL(request.url);
    const moneda = searchParams.get("moneda") ?? "";
    const dia = diaDeReporte(searchParams.get("fecha"));
    exigirMoneda(yo, moneda, { global: true });
    if (!dia) throw new HttpError(400, "Fecha inválida.");

    const [filas, notas] = await Promise.all([
      sql`
        select id, fecha_operacion, alias, cantidad, tiempo, cumple, operador, nivel, comentario_brecha
        from retiros where fecha_reporte = ${dia}::date and moneda = ${moneda}`,
      sql`select observacion from observaciones_diarias where moneda = ${moneda} and fecha = ${dia}::date`,
    ]);

    const ops: OperacionRow[] = filas.map((r) => ({
      id: r.id,
      hora: r.fecha_operacion.includes(" ") ? r.fecha_operacion.split(" ")[1] : "00:00:00",
      alias: r.alias,
      cantidad: r.cantidad,
      tiempo: r.tiempo,
      cumple: r.cumple,
      operador: r.operador,
      nivel: r.nivel || "Estándar",
      comentarioBrecha: r.comentario_brecha,
    }));
    ops.sort((a, b) => a.hora.localeCompare(b.hora));

    return NextResponse.json({ success: true, ops, nota: notas[0]?.observacion ?? "" });
  } catch (e) {
    return errorResponse(e);
  }
}
