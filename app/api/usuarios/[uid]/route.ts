import { NextResponse } from "next/server";
import { adminAuth, adminDb } from "@/lib/firebaseAdmin";
import { HttpError, errorResponse, requireAdmin } from "@/lib/authServer";
import { esRolValido } from "@/lib/roles";
import {
  adminsActivos,
  leerUsuario,
  limpiarNombre,
  registrar,
  usuariosCol,
} from "@/lib/usuariosServer";

/** Edita nombre y/o rol. Nadie cambia su propio rol ni deja el sistema sin admin activo. */
export async function PATCH(req: Request, { params }: { params: Promise<{ uid: string }> }) {
  try {
    const yo = await requireAdmin(req);
    const { uid } = await params;
    const body = await req.json().catch(() => ({}));
    const nombre = body.nombre === undefined ? undefined : limpiarNombre(body.nombre);
    const rol = body.rol;

    if (nombre !== undefined && nombre.length < 2)
      throw new HttpError(400, "Escribe el nombre completo.");
    if (rol !== undefined && !esRolValido(rol)) throw new HttpError(400, "Rol desconocido.");

    const cambios = await adminDb.runTransaction(async (tx) => {
      const actual = await leerUsuario(tx, uid);
      const cambiaRol = rol !== undefined && rol !== actual.rol;
      const cambiaNombre = nombre !== undefined && nombre !== actual.nombre;

      if (cambiaRol && uid === yo.uid)
        throw new HttpError(403, "No puedes cambiar tu propio rol. Pídeselo a otro administrador.");
      if (
        cambiaRol &&
        actual.rol === "admin" &&
        actual.activo !== false &&
        (await adminsActivos(tx)) <= 1
      )
        throw new HttpError(
          409,
          "Es el único administrador activo: asigna otro antes de cambiar su rol.",
        );
      if (!cambiaRol && !cambiaNombre) return null;

      tx.update(usuariosCol().doc(uid), {
        ...(cambiaNombre ? { nombre } : {}),
        ...(cambiaRol ? { rol } : {}),
        actualizadoEl: new Date().toISOString(),
        actualizadoPor: yo.nombre,
      });
      const objetivo = { uid, nombre: cambiaNombre ? nombre! : actual.nombre };
      if (cambiaNombre)
        await registrar("editar", objetivo, yo, { nombreAnterior: actual.nombre }, tx);
      if (cambiaRol)
        await registrar("rol", objetivo, yo, { rolAnterior: actual.rol, rolNuevo: rol }, tx);
      return { cambiaNombre, cambiaRol };
    });

    if (cambios?.cambiaNombre) await adminAuth.updateUser(uid, { displayName: nombre });
    return NextResponse.json({ success: true, cambioRol: Boolean(cambios?.cambiaRol) });
  } catch (e) {
    return errorResponse(e);
  }
}
