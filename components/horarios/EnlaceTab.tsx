"use client";

import { useState } from "react";
import { Copy, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { apiFetch } from "@/lib/apiFetch";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { cardClass } from "@/components/dashboard/CardHeading";
import { ConfirmDialog } from "@/components/usuarios/ConfirmDialog";

const copiar = async (id: string, anio: number) => {
  await navigator.clipboard.writeText(`${window.location.origin}/horario/${id}`);
  toast.success(`Enlace ${anio} copiado`, { description: "Muestra los meses hasta el mes en curso." });
};

/** Enlace anual que se comparte con los colaboradores. */
export function EnlaceTab({ anio }: { anio: number }) {
  const [reemplazando, setReemplazando] = useState(false);

  const copiarActual = async () => {
    try {
      const { id } = await apiFetch<{ id: string }>(`/api/horarios/enlace?anio=${anio}`);
      await copiar(id, anio);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se pudo copiar el enlace.");
    }
  };

  return (
    <div className={cn(cardClass, "flex flex-col gap-3")}>
      <h2 className="font-semibold">Enlace {anio}</h2>
      <p className="text-sm text-muted-foreground">
        Un solo enlace para todo el año. Los colaboradores ven los meses generados hasta el mes en curso; nunca meses futuros.
      </p>
      <div className="flex flex-wrap gap-2">
        <Button onClick={copiarActual}>
          <Copy className="size-4" /> Copiar enlace {anio}
        </Button>
        <Button variant="outline" onClick={() => setReemplazando(true)}>
          <RefreshCw className="size-4" /> Reemplazar enlace
        </Button>
      </div>
      <ConfirmDialog
        open={reemplazando}
        onOpenChange={setReemplazando}
        titulo="Reemplazar enlace"
        descripcion="El enlace actual deja de funcionar. Tendrás que enviar el nuevo a todos."
        accion="Reemplazar"
        tono="danger"
        onConfirmar={async () => {
          try {
            const { id } = await apiFetch<{ id: string }>("/api/horarios/enlace", {
              method: "POST",
              body: JSON.stringify({ anio }),
            });
            await copiar(id, anio);
          } catch (err) {
            toast.error(err instanceof Error ? err.message : "No se pudo reemplazar el enlace.");
            throw err;
          }
        }}
      />
    </div>
  );
}
