// src/components/MainLayout.tsx
"use client";

import React, { useEffect, useMemo, useState } from "react";
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

function CurrencySelector() {
  const { currency, setCurrency } = useCurrency();
  const { userData } = useAuth();

  const rol = userData?.rol || "";

  const monedasPermitidas = useMemo(() => {
    const normalizedRol = rol.toLowerCase();
    if (normalizedRol.includes("admin"))
      return ["GLOBAL", "PEN", "CLP", "MXN", "USD", "VES"];
    if (normalizedRol.includes("nacional")) return ["VES"];
    return ["GLOBAL", "PEN", "CLP", "MXN", "USD"];
  }, [rol]);

  useEffect(() => {
    if (monedasPermitidas.length > 0 && !monedasPermitidas.includes(currency)) {
      setCurrency(monedasPermitidas[0] as any);
    }
  }, [monedasPermitidas, currency, setCurrency]);

  return (
    <div className="flex items-center gap-2 bg-slate-50 px-3 py-1.5 rounded-full border border-slate-200">
      <Coins className="w-4 h-4 text-slate-500" />
      <Select value={currency} onValueChange={(val) => setCurrency(val as any)}>
        <SelectTrigger className="w-[110px] h-8 border-none bg-transparent shadow-none focus:ring-0">
          <SelectValue placeholder="Moneda" />
        </SelectTrigger>
        <SelectContent>
          {monedasPermitidas.map((m) => (
            <SelectItem key={m} value={m}>
              {m}
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
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <Sidebar isOpen={isMobileMenuOpen} setIsOpen={setIsMobileMenuOpen} />

      <div className="flex-1 flex flex-col lg:pl-72 min-w-0">
        <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-4 md:px-6 shadow-sm sticky top-0 z-30 print:hidden">
          <button
            onClick={() => setIsMobileMenuOpen(true)}
            className="lg:hidden p-2 text-slate-500 hover:bg-slate-100 rounded-lg transition-colors"
          >
            <Menu className="w-6 h-6" />
          </button>

          <div className="lg:hidden font-bold text-slate-900">Reportes</div>

          <div className="flex items-center gap-4 ml-auto">
            <CurrencySelector />
          </div>
        </header>

        {/* CONTENIDO DE LA PÁGINA (Con flex-col para empujar el footer abajo) */}
        <main className="flex-1 flex flex-col p-0 md:p-0">
          <div className="flex-1">{children}</div>

          {/* NUEVO FOOTER */}
          <footer className="py-4 text-center text-sm text-slate-400 border-t border-slate-200 bg-white print:hidden mt-auto">
            Desarrollado para{" "}
            <strong>JuegaEnLinea</strong> | v1.0 © 2026
          </footer>
        </main>
      </div>
    </div>
  );
}
