import { NextResponse } from "next/server";
import { errorResponse, HttpError, requireUser } from "@/lib/authServer";
import { sql } from "@/lib/db";
import { exigirMoneda } from "@/lib/monedasServer";
import { diaDeReporte } from "@/lib/retirosFila";

/** SLA del día (sin Autopago ni exonerados) y cuántos exonerados tuvo. */
export async function GET(request: Request) {
  try {
    const yo = await requireUser(request);
    const { searchParams } = new URL(request.url);
    const moneda = searchParams.get("moneda") ?? "";
    const dia = diaDeReporte(searchParams.get("fecha"));
    exigirMoneda(yo, moneda, { global: true });
    if (!dia) throw new HttpError(400, "Fecha inválida.");

    const [r] = await sql`
      select
        count(*) filter (where not autopago and exonerado)::int as exonerados,
        count(*) filter (where not autopago and not exonerado)::int as evaluables,
        count(*) filter (where not autopago and not exonerado and cumple)::int as cumplidos
      from retiros
      where moneda = ${moneda} and fecha_reporte = ${dia}::date`;

    return NextResponse.json({
      success: true,
      sla: r.evaluables ? (r.cumplidos / r.evaluables) * 100 : 0,
      exonerados: r.exonerados,
    });
  } catch (e) {
    return errorResponse(e);
  }
}
