import { NextResponse } from "next/server";
import { errorResponse, HttpError, requireUser } from "@/lib/authServer";
import { sql } from "@/lib/db";
import { exigirMoneda } from "@/lib/monedasServer";

/** Historial de cargas de una moneda en un mes ("2026-10"). */
export async function GET(request: Request) {
  try {
    const yo = await requireUser(request);
    const { searchParams } = new URL(request.url);
    const moneda = searchParams.get("moneda") ?? "";
    const mes = searchParams.get("mes") ?? "";
    exigirMoneda(yo, moneda, { global: true });
    if (!/^\d{4}-\d{2}$/.test(mes)) throw new HttpError(400, "Mes inválido.");

    const filas = await sql`
      select id, fecha_reporte::text as fecha, moneda, subido_el, subido_por, total_registros
      from historial_reportes
      where moneda = ${moneda}
        and fecha_reporte >= ${`${mes}-01`}::date
        and fecha_reporte < ${`${mes}-01`}::date + interval '1 month'
      order by fecha_reporte`;

    const historial = filas.map((f) => ({
      id: f.id,
      fechaReporte: `${f.fecha}T00:00:00.000Z`,
      moneda: f.moneda,
      subidoEl: (f.subido_el as Date).toISOString(),
      subidoPor: f.subido_por,
      totalRegistros: f.total_registros,
    }));
    return NextResponse.json({ success: true, historial });
  } catch (e) {
    return errorResponse(e);
  }
}
