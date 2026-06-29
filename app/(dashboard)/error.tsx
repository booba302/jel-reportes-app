"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { AlertCircle } from "lucide-react";

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4 text-center px-4">
      <div className="rounded-full bg-rose-100 p-4">
        <AlertCircle className="w-8 h-8 text-rose-500" />
      </div>
      <div className="space-y-1">
        <h2 className="text-xl font-semibold text-slate-800">
          Algo salió mal
        </h2>
        <p className="text-sm text-slate-500 max-w-sm">
          Ocurrió un error inesperado al cargar esta página. Puede ser un
          problema temporal de conexión.
        </p>
      </div>
      <Button onClick={reset} variant="outline">
        Reintentar
      </Button>
    </div>
  );
}
