import { NextResponse } from "next/server";
import { adminAuth, adminDb } from "@/lib/firebaseAdmin";
import { HttpError, errorResponse, requireAdmin } from "@/lib/authServer";
import { adminsActivos, leerUsuario, registrar, usuariosCol } from "@/lib/usuariosServer";

/** Activa o desactiva. Desactivar revoca sesiones; nunca a uno mismo ni al último admin activo. */
export async function POST(req: Request, { params }: { params: Promise<{ uid: string }> }) {
  try {
    const yo = await requireAdmin(req);
    const { uid } = await params;
    const body = await req.json().catch(() => ({}));
    if (typeof body.activo !== "boolean") throw new HttpError(400, "Falta el estado.");
    const activo: boolean = body.activo;
    if (uid === yo.uid) throw new HttpError(403, "No puedes desactivar tu propia cuenta.");

    const nombre = await adminDb.runTransaction(async (tx) => {
      // El rol del objetivo se lee aquí, nunca del body.
      const u = await leerUsuario(tx, uid);
      if (!activo && u.rol === "admin" && u.activo !== false && (await adminsActivos(tx)) <= 1)
        throw new HttpError(409, "Es el único administrador activo.");
      tx.update(usuariosCol().doc(uid), {
        activo,
        actualizadoEl: new Date().toISOString(),
        actualizadoPor: yo.nombre,
      });
      await registrar(
        activo ? "reactivar" : "desactivar",
        { uid, nombre: u.nombre },
        yo,
        undefined,
        tx,
      );
      return u.nombre;
    });

    await adminAuth.updateUser(uid, { disabled: !activo });
    if (!activo) await adminAuth.revokeRefreshTokens(uid);
    return NextResponse.json({ success: true, nombre });
  } catch (e) {
    return errorResponse(e);
  }
}
