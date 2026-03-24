// src/app/layout.tsx
import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/sonner";
import { TopBar } from "@/components/TopBar"; 
import { DashboardLayout } from "@/components/DashboardLayout"; // IMPORTAMOS EL NUEVO LAYOUT
import { CurrencyProvider } from "./context/CurrencyContext";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Sistema de Reportes",
  description: "Automatización de reportes mensuales",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es" suppressHydrationWarning>
      <body className={`${inter.className} bg-slate-50 min-h-screen`} suppressHydrationWarning>
        <CurrencyProvider>
          
          {/* Envolvemos el sistema en el nuevo DashboardLayout */}
          <DashboardLayout>
            <TopBar />
            {/* children son tus páginas (Dashboard, Gestor, etc.) */}
            {children} 
          </DashboardLayout>

          <Toaster richColors closeButton position="bottom-right" />
        </CurrencyProvider>
      </body>
    </html>
  );
}