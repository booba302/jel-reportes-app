import { NextResponse } from "next/server";
import { esMes, hoyEnZona, mesesVisibles, primerDia, ultimoDia } from "@/lib/horario";
import { ausenciasQueTocan, enlacePorId, especialesEntre, mesesGenerados, turnosEntre } from "@/lib/horarioRepo";

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

    const [turnos, ausencias, especiales] = await Promise.all([
      turnosEntre(primerDia(mes), ultimoDia(mes)),
      ausenciasQueTocan(primerDia(mes), ultimoDia(mes)),
      especialesEntre(primerDia(mes), ultimoDia(mes)),
    ]);
    return NextResponse.json(
      {
        estado: "ok",
        anio: enlace.anio,
        meses,
        mes,
        turnos: turnos.map(({ fecha, turno, puesto, colaborador }) => ({ fecha, turno, puesto, colaborador })),
        ausencias: ausencias.map((a) => ({
          colaborador: a.colaborador,
          tipo: a.tipo === "vacaciones" ? "Vacaciones" : "Ausencia",
          inicio: a.inicio,
          retorno: a.retorno,
        })),
        especiales,
      },
      sinCache,
    );
  } catch (err) {
    console.error("Error armando horario público:", err);
    return NextResponse.json({ estado: "error" }, { status: 500 });
  }
}
