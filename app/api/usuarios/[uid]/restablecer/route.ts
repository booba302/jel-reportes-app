import { NextResponse } from "next/server";
import { adminAuth, adminDb } from "@/lib/firebaseAdmin";
import { errorResponse, requireAdmin } from "@/lib/authServer";
import { passwordTemporal, vencimientoTemporal } from "@/lib/passwordTemporal";
import { leerUsuario, registrar, usuariosCol } from "@/lib/usuariosServer";

/** Nueva contraseña temporal (se devuelve una vez) y cierre de las sesiones abiertas. */
export async function POST(req: Request, { params }: { params: Promise<{ uid: string }> }) {
  try {
    const yo = await requireAdmin(req);
    const { uid } = await params;
    const u = await adminDb.runTransaction((tx) => leerUsuario(tx, uid));

    const password = passwordTemporal();
    await adminAuth.updateUser(uid, { password });
    await usuariosCol().doc(uid).update({
      debeCambiarPassword: true,
      tempPassExpira: vencimientoTemporal(),
    });
    await adminAuth.revokeRefreshTokens(uid);

    await registrar("restablecer", { uid, nombre: u.nombre }, yo);
    return NextResponse.json({ success: true, email: u.email, nombre: u.nombre, password });
  } catch (e) {
    return errorResponse(e);
  }
}
