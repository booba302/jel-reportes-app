// src/app/api/cambiar-password/route.ts
import { NextResponse } from "next/server";
import { adminAuth } from "@/lib/firebaseAdmin";

export async function POST(request: Request) {
  try {
    const { uid, newPassword } = await request.json();

    if (!uid || !newPassword || newPassword.length < 6) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Datos inválidos. La contraseña debe tener al menos 6 caracteres.",
        },
        { status: 400 },
      );
    }

    // Usamos el SDK de Admin para forzar el cambio de contraseña
    await adminAuth.updateUser(uid, {
      password: newPassword,
    });

    return NextResponse.json({
      success: true,
      message: "La contraseña ha sido actualizada exitosamente.",
    });
  } catch (error: any) {
    console.error("Error al actualizar contraseña:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Hubo un error al intentar cambiar la contraseña.",
      },
      { status: 500 },
    );
  }
}
