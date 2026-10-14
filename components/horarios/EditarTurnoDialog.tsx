"use client";

import { useState } from "react";
import { toast } from "sonner";
import { apiFetch } from "@/lib/apiFetch";
import { ETIQUETA_PUESTO, ETIQUETA_TURNO, ROTACION, fechaCorta, nombreCorto } from "@/lib/horario";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { Casilla } from "./CalendarioMes";

/** Cambia a mano quién cubre una casilla. */
export function EditarTurnoDialog({
  casilla,
  onCerrar,
  onGuardado,
}: {
  casilla: Casilla | null;
  onCerrar: () => void;
  onGuardado: () => void;
}) {
  const [elegido, setElegido] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);
  const valor = elegido ?? casilla?.colaborador ?? "";

  const guardar = async () => {
    if (!casilla) return;
    setGuardando(true);
    try {
      await apiFetch("/api/horarios/turno", { method: "PATCH", body: JSON.stringify({ ...casilla, colaborador: valor }) });
      toast.success("Turno actualizado");
      setElegido(null);
      onGuardado();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se pudo guardar.");
    } finally {
      setGuardando(false);
    }
  };

  return (
    <Dialog
      open={!!casilla}
      onOpenChange={(o) => {
        if (!o) {
          setElegido(null);
          onCerrar();
        }
      }}
    >
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Cambiar turno</DialogTitle>
          <DialogDescription>
            {casilla &&
              `${fechaCorta(casilla.fecha)} · ${ETIQUETA_TURNO[casilla.turno]} · ${ETIQUETA_PUESTO[casilla.puesto]}`}
          </DialogDescription>
        </DialogHeader>
        <Select value={valor} onValueChange={setElegido}>
          <SelectTrigger aria-label="Colaborador">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {ROTACION.map((c) => (
              <SelectItem key={c} value={c}>
                {nombreCorto(c)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => {
              setElegido(null);
              onCerrar();
            }}
          >
            Cancelar
          </Button>
          <Button onClick={guardar} disabled={guardando || valor === casilla?.colaborador}>
            Guardar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
