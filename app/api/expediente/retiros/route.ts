import { NextResponse } from "next/server";
import { errorResponse, HttpError, requireUser } from "@/lib/authServer";
import { retirosDeOperador } from "@/lib/retirosRepo";
import { diaDeReporte } from "@/lib/retirosFila";

/** Retiros de un operador en un rango (expediente en modo interno). */
export async function GET(request: Request) {
  try {
    await requireUser(request);
    const p = new URL(request.url).searchParams;
    const operador = p.get("operador") ?? "";
    const desde = diaDeReporte(p.get("desde"));
    const hasta = diaDeReporte(p.get("hasta"));
    if (!operador || !desde || !hasta) throw new HttpError(400, "Parámetros inválidos.");
    return NextResponse.json({ success: true, retiros: await retirosDeOperador(operador, desde, hasta) });
  } catch (e) {
    return errorResponse(e);
  }
}
