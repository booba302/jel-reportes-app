import { NextResponse } from "next/server";
import { errorResponse, HttpError, requireUser } from "@/lib/authServer";
import { sql } from "@/lib/db";
import { exigirMoneda } from "@/lib/monedasServer";

/** Guarda (o borra, con "") el comentario de brecha de un retiro. */
export async function PATCH(request: Request) {
  try {
    const yo = await requireUser(request);
    const { id, comentario } = await request.json();
    if (typeof id !== "string" || typeof comentario !== "string" || comentario.length > 2000)
      throw new HttpError(400, "Datos inválidos.");

    const [fila] = await sql`select moneda from retiros where id = ${id}`;
    if (!fila) throw new HttpError(404, "El retiro ya no existe. Recarga la página.");
    exigirMoneda(yo, fila.moneda);

    await sql`update retiros set comentario_brecha = ${comentario} where id = ${id}`;
    return NextResponse.json({ success: true });
  } catch (e) {
    return errorResponse(e);
  }
}
