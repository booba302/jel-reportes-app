import { NextResponse } from "next/server";
import { adminAuth, adminDb } from "@/lib/firebaseAdmin";

/** Quién llama a una ruta de la API. El rol sale SIEMPRE de `usuarios/{uid}`, nunca del body. */
export type Sesion = { uid: string; nombre: string; rol: string; email: string };

export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

export async function requireUser(req: Request): Promise<Sesion> {
  const token = req.headers.get("authorization")?.match(/^Bearer (.+)$/)?.[1];
  if (!token) throw new HttpError(401, "Inicia sesión para continuar.");
  let decoded;
  try {
    decoded = await adminAuth.verifyIdToken(token, true); // true = rechaza tokens revocados
  } catch {
    throw new HttpError(401, "Tu sesión expiró. Vuelve a iniciar sesión.");
  }
  const snap = await adminDb.collection("usuarios").doc(decoded.uid).get();
  const u = snap.data();
  if (!u || u.activo === false) throw new HttpError(403, "Tu acceso está desactivado.");
  return {
    uid: decoded.uid,
    nombre: String(u.nombre ?? ""),
    rol: String(u.rol ?? ""),
    email: String(u.email ?? ""),
  };
}

export async function requireAdmin(req: Request): Promise<Sesion> {
  const s = await requireUser(req);
  if (s.rol !== "admin") throw new HttpError(403, "Solo un administrador puede hacer esto.");
  return s;
}

export function errorResponse(e: unknown) {
  if (e instanceof HttpError)
    return NextResponse.json({ success: false, error: e.message }, { status: e.status });
  console.error(e);
  return NextResponse.json(
    { success: false, error: "Ocurrió un error inesperado." },
    { status: 500 },
  );
}
