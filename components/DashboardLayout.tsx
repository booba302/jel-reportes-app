// src/components/DashboardLayout.tsx
'use client';

import * as React from 'react';
import { Menu } from 'lucide-react';
import { Sidebar } from '@/components/Sidebar';

export function DashboardLayout({ children }: { children: React.ReactNode }) {
  const [isMobileOpen, setIsMobileOpen] = React.useState(false);

  return (
    <div className="h-full relative">
      
      {/* Botón de Menú Hamburguesa (Fijo arriba a la izquierda solo en móviles) */}
      <div className="md:hidden fixed top-0 left-0 z-[60] w-full h-16 pointer-events-none flex items-center px-4">
        <button 
          onClick={() => setIsMobileOpen(true)}
          className="pointer-events-auto p-2 bg-white rounded-md shadow-sm border border-slate-200 text-slate-700 hover:bg-slate-50 transition-colors"
        >
          <Menu className="w-6 h-6" />
        </button>
      </div>

      {/* SIDEBAR ESCRITORIO: Fijo a la izquierda (Oculto en móviles) */}
      <div className="hidden h-full md:flex md:w-72 md:flex-col md:fixed md:inset-y-0 z-[80] bg-slate-900">
        <Sidebar />
      </div>

      {/* SIDEBAR MÓVIL: Overlay oscuro y menú deslizable */}
      {isMobileOpen && (
        <div className="fixed inset-0 z-[100] flex md:hidden">
          {/* Fondo oscuro (Click para cerrar) */}
          <div 
            className="fixed inset-0 bg-slate-900/80 backdrop-blur-sm transition-opacity" 
            onClick={() => setIsMobileOpen(false)} 
          />
          {/* Contenedor del Sidebar */}
          <div className="relative w-72 max-w-[80%] h-full flex flex-col bg-slate-900 animate-in slide-in-from-left-2 duration-300">
            <Sidebar onMobileClose={() => setIsMobileOpen(false)} />
          </div>
        </div>
      )}

      {/* CONTENIDO PRINCIPAL: Se empuja a la derecha en escritorio y se le da padding extra arriba en móviles para el menú hamburguesa */}
      <main className="md:pl-72 pb-10 min-h-screen flex flex-col pt-16 md:pt-0">
        {/* Aquí va el TopBar y las vistas de página (Dashboard, Carga, etc.) */}
        <div className="flex-1">
          {children}
        </div>
      </main>

    </div>
  );
}