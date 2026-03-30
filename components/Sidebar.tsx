// src/components/Sidebar.tsx
"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  UploadCloud,
  FolderKanban,
  CalendarDays,
  BarChart4,
  ChevronDown,
  ChevronRight,
  X,
  CheckSquare,
  Trophy,
  LogOut,
  User as UserIcon,
  ShieldCheck,
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

const menuGroups = [
  {
    id: "diarios",
    title: "Reportes Diarios",
    icon: CalendarDays,
    items: [
      {
        label: "Auditoria diaria",
        icon: LayoutDashboard,
        href: "/auditoria-diaria",
        color: "text-sky-400",
      },
      {
        label: "Cargar reportes",
        icon: UploadCloud,
        href: "/cargar-reportes",
        color: "text-emerald-400",
      },
      {
        label: "Gestor de archivos",
        icon: FolderKanban,
        href: "/gestor-archivos",
        color: "text-violet-400",
      },
    ],
  },
  {
    id: "evaluaciones",
    title: "Evaluaciones",
    icon: BarChart4,
    items: [
      {
        label: "Evaluación de desempeño",
        icon: CheckSquare,
        href: "/evaluacion-diaria",
        color: "text-amber-400",
      },
      {
        label: "Cierre mensual",
        icon: Trophy,
        href: "/cierre-mensual",
        color: "text-amber-400",
      },
    ],
  },
];

const adminGroup = {
  id: "administracion",
  title: "Administración",
  icon: ShieldCheck,
  items: [
    {
      label: "Gestor de Usuarios",
      icon: UserIcon,
      href: "/gestor-usuarios",
      color: "text-rose-400",
    },
  ],
};

interface SidebarProps {
  onMobileClose?: () => void;
}

export function Sidebar({ onMobileClose }: SidebarProps) {
  const pathname = usePathname();
  const { logout, userData } = useAuth();

  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({
    diarios: false,
    evaluaciones: false,
    administracion: false,
  });

  const visibleMenuGroups =
    userData?.rol === "admin" ? [...menuGroups, adminGroup] : menuGroups;

  useEffect(() => {
    const activeGroup = visibleMenuGroups.find((group) =>
      group.items.some(
        (item) =>
          pathname === item.href || pathname.startsWith(`${item.href}/`),
      ),
    );

    if (activeGroup) {
      setOpenGroups((prev) => ({ ...prev, [activeGroup.id]: true }));
    }
  }, [pathname, userData]);

  const toggleGroup = (groupId: string) => {
    setOpenGroups((prev) => ({ ...prev, [groupId]: !prev[groupId] }));
  };

  return (
    <div className="flex flex-col h-full bg-slate-900 text-white shadow-xl">
      <div className="px-3 py-6 flex-1 overflow-y-auto">
        <div className="flex items-center justify-between pl-3 mb-8">
          <Link
            href="/"
            className="flex items-center transition-opacity hover:opacity-80"
            onClick={onMobileClose}
          >
            <div className="relative w-8 h-8 mr-3 bg-primary rounded-lg flex items-center justify-center shadow-sm">
              <span className="font-bold text-xl text-white">R</span>
            </div>
            <h1 className="text-2xl font-bold tracking-tight">
              Reportes<span className="text-primary">.</span>
            </h1>
          </Link>

          {onMobileClose && (
            <button
              onClick={onMobileClose}
              className="md:hidden p-2 text-slate-400 hover:text-white"
            >
              <X className="w-6 h-6" />
            </button>
          )}
        </div>

        <div className="space-y-4">
          {visibleMenuGroups.map((group) => {
            const isOpen = openGroups[group.id];

            return (
              <div key={group.id} className="space-y-1">
                <button
                  onClick={() => toggleGroup(group.id)}
                  className="w-full flex items-center justify-between px-3 py-2 text-sm font-semibold text-slate-300 hover:text-white transition-colors"
                >
                  <div className="flex items-center gap-2">
                    <group.icon className="w-4 h-4" />
                    {group.title}
                  </div>
                  {isOpen ? (
                    <ChevronDown className="w-4 h-4" />
                  ) : (
                    <ChevronRight className="w-4 h-4" />
                  )}
                </button>

                {isOpen && (
                  <div className="pl-4 pr-2 space-y-1 mt-1 animate-in slide-in-from-top-1 duration-200">
                    {group.items.map((item) => {
                      const isActive =
                        pathname === item.href ||
                        pathname.startsWith(`${item.href}/`);

                      return (
                        <Link
                          key={item.label}
                          href={item.href}
                          onClick={onMobileClose}
                          className={cn(
                            "text-sm group flex p-2 w-full justify-start font-medium cursor-pointer rounded-lg transition-all duration-200",
                            isActive
                              ? "text-white bg-white/10 shadow-sm"
                              : "text-slate-400 hover:text-white hover:bg-white/5",
                          )}
                        >
                          <div className="flex items-center flex-1">
                            <item.icon
                              className={cn("h-4 w-4 mr-3", item.color)}
                            />
                            {item.label}
                          </div>
                        </Link>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      <div className="p-4 border-t border-slate-800 bg-slate-950/50 flex-shrink-0">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3 overflow-hidden">
            <div className="w-9 h-9 rounded-full bg-slate-800 flex items-center justify-center flex-shrink-0 border border-slate-700">
              <UserIcon className="w-4 h-4 text-slate-400" />
            </div>
            <div className="flex flex-col flex-1 min-w-0">
              <span className="text-sm font-medium text-white truncate">
                {userData?.nombre || "Cargando..."}
              </span>
              <span className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold truncate">
                {userData?.rol || "Usuario"}
              </span>
            </div>
          </div>

          {/* NUEVO: Envolvemos el botón de cerrar sesión en el AlertDialog */}
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
    </div>
  );
}
