"use client";

import React, { useEffect, useMemo, useState } from "react";
import { usePathname } from "next/navigation";
import { Menu } from "lucide-react";
import { Sidebar } from "./Sidebar";
import { ThemeToggle } from "./ThemeToggle";
import { useCurrency, type Currency } from "@/app/context/CurrencyContext";
import { useAuth } from "@/app/context/AuthContext";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { monedasPermitidas } from "@/lib/monedas";
import { BreadcrumbProvider, useBreadcrumbOverride } from "./BreadcrumbContext";

// Breadcrumb por ruta: [sección, página]
const BREADCRUMBS: Record<string, [string, string]> = {
  "/": ["Analítica", "Visión de rendimiento"],
  "/reportes": ["Gestión operativa", "Reportes"],
  "/evaluacion-diaria": ["Gestión operativa", "Evaluación diaria"],
  "/auditoria-diaria": ["Analítica", "Auditoría diaria"],
  "/monitor-regional": ["Analítica", "Monitor regional"],
  "/cierre-mensual": ["Analítica", "Cierre mensual"],
  "/expediente": ["Analítica", "Expediente"],
  "/gestor-usuarios": ["Administración", "Gestión de usuarios"],
};

function getBreadcrumb(pathname: string): string[] | null {
  if (BREADCRUMBS[pathname]) return BREADCRUMBS[pathname];
  const base = "/" + (pathname.split("/")[1] ?? "");
  return BREADCRUMBS[base] ?? null;
}

function CurrencySelector() {
  const { currency, setCurrency } = useCurrency();
  const { userData } = useAuth();

  const rol = userData?.rol || "";

  const permitidas = useMemo(() => monedasPermitidas(rol), [rol]);

  useEffect(() => {
    if (permitidas.length > 0 && !permitidas.includes(currency)) {
      setCurrency(permitidas[0]);
    }
  }, [permitidas, currency, setCurrency]);

  return (
    <ToggleGroup
      type="single"
      value={currency}
      onValueChange={(v) => v && setCurrency(v as Currency)}
      aria-label="Moneda"
      spacing={0.5}
      className="flex-wrap rounded-[9px] border border-border bg-muted p-[3px]"
    >
      {permitidas.map((m) => (
        <ToggleGroupItem
          key={m}
          value={m}
          className="h-[30px] min-w-12 rounded-[7px] px-2.5 font-mono text-xs font-semibold text-muted-foreground hover:bg-transparent hover:text-foreground data-[state=on]:bg-segment-active data-[state=on]:text-foreground data-[state=on]:shadow-[0_1px_2px_rgba(0,0,0,.18),0_0_0_1px_var(--input)]"
        >
          {m}
        </ToggleGroupItem>
      ))}
    </ToggleGroup>
  );
}

function AppHeader({ onOpenMenu }: { onOpenMenu: () => void }) {
  const pathname = usePathname();
  const override = useBreadcrumbOverride();
  const crumb = override ?? getBreadcrumb(pathname);

  return (
    <header className="sticky top-0 z-30 flex flex-wrap items-center justify-between gap-3 border-b border-border bg-sidebar px-4 py-3 md:px-7 print:hidden">
      <div className="flex min-w-0 items-center gap-2">
        <button
          type="button"
          onClick={onOpenMenu}
          aria-label="Abrir menú"
          className="-ml-1.5 rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground lg:hidden"
        >
          <Menu className="size-5" />
        </button>
        {crumb && (
          <nav
            aria-label="Ruta"
            className="truncate text-[13px] text-muted-foreground"
          >
            {crumb.slice(0, -1).map((c) => `${c} / `)}
            <span className="font-medium text-foreground">
              {crumb[crumb.length - 1]}
            </span>
          </nav>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-2.5">
        <CurrencySelector />
        <ThemeToggle />
      </div>
    </header>
  );
}

export default function MainLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  return (
    <BreadcrumbProvider>
      <div className="min-h-screen bg-background text-foreground">
        <Sidebar isOpen={isMobileMenuOpen} setIsOpen={setIsMobileMenuOpen} />

        <div className="flex min-h-screen min-w-0 flex-1 flex-col lg:pl-[248px]">
          <AppHeader onOpenMenu={() => setIsMobileMenuOpen(true)} />

          <main className="flex flex-1 flex-col">
            <div className="flex-1">{children}</div>
            <footer className="py-4 text-center text-xs text-muted-foreground print:hidden">
              Desarrollado para JuegaEnLinea · v1.0 © 2026
            </footer>
          </main>
        </div>
      </div>
    </BreadcrumbProvider>
  );
}
