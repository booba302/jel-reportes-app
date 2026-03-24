// src/app/layout.tsx
import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/sonner";
import { TopBar } from "@/components/TopBar"; // Importamos la barra
import { CurrencyProvider } from "./context/CurrencyContext"; // Importamos el proveedor

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
    <html lang="es">
      <body className={`${inter.className} bg-slate-50 min-h-screen`}>
        {/* Envolvemos toda la app en el proveedor de moneda */}
        <CurrencyProvider>
          <TopBar />
          <main>
            {children}
          </main>
          <Toaster richColors closeButton position="top-right" />
        </CurrencyProvider>
      </body>
    </html>
  );
}