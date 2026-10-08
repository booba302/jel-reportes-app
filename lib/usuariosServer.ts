import type { Transaction } from "firebase-admin/firestore";
import { adminDb } from "@/lib/firebaseAdmin";
import { HttpError, type Sesion } from "@/lib/authServer";

export type AccionUsuario =
  | "crear"
  | "editar"
  | "rol"
  | "restablecer"
  | "desactivar"
  | "reactivar"
  | "cambio_password";

export const usuariosCol = () => adminDb.collection("usuarios");

const adminsActivosQuery = () =>
  usuariosCol().where("rol", "==", "admin").where("activo", "==", true);

/** Admins activos, leídos dentro de la transacción (regla del último admin sin carreras). */
export async function adminsActivos(tx: Transaction) {
  return (await tx.get(adminsActivosQuery())).size;
}

export async function leerUsuario(tx: Transaction, uid: string) {
  const snap = await tx.get(usuariosCol().doc(uid));
  if (!snap.exists) throw new HttpError(404, "El usuario no existe.");
  return snap.data() as {
    nombre: string;
    email: string;
    rol: string;
    activo: boolean;
  };
}

/** Escribe un registro en `auditoria_usuarios` (solo el servidor escribe ahí). */
export function registrar(
  accion: AccionUsuario,
  objetivo: { uid: string; nombre: string },
  por: Sesion,
  detalle?: { rolAnterior?: string; rolNuevo?: string; nombreAnterior?: string },
  tx?: Transaction,
) {
  const ref = adminDb.collection("auditoria_usuarios").doc();
  const datos = {
    accion,
    objetivoUid: objetivo.uid,
    objetivoNombre: objetivo.nombre,
    porUid: por.uid,
    porNombre: por.nombre,
    el: new Date().toISOString(),
    ...(detalle ? { detalle } : {}),
  };
  if (tx) {
    tx.set(ref, datos);
    return Promise.resolve();
  }
  return ref.set(datos).then(() => undefined);
}

export const normalizarEmail = (e: unknown) => String(e ?? "").trim().toLowerCase();
export const emailValido = (e: string) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(e);
export const limpiarNombre = (n: unknown) => String(n ?? "").trim().replace(/\s+/g, " ");
