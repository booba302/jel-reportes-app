// src/app/(dashboard)/layout.tsx
import MainLayout from "@/components/MainLayout";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    // Envolvemos todas las páginas de (dashboard) con el Sidebar y el selector de monedas
    <MainLayout>
      {children}
    </MainLayout>
  );
}