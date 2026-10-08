import { NextResponse } from "next/server";
import { adminAuth } from "@/lib/firebaseAdmin";
import { HttpError, errorResponse, requireAdmin } from "@/lib/authServer";
import { esRolValido } from "@/lib/roles";
import { passwordTemporal, vencimientoTemporal } from "@/lib/passwordTemporal";
import {
  emailValido,
  limpiarNombre,
  normalizarEmail,
  registrar,
  usuariosCol,
} from "@/lib/usuariosServer";

/** Lista de usuarios con su último acceso (sale de Firebase Auth). */
export async function GET(req: Request) {
  try {
    await requireAdmin(req);
    const snap = await usuariosCol().get();
    const ids = snap.docs.map((d) => d.id);

    const ultimo = new Map<string, string | null>();
    for (let i = 0; i < ids.length; i += 100) {
      const { users } = await adminAuth.getUsers(ids.slice(i, i + 100).map((uid) => ({ uid })));
      for (const u of users)
        ultimo.set(
          u.uid,
          u.metadata.lastSignInTime ? new Date(u.metadata.lastSignInTime).toISOString() : null,
        );
    }

    const usuarios = snap.docs.map((d) => {
      const u = d.data();
      return {
        uid: d.id,
        nombre: String(u.nombre ?? ""),
        email: String(u.email ?? ""),
        rol: String(u.rol ?? ""),
        activo: u.activo !== false,
        debeCambiarPassword: u.debeCambiarPassword === true,
        tempPassExpira: u.tempPassExpira ?? null,
        fechaCreacion: u.fechaCreacion ?? null,
        creadoPor: u.creadoPor ?? null,
        ultimoAcceso: ultimo.get(d.id) ?? null,
      };
    });
    return NextResponse.json({ success: true, usuarios });
  } catch (e) {
    return errorResponse(e);
  }
}

/** Crea un usuario con contraseña temporal. La contraseña se devuelve UNA sola vez. */
export async function POST(req: Request) {
  try {
    const yo = await requireAdmin(req);
    const body = await req.json().catch(() => ({}));
    const nombre = limpiarNombre(body.nombre);
    const email = normalizarEmail(body.email);
    const rol = body.rol;

    if (nombre.length < 2) throw new HttpError(400, "Escribe el nombre completo.");
    if (!emailValido(email)) throw new HttpError(400, "Escribe un correo válido.");
    if (!esRolValido(rol)) throw new HttpError(400, "Rol desconocido.");

    const password = passwordTemporal();
    let uid: string;
    try {
      uid = (await adminAuth.createUser({ email, password, displayName: nombre })).uid;
    } catch (e) {
      if ((e as { code?: string }).code === "auth/email-already-exists")
        throw new HttpError(409, "Ya existe un usuario con este correo.");
      throw e;
    }

    const ahora = new Date();
    try {
      await usuariosCol().doc(uid).set({
        nombre,
        email,
        rol,
        activo: true,
        debeCambiarPassword: true,
        tempPassExpira: vencimientoTemporal(ahora),
        fechaCreacion: ahora.toISOString(),
        creadoPor: yo.nombre,
        creadoPorUid: yo.uid,
        actualizadoEl: ahora.toISOString(),
        actualizadoPor: yo.nombre,
      });
    } catch (e) {
      // Sin perfil no podría entrar: se deshace la cuenta de Auth para poder reintentar.
      await adminAuth.deleteUser(uid).catch(() => {});
      throw e;
    }

    await registrar("crear", { uid, nombre }, yo, { rolNuevo: rol });
    return NextResponse.json({ success: true, uid, email, nombre, password });
  } catch (e) {
    return errorResponse(e);
  }
}
