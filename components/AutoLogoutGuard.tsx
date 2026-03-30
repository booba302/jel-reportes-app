// src/components/AutoLogoutGuard.tsx
"use client";

import { usePathname, useRouter } from "next/navigation";
import { getAuth, signOut } from "firebase/auth";
import { app } from "@/lib/firebase"; // Ajusta esta ruta según donde tengas configurado Firebase
import { toast } from "sonner";
import { useIdleTimeout } from "@/app/hooks/useIdleTimeout";

export function AutoLogoutGuard() {
  const router = useRouter();
  const pathname = usePathname();
  const auth = getAuth(app);

  // No queremos cerrar sesión si ya estamos en la página de login
  const isLoginPage = pathname === "/login"; // Cambia '/login' si tu ruta de acceso se llama diferente

  const handleLogout = async () => {
    if (isLoginPage) return;

    try {
      await signOut(auth);
      // Mostramos un mensaje claro al usuario para que sepa por qué lo sacamos
      toast.warning("Sesión expirada", {
        description:
          "Tu sesión se ha cerrado automáticamente por inactividad para proteger tus datos.",
      });
      router.push("/login");
    } catch (error) {
      console.error("Error al cerrar sesión por inactividad:", error);
    }
  };

  // Configuramos el temporizador a 15 minutos (puedes cambiar este número)
  useIdleTimeout(15, handleLogout);

  // El componente no renderiza nada visual, es un fantasma en el DOM
  return null;
}
