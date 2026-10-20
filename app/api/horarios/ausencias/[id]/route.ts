import { NextResponse } from "next/server";
import { errorResponse, HttpError, requireGestorHorario } from "@/lib/authServer";
import { validarAusencia } from "@/lib/horario";
import { actualizarAusencia, ausenciaPorId, eliminarAusencia } from "@/lib/horarioRepo";
import { aplicarCambio } from "@/lib/horarioServer";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function cargar(params: Promise<{ id: string }>) {
  const { id } = await params;
  const antes = UUID.test(id) ? await ausenciaPorId(id) : null;
  if (!antes) throw new HttpError(404, "La ausencia no existe.");
  return antes;
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireGestorHorario(request);
    const antes = await cargar(params);
    const b = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    const datos = validarAusencia(b);
    if (typeof datos === "string") throw new HttpError(400, datos);
    await aplicarCambio({ antes, despues: datos }, b.confirmar === true, (tx) =>
      actualizarAusencia(antes.id, datos, tx),
    );
    return NextResponse.json({ success: true });
  } catch (e) {
    return errorResponse(e);
  }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireGestorHorario(request);
    const antes = await cargar(params);
    const confirmar = new URL(request.url).searchParams.get("confirmar") === "1";
    await aplicarCambio({ antes, despues: null }, confirmar, (tx) => eliminarAusencia(antes.id, tx));
    return NextResponse.json({ success: true });
  } catch (e) {
    return errorResponse(e);
  }
}
