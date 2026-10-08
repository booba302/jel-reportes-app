import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebaseAdmin";
import { construirExpediente } from "@/lib/expediente";
import { cargadorServidor } from "@/lib/expedienteServer";

/**
 * Datos del expediente para el enlace público (sin login).
 * Valida el enlace y devuelve SOLO el expediente de ese operador y mes
 * (más promedios del equipo); nunca el ranking ni datos de otros operadores.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  try {
    if (!/^[A-Za-z0-9_-]{6,64}$/.test(id))
      return NextResponse.json({ estado: "invalido" }, { status: 404 });

    const enlace = await adminDb.collection("enlaces_expedientes").doc(id).get();
    if (!enlace.exists) return NextResponse.json({ estado: "invalido" }, { status: 404 });

    const { operador, mes, expiraEl } = enlace.data() as {
      operador?: string;
      mes?: string;
      expiraEl?: string;
    };
    if (!operador || !mes || !/^\d{4}-\d{2}$/.test(mes))
      return NextResponse.json({ estado: "invalido" }, { status: 404 });
    if (expiraEl && new Date(expiraEl).getTime() < Date.now())
      return NextResponse.json({ estado: "expirado", operador, mes }, { status: 410 });

    const resultado = await construirExpediente(cargadorServidor, {
      operador,
      mes,
      alcance: { modo: "publico" },
    });
    return NextResponse.json(resultado, {
      headers: { "Cache-Control": "private, no-store" },
    });
  } catch (err) {
    console.error("Error armando expediente público:", err);
    return NextResponse.json({ estado: "error" }, { status: 500 });
  }
}
