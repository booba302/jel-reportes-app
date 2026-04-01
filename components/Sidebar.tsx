// src/components/Sidebar.tsx
"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  UploadCloud,
  FolderKanban,
  BarChart4,
  ChevronDown,
  ChevronRight,
  X,
  CheckSquare,
  Trophy,
  LogOut,
  User as UserIcon,
  ShieldCheck,
  Globe,
  Activity,
  Database,
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
import { cn } from "@/lib/utils";
import { useAuth } from "@/app/context/AuthContext";

type MenuItem = {
  label: string;
  icon: LucideIcon;
  href: string;
  color: string;
  requireAdmin?: boolean;
  allowedRoles?: string[];
};

type MenuGroup = {
  id: string;
  title: string;
  icon: LucideIcon;
  items: MenuItem[];
  allowedRoles?: string[];
};

const menuGroups: MenuGroup[] = [
  {
    id: "operaciones",
    title: "Gestión Operativa",
    icon: Database,
    items: [
      {
        label: "Cargar Reportes",
        icon: UploadCloud,
        href: "/cargar-reportes",
        color: "text-blue-400",
      },
      {
        label: "Gestor de Reportes",
        icon: FolderKanban,
        href: "/gestor-reportes",
        color: "text-amber-400",
      },
      {
        label: "Evaluación Diaria",
        icon: CheckSquare,
        href: "/evaluacion-diaria",
        color: "text-emerald-400",
      },
    ],
  },
  {
    id: "analitica",
    title: "Analítica y Desempeño",
    icon: BarChart4,
    items: [
      {
        label: "Auditoría Diaria",
        icon: Activity,
        href: "/auditoria-diaria",
        color: "text-sky-400",
      },
      {
        label: "Monitor Regional",
        icon: Globe,
        href: "/monitor-regional",
        color: "text-indigo-400",
        allowedRoles: ["agente_retiro_inter"], // NUEVO: Solo este rol (y el admin) podrán verlo
      },
      {
        label: "Cierre Mensual",
        icon: Trophy,
        href: "/cierre-mensual",
        color: "text-amber-500",
      },
    ],
  },
  {
    id: "admin",
    title: "Administración",
    icon: ShieldCheck,
    items: [
      {
        label: "Gestión de Usuarios",
        icon: UserIcon,
        href: "/gestor-usuarios",
        color: "text-rose-400",
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
  const isAdmin =
    userRole.includes("admin") || userData?.rol === "Administrador";

  // Función maestra para verificar permisos de cada item
  const hasAccess = (entity: MenuItem | MenuGroup) => {
    if (isAdmin) return true;
    if ("requireAdmin" in entity && entity.requireAdmin && !isAdmin)
      return false;

    if (entity.allowedRoles && !entity.allowedRoles.includes(userRole)) {
      return false;
    }

    return true;
  };

  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>(
    {
      operaciones: true,
      analitica: true,
      admin: true,
    },
  );

  const toggleGroup = (groupId: string) => {
    setExpandedGroups((prev) => ({
      ...prev,
      [groupId]: !prev[groupId],
    }));
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

  const MobileOverlay = () => (
    <div
      className={cn(
        "fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-40 lg:hidden transition-opacity duration-300",
        isOpen ? "opacity-100" : "opacity-0 pointer-events-none",
      )}
      onClick={() => setIsOpen(false)}
    />
  );

  return (
    <>
      <MobileOverlay />

      <div
        className={cn(
          "fixed top-0 left-0 h-screen w-72 bg-slate-900 border-r border-slate-800 text-slate-300 flex flex-col z-50 transition-transform duration-300 ease-in-out lg:translate-x-0",
          isOpen ? "translate-x-0" : "-translate-x-full",
        )}
      >
        <Link
          href="/"
          onClick={() => window.innerWidth < 1024 && setIsOpen(false)}
          className="h-16 flex items-center justify-between px-6 bg-slate-950/50 border-b border-slate-800 shrink-0 hover:bg-slate-900/80 transition-colors group"
        >
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary to-blue-600 flex items-center justify-center shadow-lg shadow-primary/20 group-hover:scale-105 transition-transform">
              <span className="text-white font-bold text-lg">R</span>
            </div>
            <span className="font-bold text-xl text-white tracking-tight">
              Reportes
            </span>
          </div>
          <button
            onClick={(e) => {
              e.preventDefault();
              setIsOpen(false);
            }}
            className="p-2 -mr-2 text-slate-400 hover:text-white lg:hidden"
          >
            <X className="w-5 h-5" />
          </button>
        </Link>

        <div className="flex-1 overflow-y-auto py-6 px-4 space-y-6 scrollbar-thin scrollbar-thumb-slate-700 scrollbar-track-transparent">
          {menuGroups.map((group) => {
            if (!hasAccess(group)) return null;
            
            const hasVisibleItems = group.items.some((item) => hasAccess(item));
            if (!hasVisibleItems) return null;

            const isExpanded = expandedGroups[group.id];

            return (
              <div key={group.id} className="space-y-1">
                <button
                  onClick={() => toggleGroup(group.id)}
                  className="w-full flex items-center justify-between px-2 py-2 text-xs font-semibold text-slate-500 uppercase tracking-wider hover:text-slate-300 transition-colors"
                >
                  <div className="flex items-center gap-2">
                    <group.icon className="w-4 h-4" />
                    {group.title}
                  </div>
                  {isExpanded ? (
                    <ChevronDown className="w-4 h-4" />
                  ) : (
                    <ChevronRight className="w-4 h-4" />
                  )}
                </button>

                <div
                  className={cn(
                    "space-y-1 overflow-hidden transition-all duration-300 ease-in-out",
                    isExpanded
                      ? "max-h-96 opacity-100 mt-1"
                      : "max-h-0 opacity-0",
                  )}
                >
                  {group.items.map((item) => {
                    // Evaluamos el acceso individual de cada item
                    if (!hasAccess(item)) return null;

                    const isActive = pathname === item.href;

                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        onClick={() =>
                          window.innerWidth < 1024 && setIsOpen(false)
                        }
                        className={cn(
                          "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 group",
                          isActive
                            ? "bg-primary/10 text-white"
                            : "text-slate-400 hover:bg-slate-800/50 hover:text-slate-200",
                        )}
                      >
                        <item.icon
                          className={cn(
                            "w-5 h-5 transition-transform duration-200 group-hover:scale-110",
                            item.color,
                          )}
                        />
                        {item.label}
                        {isActive && (
                          <div className="ml-auto w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
                        )}
                      </Link>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>

        <div className="p-4 border-t border-slate-800 bg-slate-900 shrink-0 flex items-center justify-between">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center shrink-0">
              <UserIcon className="w-5 h-5 text-slate-400" />
            </div>
            <div className="flex flex-col truncate">
              <span className="text-sm font-medium text-white truncate">
                {userData?.nombre || "Cargando..."}
              </span>
              <span className="text-xs text-slate-500 truncate capitalize">
                {userData?.rol || "Usuario"}
              </span>
            </div>
          </div>

          <AlertDialog>
            <AlertDialogTrigger asChild>
              <button
                className="p-2 text-slate-400 hover:text-rose-400 hover:bg-rose-400/10 rounded-lg transition-colors ml-2"
                title="Cerrar sesión"
              >
                <LogOut className="w-5 h-5" />
              </button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>¿Deseas cerrar tu sesión?</AlertDialogTitle>
                <AlertDialogDescription className="text-base text-slate-600">
                  Tendrás que volver a ingresar tu correo y contraseña la
                  próxima vez que quieras acceder al sistema.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                <AlertDialogAction
                  onClick={logout}
                  className="bg-rose-600 hover:bg-rose-700 text-white"
                >
                  Sí, salir ahora
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </div>
    </>
  );
}
