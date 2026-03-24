// src/components/Sidebar.tsx
'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { 
  LayoutDashboard, UploadCloud, FolderKanban, 
  CalendarDays, BarChart4, ChevronDown, ChevronRight, X, Clock
} from 'lucide-react';
import { cn } from '@/lib/utils';

// Definimos la estructura agrupada de tus menús
const menuGroups = [
  {
    id: 'diarios',
    title: 'Reportes Diarios',
    icon: CalendarDays,
    items: [
      { label: 'Cargar Reportes', icon: UploadCloud, href: '/reporte-diario', color: 'text-emerald-400' },
      { label: 'Panel de Rendimiento', icon: LayoutDashboard, href: '/dashboard', color: 'text-sky-400' },
      { label: 'Gestor de Reportes Diarios', icon: FolderKanban, href: '/gestor', color: 'text-violet-400' },
    ]
  },
  {
    id: 'mensuales',
    title: 'Reportes Mensuales',
    icon: BarChart4,
    items: [
      { label: 'Próximamente...', icon: Clock, href: '#', color: 'text-slate-500' },
    ]
  }
];

interface SidebarProps {
  onMobileClose?: () => void; // Función para cerrar el menú en móviles
}

export function Sidebar({ onMobileClose }: SidebarProps) {
  const pathname = usePathname();
  
  // Estado para controlar qué menús están abiertos (por defecto abrimos el de diarios)
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({
    diarios: true,
    mensuales: false
  });

  const toggleGroup = (groupId: string) => {
    setOpenGroups(prev => ({ ...prev, [groupId]: !prev[groupId] }));
  };

  return (
    <div className="space-y-4 py-4 flex flex-col h-full bg-slate-900 text-white shadow-xl">
      <div className="px-3 py-2 flex-1 overflow-y-auto">
        
        {/* Cabecera y botón de cerrar en móvil */}
        <div className="flex items-center justify-between pl-3 mb-8 mt-2">
          <Link href="/dashboard" className="flex items-center transition-opacity hover:opacity-80" onClick={onMobileClose}>
            <div className="relative w-8 h-8 mr-3 bg-primary rounded-lg flex items-center justify-center shadow-sm">
              <span className="font-bold text-xl text-white">R</span>
            </div>
            <h1 className="text-2xl font-bold tracking-tight">
              Reportes<span className="text-primary">.</span>
            </h1>
          </Link>
          
          {/* Este botón solo aparece en móviles */}
          {onMobileClose && (
            <button onClick={onMobileClose} className="md:hidden p-2 text-slate-400 hover:text-white">
              <X className="w-6 h-6" />
            </button>
          )}
        </div>

        {/* Lista de Navegación Agrupada */}
        <div className="space-y-4">
          {menuGroups.map((group) => {
            const isOpen = openGroups[group.id];
            
            return (
              <div key={group.id} className="space-y-1">
                {/* Botón del Acordeón (Grupo) */}
                <button
                  onClick={() => toggleGroup(group.id)}
                  className="w-full flex items-center justify-between px-3 py-2 text-sm font-semibold text-slate-300 hover:text-white transition-colors"
                >
                  <div className="flex items-center gap-2">
                    <group.icon className="w-4 h-4" />
                    {group.title}
                  </div>
                  {isOpen ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                </button>

                {/* Sub-items del menú */}
                {isOpen && (
                  <div className="pl-4 pr-2 space-y-1 mt-1">
                    {group.items.map((item) => {
                      const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`);
                      
                      return (
                        <Link
                          key={item.label}
                          href={item.href}
                          onClick={onMobileClose} // Cierra el menú al hacer clic en móvil
                          className={cn(
                            "text-sm group flex p-2 w-full justify-start font-medium cursor-pointer rounded-lg transition-all duration-200",
                            isActive 
                              ? "text-white bg-white/10 shadow-sm" 
                              : "text-slate-400 hover:text-white hover:bg-white/5"
                          )}
                        >
                          <div className="flex items-center flex-1">
                            <item.icon className={cn("h-4 w-4 mr-3", item.color)} />
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

      <div className="px-6 py-4 border-t border-slate-800">
        <p className="text-xs text-slate-500 font-medium">Sistema de Retiros v1.1</p>
      </div>
    </div>
  );
}