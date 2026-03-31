// src/components/DashboardLayout.tsx
"use client";

import * as React from "react";
import { Menu } from "lucide-react";
import { Sidebar } from "@/components/Sidebar";

export function DashboardLayout({ children }: { children: React.ReactNode }) {
  // Estado para controlar si el menú móvil está abierto
  const [isMobileOpen, setIsMobileOpen] = React.useState(false);

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col relative">
      {/* 1. SIDEBAR INTELIGENTE:
          Le pasamos sus propiedades obligatorias. Él se encargará de ser fijo 
          en escritorio y de mostrar el overlay oscuro en móviles.
      */}
      <Sidebar isOpen={isMobileOpen} setIsOpen={setIsMobileOpen} />

      {/* 2. CONTENEDOR PRINCIPAL:
          Usamos lg:pl-72 para dejar el espacio del menú en pantallas grandes.
      */}
      <div className="flex flex-col lg:pl-72 min-h-screen min-w-0">
        {/* 3. HEADER MÓVIL (Solo visible en pantallas pequeñas lg:hidden) */}
        <div className="lg:hidden sticky top-0 z-30 flex items-center gap-x-4 bg-white border-b border-slate-200 px-4 py-4 shadow-sm sm:px-6 print:hidden">
          <button
            onClick={() => setIsMobileOpen(true)}
            className="-m-2.5 p-2.5 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-md transition-colors"
          >
            <span className="sr-only">Abrir menú</span>
            <Menu className="w-6 h-6" />
          </button>
          <div className="flex-1 text-base font-bold text-slate-900">
            Reportes
          </div>
        </div>

        {/* 4. CONTENIDO DE LAS VISTAS */}
        <main className="flex-1 p-0">{children}</main>
      </div>
    </div>
  );
}
