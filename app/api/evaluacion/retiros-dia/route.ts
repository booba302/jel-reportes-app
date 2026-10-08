import { NextResponse } from "next/server";
import { errorResponse, HttpError, requireUser } from "@/lib/authServer";
import { sql } from "@/lib/db";
import { getMonedasByRol } from "@/lib/roles";
import { diaDeReporte } from "@/lib/retirosFila";

/** Retiros del día por operador y moneda (sin Autopago), solo de las monedas del grupo de quien llama. */
export async function GET(request: Request) {
  try {
    const yo = await requireUser(request);
    const dia = diaDeReporte(new URL(request.url).searchParams.get("fecha"));
    if (!dia) throw new HttpError(400, "Fecha inválida.");

    const grupos = await sql`
      select operador, moneda,
             count(*)::int as total,
             count(*) filter (where exonerado)::int as exonerados,
             count(*) filter (where not exonerado)::int as evaluables,
             count(*) filter (where not exonerado and cumple)::int as cumplen,
             coalesce(sum(tiempo) filter (where not exonerado), 0)::float8 as tiempo
      from retiros
      where fecha_reporte = ${dia}::date
        and moneda in ${sql(getMonedasByRol(yo.rol))}
        and operador not ilike '%autopago%'
      group by operador, moneda`;
    return NextResponse.json({ success: true, grupos });
  } catch (e) {
    return errorResponse(e);
  }
}
