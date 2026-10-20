import { NextResponse } from "next/server";
import { errorResponse, HttpError, requireGestorHorario } from "@/lib/authServer";
import { esFecha, validarDiaEspecial } from "@/lib/horario";
import { eliminarEspecial, guardarEspecial, todosEspeciales } from "@/lib/horarioRepo";
import { aplicarDiaEspecial, impactoDiaEspecial } from "@/lib/horarioServer";

/** Lista de días especiales, o con `?impacto=fecha` cuántas casillas editadas se perderían. */
export async function GET(request: Request) {
  try {
    await requireGestorHorario(request);
    const impacto = new URL(request.url).searchParams.get("impacto");
    if (impacto !== null) {
      if (!esFecha(impacto)) throw new HttpError(400, "Fecha inválida.");
      return NextResponse.json({ success: true, editadas: await impactoDiaEspecial(impacto) });
    }
    return NextResponse.json({ success: true, especiales: await todosEspeciales() });
  } catch (e) {
    return errorResponse(e);
  }
}

/** Crea o cambia el día especial de una fecha y rehace ese día si ya está generado. */
export async function PUT(request: Request) {
  try {
    const s = await requireGestorHorario(request);
    const b = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    const datos = validarDiaEspecial(b);
    if (typeof datos === "string") throw new HttpError(400, datos);
    await aplicarDiaEspecial(datos.fecha, b.confirmar === true, (tx) =>
      guardarEspecial(datos, s.nombre || s.email, tx),
    );
    return NextResponse.json({ success: true });
  } catch (e) {
    return errorResponse(e);
  }
}

/** `?fecha=YYYY-MM-DD[&confirmar=1]`: el día vuelve a ser normal. */
export async function DELETE(request: Request) {
  try {
    await requireGestorHorario(request);
    const q = new URL(request.url).searchParams;
    const fecha = q.get("fecha");
    if (!esFecha(fecha)) throw new HttpError(400, "Fecha inválida.");
    await aplicarDiaEspecial(fecha, q.get("confirmar") === "1", async (tx) => {
      if (!(await eliminarEspecial(fecha, tx))) throw new HttpError(404, "Ese día especial no existe.");
    });
    return NextResponse.json({ success: true });
  } catch (e) {
    return errorResponse(e);
  }
}
