"use client";

import React, { useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Home,
  CalendarCheck,
  SquareCheck,
  Activity,
  Globe,
  Trophy,
  Users,
  LogOut,
  X,
  LucideIcon,
} from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { cn, getInitials } from "@/lib/utils";
import { useAuth } from "@/app/context/AuthContext";
import { parseUserRole } from "@/lib/roles";

type MenuItem = {
  label: string;
  icon: LucideIcon;
  href: string;
  requireAdmin?: boolean;
  allowedRoles?: string[];
};

type MenuGroup = {
  id: string;
  title: string | null;
  items: MenuItem[];
  allowedRoles?: string[];
};

const menuGroups: MenuGroup[] = [
  {
    id: "inicio",
    title: null,
    items: [{ label: "Inicio", icon: Home, href: "/" }],
  },
  {
    id: "operaciones",
    title: "Gestión operativa",
    items: [
      { label: "Reportes", icon: CalendarCheck, href: "/reportes" },
      {
        label: "Evaluación diaria",
        icon: SquareCheck,
        href: "/evaluacion-diaria",
      },
    ],
  },
  {
    id: "analitica",
    title: "Analítica y desempeño",
    items: [
      { label: "Auditoría diaria", icon: Activity, href: "/auditoria-diaria" },
      {
        label: "Monitor regional",
        icon: Globe,
        href: "/monitor-regional",
        requireAdmin: true,
      },
      { label: "Cierre mensual", icon: Trophy, href: "/cierre-mensual" },
    ],
  },
  {
    id: "admin",
    title: "Administración",
    items: [
      {
        label: "Gestión de usuarios",
        icon: Users,
        href: "/gestor-usuarios",
        requireAdmin: true,
      },
    ],
  },
];

export function Sidebar({
  isOpen,
  setIsOpen,
}: {
  isOpen: boolean;
  setIsOpen: (v: boolean) => void;
}) {
  const pathname = usePathname();
  const { userData, logout } = useAuth();

  const userRole = userData?.rol?.toLowerCase() || "";
  const { isAdmin } = parseUserRole(userData?.rol);

  const hasAccess = (entity: MenuItem | MenuGroup) => {
    if (isAdmin) return true;
    if ("requireAdmin" in entity && entity.requireAdmin && !isAdmin)
      return false;

    if (entity.allowedRoles && !entity.allowedRoles.includes(userRole)) {
      return false;
    }

    return true;
  };

  const closeOnMobile = () => {
    if (window.innerWidth < 1024) setIsOpen(false);
  };

  useEffect(() => {
    if (isOpen && window.innerWidth < 1024) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "unset";
    }
    return () => {
      document.body.style.overflow = "unset";
    };
  }, [isOpen]);

  return (
    <>
      {/* Overlay móvil */}
      <div
        className={cn(
          "fixed inset-0 z-40 bg-black/50 backdrop-blur-sm transition-opacity duration-300 lg:hidden",
          isOpen ? "opacity-100" : "pointer-events-none opacity-0",
        )}
        onClick={() => setIsOpen(false)}
      />

      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 flex w-[248px] flex-col gap-5 border-r border-sidebar-border bg-sidebar px-3 py-4 text-sidebar-foreground transition-transform duration-300 ease-in-out lg:translate-x-0",
          isOpen ? "translate-x-0" : "-translate-x-full",
        )}
      >
        <div className="flex items-center justify-between">
          <Link
            href="/"
            onClick={closeOnMobile}
            className="flex items-center gap-2.5 px-2 py-1.5"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo.png" alt="" className="h-auto w-8" />
            <span className="text-base font-bold tracking-tight">
              PayoutMetrics
            </span>
          </Link>
          <button
            type="button"
            onClick={() => setIsOpen(false)}
            aria-label="Cerrar menú"
            className="rounded-lg p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground lg:hidden"
          >
            <X className="size-4" />
          </button>
        </div>

        <nav className="flex flex-1 flex-col gap-[18px] overflow-y-auto">
          {menuGroups.map((group) => {
            if (!hasAccess(group)) return null;

            const visibleItems = group.items.filter((item) => hasAccess(item));
            if (visibleItems.length === 0) return null;

            return (
              <div key={group.id} className="flex flex-col gap-0.5">
                {group.title && (
                  <span className="px-2.5 pb-1.5 text-xs font-medium text-muted-foreground">
                    {group.title}
                  </span>
                )}
                {visibleItems.map((item) => {
                  const isActive = pathname === item.href;

                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      aria-current={isActive ? "page" : undefined}
                      onClick={closeOnMobile}
                      className={cn(
                        "flex h-9 items-center gap-2.5 rounded-lg px-2.5 text-sm transition-colors",
                        isActive
                          ? "bg-sidebar-accent font-semibold text-foreground shadow-[0_0_0_1px_var(--border)]"
                          : "text-muted-foreground hover:bg-accent hover:text-foreground",
                      )}
                    >
                      <item.icon className="size-4 shrink-0" />
                      <span className="truncate">{item.label}</span>
                      {item.requireAdmin && (
                        <span className="ml-auto rounded-md border border-input px-1.5 text-[11px] font-medium text-muted-foreground">
                          Admin
                        </span>
                      )}
                    </Link>
                  );
                })}
              </div>
            );
          })}
        </nav>

        <div className="flex items-center gap-2.5 rounded-[10px] border border-border bg-card p-2.5">
          <span className="flex size-[34px] shrink-0 items-center justify-center rounded-full bg-brand-soft text-[13px] font-semibold text-brand">
            {getInitials(userData?.nombre)}
          </span>
          <span className="flex min-w-0 flex-1 flex-col leading-tight">
            <span className="truncate text-[13px] font-semibold">
              {userData?.nombre ?? "Cargando..."}
            </span>
            <span className="truncate text-xs capitalize text-muted-foreground">
              {userData?.rol ?? "Usuario"}
            </span>
          </span>

          <AlertDialog>
            <AlertDialogTrigger asChild>
              <button
                type="button"
                aria-label="Cerrar sesión"
                className="flex size-8 shrink-0 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-danger-soft hover:text-danger-text"
              >
                <LogOut className="size-4" />
              </button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>¿Deseas cerrar tu sesión?</AlertDialogTitle>
                <AlertDialogDescription>
                  Tendrás que volver a ingresar tu correo y contraseña la
                  próxima vez que quieras acceder al sistema.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                <AlertDialogAction
                  onClick={logout}
                  className="bg-danger-solid text-white hover:bg-danger-solid-hover"
                >
                  Sí, salir ahora
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </aside>
    </>
  );
}
