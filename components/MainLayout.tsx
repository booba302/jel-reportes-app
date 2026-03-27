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
    <div className="flex h-screen bg-slate-50 overflow-hidden w-full print:h-auto print:overflow-visible print:bg-white">
      {/* SIDEBAR ESCRITORIO (Oculto en móviles y al imprimir) */}
      <div className="hidden md:flex w-64 flex-shrink-0 h-full z-20 print:hidden">
        <Sidebar />
      </div>

      {/* SIDEBAR MÓVIL */}
      {isMobileMenuOpen && (
        <div className="fixed inset-0 z-50 flex md:hidden print:hidden">
          <div
            className="fixed inset-0 bg-slate-900/80 backdrop-blur-sm transition-opacity"
            onClick={() => setIsMobileMenuOpen(false)}
          />
          <div className="relative flex-1 flex w-full max-w-[280px] animate-in slide-in-from-left duration-300">
            <Sidebar onMobileClose={() => setIsMobileMenuOpen(false)} />
          </div>
        </div>
      )}

      {/* CONTENEDOR PRINCIPAL DERECHO */}
      <div className="flex-1 flex flex-col h-screen overflow-hidden min-w-0 print:h-auto print:overflow-visible print:block">
        {/* NAVBAR SUPERIOR */}
        <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-between md:justify-end px-4 md:px-6 shadow-sm flex-shrink-0 z-10 print:hidden">
          <button
            onClick={() => setIsMobileMenuOpen(true)}
            className="md:hidden p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-700 rounded-lg transition-colors"
          >
            {/* Si no tienes importado Menu, asegúrate de tenerlo arriba: import { Menu } from 'lucide-react'; */}
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <line x1="4" x2="20" y1="12" y2="12" />
              <line x1="4" x2="20" y1="6" y2="6" />
              <line x1="4" x2="20" y1="18" y2="18" />
            </svg>
          </button>
          <CurrencySelector />
        </header>

        {/* ÁREA PRINCIPAL DONDE CARGAN TUS VISTAS */}
        <main className="flex-1 overflow-y-auto relative w-full print:overflow-visible print:h-auto print:block">
          {children}
        </main>
      </div>
    </div>
  );
}
