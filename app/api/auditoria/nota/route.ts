import { NextResponse } from "next/server";
import { errorResponse, HttpError, requireUser } from "@/lib/authServer";
import { sql } from "@/lib/db";
import { exigirMoneda } from "@/lib/monedasServer";
import { diaDeReporte } from "@/lib/retirosFila";

/** Guarda la nota del día de una moneda. */
export async function PUT(request: Request) {
  try {
    const yo = await requireUser(request);
    const { moneda, fecha, observacion } = await request.json();
    const dia = diaDeReporte(fecha);
    if (typeof moneda !== "string" || !dia || typeof observacion !== "string" || observacion.length > 5000)
      throw new HttpError(400, "Datos inválidos.");
    exigirMoneda(yo, moneda);

    await sql`
      insert into observaciones_diarias (moneda, fecha, observacion, fecha_actualizacion)
      values (${moneda}, ${dia}::date, ${observacion}, now())
      on conflict (moneda, fecha) do update set
        observacion = excluded.observacion, fecha_actualizacion = now()`;
    return NextResponse.json({ success: true });
  } catch (e) {
    return errorResponse(e);
  }
}
