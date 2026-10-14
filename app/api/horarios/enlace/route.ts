import { NextResponse } from "next/server";
import { errorResponse, HttpError, requireAdmin } from "@/lib/authServer";
import { crearEnlace, enlaceActivo } from "@/lib/horarioRepo";

const leerAnio = (v: unknown) => {
  const anio = Number(v);
  if (!Number.isInteger(anio) || anio < 2026 || anio > 2100) throw new HttpError(400, "Año inválido.");
  return anio;
};

/** Enlace activo del año; se crea la primera vez. */
export async function GET(request: Request) {
  try {
    const s = await requireAdmin(request);
    const anio = leerAnio(new URL(request.url).searchParams.get("anio"));
    const id = (await enlaceActivo(anio)) ?? (await crearEnlace(anio, s.nombre || s.email));
    return NextResponse.json({ success: true, id });
  } catch (e) {
    return errorResponse(e);
  }
}

/** Reemplaza el enlace del año: el anterior deja de funcionar. */
export async function POST(request: Request) {
  try {
    const s = await requireAdmin(request);
    const { anio } = (await request.json().catch(() => ({}))) as { anio?: unknown };
    const id = await crearEnlace(leerAnio(anio), s.nombre || s.email);
    return NextResponse.json({ success: true, id });
  } catch (e) {
    return errorResponse(e);
  }
}
