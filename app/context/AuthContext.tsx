"use client";

import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { auth, db } from "@/lib/firebase";
import { onAuthStateChanged, User, signOut } from "firebase/auth";
import { doc, onSnapshot } from "firebase/firestore";
import { useRouter, usePathname } from "next/navigation";
import { Loader2 } from "lucide-react";
import type { Rol } from "@/lib/roles";

export type UserData = {
  nombre: string;
  email: string;
  rol: Rol;
  activo: boolean;
  debeCambiarPassword: boolean;
  tempPassExpira: string | null;
};

/** Por qué se cerró la sesión; el login muestra el mensaje (`/login?motivo=`). */
export type MotivoSalida = "desactivado" | "sin-perfil" | "temporal-vencida";

interface AuthContextType {
  user: User | null;
  userData: UserData | null;
  loading: boolean;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  userData: null,
  loading: true,
  logout: async () => {},
});

function leerPerfil(data: Record<string, unknown>): UserData {
  return {
    nombre: String(data.nombre ?? ""),
    email: String(data.email ?? ""),
    rol: String(data.rol ?? "") as Rol,
    activo: data.activo !== false,
    debeCambiarPassword: data.debeCambiarPassword === true,
    tempPassExpira: typeof data.tempPassExpira === "string" ? data.tempPassExpira : null,
  };
}

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [userData, setUserData] = useState<UserData | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const pathname = usePathname();
  // Si la app saca al usuario, el guardia de rutas lleva al login con el motivo.
  const motivoRef = useRef<MotivoSalida | null>(null);

  const isPublicRoute =
    pathname === "/login" || pathname.startsWith("/evaluacion-operador");

  const expulsar = useCallback(async (motivo: MotivoSalida) => {
    motivoRef.current = motivo;
    await signOut(auth);
  }, []);

  useEffect(() => {
    let dejarDeEscuchar: (() => void) | null = null;

    const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
      dejarDeEscuchar?.();
      dejarDeEscuchar = null;

      if (!firebaseUser) {
        setUser(null);
        setUserData(null);
        setLoading(false);
        return;
      }

      setUser(firebaseUser);
      // onSnapshot: si un admin lo desactiva o le cambia el rol, la app reacciona sin recargar.
      dejarDeEscuchar = onSnapshot(
        doc(db, "usuarios", firebaseUser.uid),
        (snap) => {
          if (!snap.exists()) {
            void expulsar("sin-perfil");
            return;
          }
          const perfil = leerPerfil(snap.data());
          if (!perfil.activo) {
            void expulsar("desactivado");
            return;
          }
          if (
            perfil.debeCambiarPassword &&
            perfil.tempPassExpira &&
            new Date(perfil.tempPassExpira).getTime() < Date.now()
          ) {
            void expulsar("temporal-vencida");
            return;
          }
          setUserData(perfil);
          setLoading(false);
        },
        (error) => {
          // Sin permiso para leer el propio perfil (p. ej. sesión revocada): se trata como sin perfil.
          console.error("Error obteniendo datos del usuario:", error);
          void expulsar("sin-perfil");
        },
      );
    });

    return () => {
      dejarDeEscuchar?.();
      unsubscribe();
    };
  }, [expulsar]);

  // Protección de rutas
  useEffect(() => {
    if (loading) return;
    if (!user) {
      const motivo = motivoRef.current;
      if (motivo) {
        motivoRef.current = null;
        router.replace(`/login?motivo=${motivo}`);
      } else if (!isPublicRoute) {
        router.push("/login");
      }
      return;
    }
    if (!userData) return;
    // Con contraseña temporal se lo obliga a ir al cambio de contraseña.
    if (userData.debeCambiarPassword && pathname !== "/cambiar-credenciales") {
      router.push("/cambiar-credenciales");
    }
    // Sin la bandera, se lo saca del login o del cambio de contraseña.
    else if (
      !userData.debeCambiarPassword &&
      (pathname === "/login" || pathname === "/cambiar-credenciales")
    ) {
      router.push("/");
    }
  }, [user, loading, pathname, router, userData, isPublicRoute]);

  const logout = async () => {
    await signOut(auth);
    router.push("/login");
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="size-10 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!user && isPublicRoute) {
    return (
      <AuthContext.Provider value={{ user, userData, loading, logout }}>
        {children}
      </AuthContext.Provider>
    );
  }

  // Si hay usuario con perfil válido, renderizamos la app normalmente
  return (
    <AuthContext.Provider value={{ user, userData, loading, logout }}>
      {user && userData ? children : null}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
