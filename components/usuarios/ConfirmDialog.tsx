"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";

/** Confirmación de restablecer o desactivar. No se cierra mientras se ejecuta la acción. */
export function ConfirmDialog({
  open,
  onOpenChange,
  titulo,
  descripcion,
  accion,
  tono,
  onConfirmar,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  titulo: string;
  descripcion: string;
  accion: string;
  tono: "warning" | "danger";
  /** Si resuelve, el diálogo se cierra; si lanza, queda abierto. */
  onConfirmar: () => Promise<void>;
}) {
  const [trabajando, setTrabajando] = useState(false);

  const confirmar = async () => {
    setTrabajando(true);
    try {
      await onConfirmar();
      onOpenChange(false);
    } catch {
      // El llamador ya mostró el error.
    } finally {
      setTrabajando(false);
    }
  };

  return (
    <AlertDialog open={open} onOpenChange={(o) => !trabajando && onOpenChange(o)}>
      <AlertDialogContent className="sm:max-w-[440px]">
        <AlertDialogHeader>
          <AlertDialogTitle>{titulo}</AlertDialogTitle>
          <AlertDialogDescription>{descripcion}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={trabajando}>Cancelar</AlertDialogCancel>
          <Button
            onClick={confirmar}
            disabled={trabajando}
            className={cn(
              "gap-2 text-white",
              tono === "warning"
                ? "bg-warning-solid hover:bg-warning-solid-hover"
                : "bg-danger-solid hover:bg-danger-solid-hover",
            )}
          >
            {trabajando && <Loader2 className="size-4 animate-spin" />}
            {accion}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
