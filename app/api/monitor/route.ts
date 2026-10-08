import { NextResponse } from "next/server";
import { errorResponse, HttpError, requireAdmin } from "@/lib/authServer";
import { sql } from "@/lib/db";
import { MONEDAS, type OpMonitor } from "@/lib/monitor";

/** Retiros del mes agrupados para el monitor. La hora solo se separa en las brechas. */
export async function GET(request: Request) {
  try {
    await requireAdmin(request);
    const mes = new URL(request.url).searchParams.get("mes") ?? "";
    if (!/^\d{4}-\d{2}$/.test(mes)) throw new HttpError(400, "Mes inválido.");

    const ops = (await sql`
      select extract(day from fecha_reporte)::int as dia,
             case when not autopago and not exonerado and not cumple then hora end as hora,
             moneda, autopago, vip, cumple, exonerado,
             count(*)::int as n, sum(tiempo)::float8 as tiempo
      from retiros
      where fecha_reporte >= ${`${mes}-01`}::date
        and fecha_reporte < ${`${mes}-01`}::date + interval '1 month'
        and moneda in ${sql([...MONEDAS])}
      group by 1, 2, 3, 4, 5, 6, 7`) as unknown as OpMonitor[];

    return NextResponse.json({ success: true, ops });
  } catch (e) {
    return errorResponse(e);
  }
}
