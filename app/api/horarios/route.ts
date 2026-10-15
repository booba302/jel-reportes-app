import { NextResponse } from "next/server";
import { errorResponse, HttpError, requireAdmin } from "@/lib/authServer";
import { esMes, primerDia, ultimoDia } from "@/lib/horario";
import * as repo from "@/lib/horarioRepo";
import { generarMes } from "@/lib/horarioServer";

/** Turnos y ausencias de un mes, para la página de administración. */
export async function GET(request: Request) {
  try {
    await requireAdmin(request);
    const mes = new URL(request.url).searchParams.get("mes");
    if (!esMes(mes)) throw new HttpError(400, "Mes inválido.");
    const [turnos, ausencias, especiales, generados, estadoInicial] = await Promise.all([
      repo.turnosEntre(primerDia(mes), ultimoDia(mes)),
      repo.ausenciasQueTocan(primerDia(mes), ultimoDia(mes)),
      repo.especialesEntre(primerDia(mes), ultimoDia(mes)),
      repo.mesesGenerados(),
      repo.estadoEn(primerDia(mes)),
    ]);
    return NextResponse.json({
      success: true,
      turnos,
      ausencias,
      especiales,
      generados,
      puedeGenerar: !generados.includes(mes) && !!estadoInicial,
    });
  } catch (e) {
    return errorResponse(e);
  }
}

/** Genera el mes pedido. */
export async function POST(request: Request) {
  try {
    const s = await requireAdmin(request);
    const { mes } = (await request.json().catch(() => ({}))) as { mes?: unknown };
    if (!esMes(mes)) throw new HttpError(400, "Mes inválido.");
    await generarMes(mes, s.nombre || s.email);
    return NextResponse.json({ success: true });
  } catch (e) {
    return errorResponse(e);
  }
}
