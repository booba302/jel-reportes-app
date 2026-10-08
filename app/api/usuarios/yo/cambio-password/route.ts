import { NextResponse } from "next/server";
import { errorResponse, requireUser } from "@/lib/authServer";
import { registrar } from "@/lib/usuariosServer";

/** El propio usuario avisa que cambió su contraseña temporal (solo registra en la auditoría). */
export async function POST(req: Request) {
  try {
    const yo = await requireUser(req);
    await registrar("cambio_password", { uid: yo.uid, nombre: yo.nombre }, yo);
    return NextResponse.json({ success: true });
  } catch (e) {
    return errorResponse(e);
  }
}
