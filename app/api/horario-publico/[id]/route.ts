import { NextResponse } from "next/server";
import { esMes, hoyEnZona, mesesVisibles } from "@/lib/horario";
import { enlacePorId, mesesGenerados } from "@/lib/horarioRepo";
import { vistaMes } from "@/lib/horarioServer";

const sinCache = { headers: { "Cache-Control": "private, no-store" } };

/**
 * Horario para el enlace anual (sin login). Solo meses generados hasta el mes en curso
 * (hora de Caracas); cualquier otro se rechaza aunque exista. No expone notas ni el tipo
 * de ausencia más allá de "Vacaciones"/"Ausencia".
 */
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    if (!/^[A-Za-z0-9_-]{6,64}$/.test(id))
      return NextResponse.json({ estado: "invalido" }, { status: 404 });
    const enlace = await enlacePorId(id);
    if (!enlace?.activo) return NextResponse.json({ estado: "invalido" }, { status: 404 });

    const meses = mesesVisibles(enlace.anio, hoyEnZona(), await mesesGenerados());
    if (!meses.length) return NextResponse.json({ estado: "sin-meses", anio: enlace.anio }, sinCache);

    const pedido = new URL(request.url).searchParams.get("mes");
    if (pedido !== null && (!esMes(pedido) || !meses.includes(pedido)))
      return NextResponse.json({ estado: "no-disponible" }, { status: 403 });
    const mes = pedido ?? meses.at(-1)!;

    return NextResponse.json(
      { estado: "ok", anio: enlace.anio, meses, mes, ...(await vistaMes(mes)) },
      sinCache,
    );
  } catch (err) {
    console.error("Error armando horario público:", err);
    return NextResponse.json({ estado: "error" }, { status: 500 });
  }
}
