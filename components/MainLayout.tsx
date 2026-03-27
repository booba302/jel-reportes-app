// src/components/MainLayout.tsx
"use client";

import React, { useEffect, useMemo, useState } from "react";
import { usePathname } from "next/navigation";
import { Sidebar } from "./Sidebar";
import { useCurrency } from "@/app/context/CurrencyContext";
import { useAuth } from "@/app/context/AuthContext";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Coins, Menu } from "lucide-react";

// Componente inteligente para el selector de monedas
function CurrencySelector() {
  const { currency, setCurrency } = useCurrency();
  const { userData } = useAuth();

  const rol = userData?.rol || "";

  // 1. Definimos qué monedas ve cada rol
  const monedasPermitidas = useMemo(() => {
    if (rol === "admin") return ["GLOBAL", "PEN", "CLP", "MXN", "USD", "VES"];
    if (rol === "agente_retiros_nacional") return ["VES"];
    return ["GLOBAL", "PEN", "CLP", "MXN", "USD"]; // Internacional
  }, [rol]);

  // 2. Efecto de seguridad: Si la moneda actual no está en su lista permitida, lo cambiamos a la primera que sí tenga
  useEffect(() => {
    if (monedasPermitidas.length > 0 && !monedasPermitidas.includes(currency)) {
      setCurrency(monedasPermitidas[0] as any); // <-- Solo agregamos "as any" aquí
    }
  }, [monedasPermitidas, currency, setCurrency]);

  // Si aún no carga el usuario, no mostramos el selector para evitar parpadeos
  if (!rol) return null;

  return (
    <div className="flex items-center gap-3 bg-slate-50 px-3 py-1.5 rounded-lg border border-slate-200">
      <Coins className="w-4 h-4 text-slate-500" />
      <span className="text-sm font-medium text-slate-600 hidden sm:inline-block">
        Moneda:
      </span>
      <Select value={currency} onValueChange={(val: any) => setCurrency(val)}>
        <SelectTrigger className="w-[110px] h-8 bg-white border-slate-300 text-xs font-bold">
          <SelectValue placeholder="Moneda" />
        </SelectTrigger>
        <SelectContent>
          {/* 3. Renderizamos dinámicamente solo las monedas a las que tiene acceso */}
          {monedasPermitidas.map((moneda) => (
            <SelectItem key={moneda} value={moneda}>
              {moneda}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

export default function MainLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false); // <-- Estado para el menú móvil

  if (pathname === "/login" || pathname === "/cambiar-credenciales") {
    return <main className="min-h-screen bg-slate-900">{children}</main>;
  }

  return (
    <div className="flex h-screen bg-slate-50 overflow-hidden w-full">
      {/* SIDEBAR ESCRITORIO (Oculto en móviles) */}
      <div className="hidden md:flex w-64 flex-shrink-0 h-full z-20">
        <Sidebar />
      </div>

      {/* SIDEBAR MÓVIL (Con fondo oscuro semi-transparente) */}
      {isMobileMenuOpen && (
        <div className="fixed inset-0 z-50 flex md:hidden">
          {/* Fondo oscuro que cierra el menú al hacer clic */}
          <div
            className="fixed inset-0 bg-slate-900/80 backdrop-blur-sm transition-opacity"
            onClick={() => setIsMobileMenuOpen(false)}
          />
          {/* Contenedor del menú que entra por la izquierda */}
          <div className="relative flex-1 flex w-full max-w-[280px] animate-in slide-in-from-left duration-300">
            <Sidebar onMobileClose={() => setIsMobileMenuOpen(false)} />
          </div>
        </div>
      )}

      {/* CONTENEDOR PRINCIPAL DERECHO */}
      <div className="flex-1 flex flex-col h-screen overflow-hidden min-w-0">
        {/* NAVBAR SUPERIOR */}
        <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-between md:justify-end px-4 md:px-6 shadow-sm flex-shrink-0 z-10">
          {/* Botón Hamburguesa (Solo visible en móviles) */}
          <button
            onClick={() => setIsMobileMenuOpen(true)}
            className="md:hidden p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-700 rounded-lg transition-colors"
          >
            <Menu className="w-6 h-6" />
          </button>

          {/* Selector de Monedas */}
          <CurrencySelector />
        </header>

        {/* ÁREA PRINCIPAL DONDE CARGAN TUS VISTAS */}
        <main className="flex-1 overflow-y-auto relative w-full">
          {children}
        </main>
      </div>
    </div>
  );
}
