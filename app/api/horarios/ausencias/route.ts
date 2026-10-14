import { NextResponse } from "next/server";
import { errorResponse, HttpError, requireAdmin } from "@/lib/authServer";
import { validarAusencia } from "@/lib/horario";
import { crearAusencia, todasAusencias } from "@/lib/horarioRepo";
import { aplicarCambio } from "@/lib/horarioServer";

export async function GET(request: Request) {
  try {
    await requireAdmin(request);
    return NextResponse.json({ success: true, ausencias: await todasAusencias() });
  } catch (e) {
    return errorResponse(e);
  }
}

export async function POST(request: Request) {
  try {
    const s = await requireAdmin(request);
    const b = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    const datos = validarAusencia(b);
    if (typeof datos === "string") throw new HttpError(400, datos);
    await aplicarCambio({ antes: null, despues: datos }, b.confirmar === true, (tx) =>
      crearAusencia(datos, s.nombre || s.email, tx),
    );
    return NextResponse.json({ success: true });
  } catch (e) {
    return errorResponse(e);
  }
}
