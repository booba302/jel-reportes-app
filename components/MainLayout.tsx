// src/components/MainLayout.tsx
"use client";

import React from "react";
import { usePathname } from "next/navigation";
import { Sidebar } from "./Sidebar";
import { useCurrency } from "@/app/context/CurrencyContext";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Coins } from "lucide-react";

// Componente separado para el selector de monedas
function CurrencySelector() {
  const { currency, setCurrency } = useCurrency();

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
          <SelectItem value="PEN">PEN</SelectItem>
          <SelectItem value="CLP">CLP</SelectItem>
          <SelectItem value="MXN">MXN</SelectItem>
          <SelectItem value="USD">USD</SelectItem>
          {/* Agrega otras monedas si las necesitas */}
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

  // Pantalla aislada para el login (sin sidebar ni navbar)
  if (pathname === "/login") {
    return <main className="min-h-screen bg-slate-900">{children}</main>;
  }

  // Layout corporativo para el resto de la app
  return (
    <div className="flex h-screen bg-slate-50 overflow-hidden">
      {/* Panel lateral (Sidebar) */}
      <div className="w-64 flex-shrink-0 h-full z-20">
        <Sidebar />
      </div>

      {/* Contenedor derecho (Navbar Superior + Contenido de las páginas) */}
      <div className="flex-1 flex flex-col h-screen overflow-hidden">
        {/* NAVBAR SUPERIOR */}
        <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-end px-6 shadow-sm flex-shrink-0 z-10">
          <CurrencySelector />
        </header>

        {/* ÁREA PRINCIPAL DONDE CARGAN TUS VISTAS */}
        <main className="flex-1 overflow-y-auto relative">{children}</main>
      </div>
    </div>
  );
}
