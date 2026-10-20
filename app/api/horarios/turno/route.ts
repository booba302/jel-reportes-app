import { NextResponse } from "next/server";
import { errorResponse, HttpError, requireGestorHorario } from "@/lib/authServer";
import { esFecha, PUESTOS, ROTACION, TURNOS, type Puesto, type Turno } from "@/lib/horario";
import { editarTurno } from "@/lib/horarioRepo";

/** Cambia a mano quién cubre una casilla. */
export async function PATCH(request: Request) {
  try {
    await requireGestorHorario(request);
    const b = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    const { fecha, turno, puesto, colaborador } = b;
    if (!esFecha(fecha) || !TURNOS.includes(turno as Turno) || !PUESTOS.includes(puesto as Puesto))
      throw new HttpError(400, "Casilla inválida.");
    if (typeof colaborador !== "string" || !ROTACION.includes(colaborador))
      throw new HttpError(400, "Colaborador inválido.");
    const n = await editarTurno({ fecha, turno: turno as Turno, puesto: puesto as Puesto, colaborador });
    if (!n) throw new HttpError(404, "Ese día no está generado.");
    return NextResponse.json({ success: true });
  } catch (e) {
    return errorResponse(e);
  }
}
