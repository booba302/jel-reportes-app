// src/app/layout.tsx
import "./globals.css";
import { Inter } from "next/font/google";
import { AuthProvider } from "./context/AuthContext";
import { CurrencyProvider } from "./context/CurrencyContext";
import { AutoLogoutGuard } from "@/components/AutoLogoutGuard";
import MainLayout from "@/components/MainLayout";
import { Toaster } from "sonner";

const inter = Inter({ subsets: ["latin"] });

export const metadata = {
  title: "Sistema de Reportes y Rendimiento",
  description: "Plataforma corporativa de auditoría",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="es">
      <body className={inter.className}>
        <AuthProvider>
          <CurrencyProvider>
            {" "}
            <MainLayout>{children}</MainLayout>
          </CurrencyProvider>
        </AuthProvider>

        <Toaster position="bottom-right" richColors />

        {/* El vigilante invisible que protege toda la app por inactividad */}
        <AutoLogoutGuard />
      </body>
    </html>
  );
}
