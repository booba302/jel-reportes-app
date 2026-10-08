import { NextResponse } from 'next/server';
import { errorResponse, requireUser, type Sesion } from "@/lib/authServer";
import { sql } from "@/lib/db";
import { exigirMoneda } from "@/lib/monedasServer";
import { diaDeReporte } from "@/lib/retirosFila";

export async function DELETE(request: Request) {
  let yo: Sesion;
  try {
    yo = await requireUser(request);
  } catch (e) {
    return errorResponse(e);
  }
  try {
    const { searchParams } = new URL(request.url);
    const dia = diaDeReporte(searchParams.get('fecha'));
    const moneda = searchParams.get('moneda') ?? '';
    const idHistorial = searchParams.get('id');

    if (!dia || !moneda || !idHistorial) {
      return NextResponse.json({ success: false, error: 'Faltan parámetros' }, { status: 400 });
    }
    exigirMoneda(yo, moneda);

    // Retiros del día y su registro del historial, todo o nada.
    const borrados = await sql.begin(async (tx) => {
      const r = await tx`delete from retiros where fecha_reporte = ${dia}::date and moneda = ${moneda}`;
      await tx`delete from historial_reportes where id = ${idHistorial}`;
      return r.count;
    });

    return NextResponse.json({
      success: true,
      message: `Reporte eliminado. Se borraron ${borrados} registros.`
    });

  } catch (error) {
    return errorResponse(error);
  }
}
