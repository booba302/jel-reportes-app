// src/app/api/toggle-estado-usuario/route.ts
import { NextResponse } from "next/server";
import { adminAuth, adminDb } from "@/lib/firebaseAdmin";

export async function POST(request: Request) {
  try {
    const { uid, activo, rol } = await request.json();

    if (!uid) {
      return NextResponse.json(
        { success: false, error: "Falta el ID del usuario." },
        { status: 400 },
      );
    }

    // Regla de oro: Los administradores no se pueden bloquear
    if (rol === "admin") {
      return NextResponse.json(
        {
          success: false,
          error: "Por seguridad, no se puede desactivar a un administrador.",
        },
        { status: 403 },
      );
    }

    // 1. Firebase Auth: 'disabled' es lo opuesto de 'activo'
    await adminAuth.updateUser(uid, {
      disabled: !activo,
    });

    // 2. Firestore: actualizamos el texto visual para la tabla
    await adminDb.collection("usuarios").doc(uid).update({
      activo: activo,
    });

    return NextResponse.json({
      success: true,
      message: `El usuario ahora está ${activo ? "activo y con acceso" : "inactivo y bloqueado"}.`,
    });
  } catch (error: any) {
    console.error("Error al cambiar estado del usuario:", error);
    return NextResponse.json(
      { success: false, error: "Hubo un error al cambiar el estado." },
      { status: 500 },
    );
  }
}
