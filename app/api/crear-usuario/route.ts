// src/app/api/crear-usuario/route.ts
import { NextResponse } from "next/server";
import { adminAuth, adminDb } from "@/lib/firebaseAdmin";

export async function POST(request: Request) {
  try {
    const { nombre, email, password, rol } = await request.json();

    if (!nombre || !email || !password || !rol) {
      return NextResponse.json(
        { success: false, error: "Todos los campos son obligatorios." },
        { status: 400 },
      );
    }

    // 1. Creamos el usuario en la bóveda de Authentication de Firebase
    const userRecord = await adminAuth.createUser({
      email,
      password,
      displayName: nombre,
    });

    // 2. Registramos su perfil y permisos en la base de datos (Firestore)
    await adminDb.collection("usuarios").doc(userRecord.uid).set({
      email,
      nombre,
      rol,
      activo: true,
      debeCambiarPassword: true,
      fechaCreacion: new Date().toISOString(),
    });

    return NextResponse.json({
      success: true,
      message: `El usuario ${nombre} ha sido creado exitosamente con el rol de ${rol}.`,
    });
  } catch (error: any) {
    console.error("Error al crear usuario en Admin SDK:", error);

    // Manejo de errores amigables para Firebase
    let errorMessage = "Hubo un error al crear el usuario.";
    if (error.code === "auth/email-already-exists") {
      errorMessage =
        "Este correo electrónico ya está registrado en el sistema.";
    } else if (error.code === "auth/invalid-password") {
      errorMessage = "La contraseña debe tener al menos 6 caracteres.";
    }

    return NextResponse.json(
      { success: false, error: errorMessage },
      { status: 500 },
    );
  }
}
