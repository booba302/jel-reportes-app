import { NextResponse } from "next/server";
import { errorResponse, HttpError, requireGestorHorario } from "@/lib/authServer";
import { validarAusencia } from "@/lib/horario";
import { ausenciaPorId } from "@/lib/horarioRepo";
import { impactoCambio } from "@/lib/horarioServer";

/** Antes de guardar: cuántas casillas editadas a mano se perderían (crear: sin id; borrar: sin ausencia). */
export async function POST(request: Request) {
  try {
    await requireGestorHorario(request);
    const b = (await request.json().catch(() => ({}))) as { id?: unknown; ausencia?: unknown };
    const antes = typeof b.id === "string" ? await ausenciaPorId(b.id).catch(() => null) : null;
    if (typeof b.id === "string" && !antes) throw new HttpError(404, "La ausencia no existe.");
    let despues = null;
    if (b.ausencia !== undefined) {
      const d = validarAusencia(b.ausencia);
      if (typeof d === "string") throw new HttpError(400, d);
      despues = d;
    }
    const { rango, editadas } = await impactoCambio({ antes, despues });
    return NextResponse.json({ success: true, editadas, desde: rango?.desde ?? null, hasta: rango?.hasta ?? null });
  } catch (e) {
    return errorResponse(e);
  }
}
