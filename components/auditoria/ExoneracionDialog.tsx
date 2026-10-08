"use client";

import { useState } from "react";
import { Loader2, MessageSquare, Save } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { formatDecimal } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { EXONERATION_REASONS, esMotivo, type OperacionRow } from "./calculos";

function Contenido({
  op,
  onGuardar,
  onCerrar,
}: {
  op: OperacionRow;
  onGuardar: (id: string, valor: string) => Promise<void>;
  onCerrar: () => void;
}) {
  // Precarga el motivo actual si es uno de los 4; si no, ninguno.
  const [motivo, setMotivo] = useState<string | null>(
    esMotivo(op.comentarioBrecha) ? op.comentarioBrecha! : null,
  );
  const [guardando, setGuardando] = useState(false);
  const comentarioAntiguo =
    op.comentarioBrecha && !esMotivo(op.comentarioBrecha) ? op.comentarioBrecha : null;

  const guardar = async () => {
    setGuardando(true);
    try {
      // Sin motivo elegido se conserva el comentario antiguo (si había).
      const valor = motivo ?? comentarioAntiguo ?? "";
      await onGuardar(op.id, valor);
      toast.success(
        valor ? `Retiro de ${op.alias} exonerado` : `Exoneración quitada a ${op.alias}`,
      );
      onCerrar();
    } catch (err) {
      console.error("Error al guardar comentario:", err);
      toast.error("Hubo un problema al guardar el comentario");
    } finally {
      setGuardando(false);
    }
  };

  return (
    <>
      <DialogHeader>
        <DialogTitle className="flex items-center gap-2 text-base font-semibold">
          <MessageSquare className="size-4 text-brand" />
          Comentario de brecha
        </DialogTitle>
        <DialogDescription className="sr-only">
          Motivo de exoneración del retiro de {op.alias}
        </DialogDescription>
      </DialogHeader>

      <div className="flex flex-wrap gap-x-3.5 gap-y-1.5 rounded-[9px] bg-muted px-3 py-2.5 text-[13px]">
        <span className="font-semibold">{op.alias}</span>
        <span className="font-mono text-muted-foreground">{op.hora.slice(0, 5)}</span>
        <span className="text-muted-foreground">{op.operador}</span>
        <span className="font-mono font-semibold text-danger-text">
          {formatDecimal(op.tiempo)} min
        </span>
      </div>

      <p className="text-[13px] text-muted-foreground">
        Selecciona el motivo de la exoneración de este retiro.
      </p>

      <div className="flex flex-col">
        {EXONERATION_REASONS.map((reason, i) => {
          const activo = motivo === reason;
          const bloqueado = motivo !== null && !activo;
          const labelId = `motivo-${i}`;
          return (
            <div
              key={reason}
              className={cn(
                "flex items-center justify-between gap-3 border-b border-border py-2.5 last:border-b-0",
                bloqueado && "opacity-45",
              )}
            >
              <span id={labelId} className="text-sm">
                {reason}
              </span>
              <Switch
                checked={activo}
                disabled={bloqueado || guardando}
                aria-labelledby={labelId}
                onCheckedChange={(on) => setMotivo(on ? reason : null)}
                className="data-checked:bg-success"
              />
            </div>
          );
        })}
      </div>

      {comentarioAntiguo && (
        <p className="rounded-lg border border-border bg-muted p-2.5 text-xs italic text-muted-foreground">
          Comentario anterior: “{comentarioAntiguo}”
        </p>
      )}

      <DialogFooter className="-mx-5 -mb-5 px-5 py-4">
        <Button variant="outline" onClick={onCerrar} disabled={guardando}>
          Cancelar
        </Button>
        <Button
          onClick={guardar}
          disabled={guardando}
          className="gap-2 bg-action text-action-foreground hover:bg-action-hover"
        >
          {guardando ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <Save className="size-4" />
          )}
          Guardar
        </Button>
      </DialogFooter>
    </>
  );
}

export function ExoneracionDialog({
  op,
  onGuardar,
  onCerrar,
}: {
  op: OperacionRow | null;
  onGuardar: (id: string, valor: string) => Promise<void>;
  onCerrar: () => void;
}) {
  return (
    <Dialog open={op !== null} onOpenChange={(o) => !o && onCerrar()}>
      <DialogContent className="max-w-[calc(100%-2rem)] gap-4 p-5 sm:max-w-[440px]">
        {op && (
          <Contenido key={op.id} op={op} onGuardar={onGuardar} onCerrar={onCerrar} />
        )}
      </DialogContent>
    </Dialog>
  );
}
