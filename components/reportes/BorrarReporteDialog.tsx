"use client";

import { authHeaders } from "@/lib/apiFetch";
import { useState } from "react";
import { Loader2, Trash2 } from "lucide-react";
import { toast } from "sonner";
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
import { Button } from "@/components/ui/button";
import { formatEntero } from "@/lib/format";
import type { HistorialReporte } from "./useReportesMes";
import { diaCorto, diaMedio } from "./fechas";

export function BorrarReporteDialog({
  historial,
  onBorrado,
}: {
  historial: HistorialReporte;
  onBorrado: (dia: string) => void;
}) {
  const [borrando, setBorrando] = useState(false);
  const dia = historial.fechaReporte.slice(0, 10);

  const borrar = async () => {
    setBorrando(true);
    try {
      const params = new URLSearchParams({
        fecha: historial.fechaReporte,
        moneda: historial.moneda,
        id: historial.id,
      });
      const res = await fetch(`/api/delete-reporte?${params}`, {
        method: "DELETE",
        headers: await authHeaders(),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.success) {
        toast.error("No se pudo borrar el reporte", {
          description: json?.error ?? "Inténtalo de nuevo.",
        });
        return;
      }
      toast.success(`Reporte del ${diaCorto(dia)} eliminado`);
      onBorrado(dia);
    } catch {
      toast.error("Error de red al intentar borrar el reporte.");
    } finally {
      setBorrando(false);
    }
  };

  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button
          variant="outline"
          disabled={borrando}
          className="h-10 w-full gap-2 rounded-lg border-danger/30 bg-danger-soft text-danger-text hover:bg-danger-soft hover:text-danger-text hover:brightness-95 dark:border-danger/30 dark:bg-danger-soft dark:hover:bg-danger-soft"
        >
          {borrando ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <Trash2 className="size-4" />
          )}
          {borrando ? "Borrando…" : "Borrar reporte"}
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>
            ¿Borrar el reporte del {diaMedio(dia)}?
          </AlertDialogTitle>
          <AlertDialogDescription>
            Se eliminarán los{" "}
            {formatEntero(historial.totalRegistros ?? 0)} retiros de{" "}
            {historial.moneda} de ese día y el día volverá a quedar como
            faltante. Esta acción no se puede deshacer.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancelar</AlertDialogCancel>
          <AlertDialogAction
            onClick={borrar}
            className="bg-danger-solid text-white hover:bg-danger-solid-hover"
          >
            Borrar reporte
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
