"use client";

import { useState } from "react";
import { Plus, UserMinus, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { normalizarNombre } from "@/lib/evaluacion";

export function ExcludedPopover({
  lista,
  sugerencias,
  agregar,
  quitar,
  onSincronizar,
}: {
  lista: string[];
  /** Operadores del día (sin Autopago) que no están excluidos. */
  sugerencias: string[];
  agregar: (nombre: string) => Promise<void>;
  quitar: (nombre: string) => Promise<void>;
  onSincronizar: () => void;
}) {
  const [nombre, setNombre] = useState("");
  const [aviso, setAviso] = useState<string | null>(null);

  const alta = async (valor: string) => {
    const limpio = valor.trim().replace(/\s+/g, " ");
    if (!limpio) return setAviso("Escribe un nombre.");
    if (lista.some((n) => normalizarNombre(n) === normalizarNombre(limpio)))
      return setAviso(`${limpio} ya está excluido.`);
    try {
      await agregar(limpio);
      setNombre("");
      setAviso(null);
      toast.success(`${limpio} excluido de la evaluación`);
    } catch (err) {
      console.error("Error guardando excluidos:", err);
      toast.error("No se pudo guardar la lista de excluidos.");
    }
  };

  const baja = async (n: string) => {
    try {
      await quitar(n);
      toast.success(`${n} vuelve a evaluarse`, {
        description: "Sincroniza el día para crear su evaluación.",
        action: { label: "Sincronizar", onClick: onSincronizar },
      });
    } catch (err) {
      console.error("Error guardando excluidos:", err);
      toast.error("No se pudo guardar la lista de excluidos.");
    }
  };

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" className="h-9 gap-2 rounded-lg bg-card dark:bg-card">
          <UserMinus className="size-4" />
          {lista.length} {lista.length === 1 ? "excluido" : "excluidos"}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="flex w-80 flex-col gap-3 p-4">
        <div className="flex flex-col gap-1">
          <span className="font-semibold">Excluidos de la evaluación</span>
          <span className="text-xs text-muted-foreground">
            Sus retiros siguen contando en las métricas del equipo, pero no
            reciben evaluación diaria. No necesitan tener usuario en el sistema.
          </span>
        </div>

        <form
          className="flex flex-col gap-1"
          onSubmit={(e) => {
            e.preventDefault();
            alta(nombre);
          }}
        >
          <div className="flex gap-2">
            <Input
              value={nombre}
              onChange={(e) => {
                setNombre(e.target.value);
                setAviso(null);
              }}
              placeholder="Nombre como aparece en Operador"
              aria-label="Nombre a excluir"
              className="h-9"
            />
            <Button
              type="submit"
              className="h-9 bg-action text-action-foreground hover:bg-action-hover"
            >
              Agregar
            </Button>
          </div>
          {aviso && <span className="text-xs text-warning-text">{aviso}</span>}
        </form>

        {lista.length === 0 ? (
          <p className="text-[13px] text-muted-foreground">No hay nadie excluido.</p>
        ) : (
          <ul className="flex max-h-48 flex-col overflow-y-auto">
            {lista.map((n) => (
              <li
                key={n}
                className="flex items-center gap-2.5 border-b border-border py-1.5 last:border-b-0"
              >
                <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-semibold">
                  {n.charAt(0).toUpperCase()}
                </span>
                <span className="min-w-0 flex-1 truncate text-[13px]">{n}</span>
                <button
                  type="button"
                  aria-label={`Quitar a ${n} de los excluidos`}
                  onClick={() => baja(n)}
                  className="flex size-7 items-center justify-center rounded-lg text-muted-foreground hover:bg-danger-soft hover:text-danger-text"
                >
                  <X className="size-3.5" />
                </button>
              </li>
            ))}
          </ul>
        )}

        {sugerencias.length > 0 && (
          <div className="flex flex-col gap-1.5 border-t border-border pt-3">
            <span className="text-xs text-muted-foreground">Operadores de este día</span>
            <div className="flex flex-wrap gap-1.5">
              {sugerencias.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => alta(s)}
                  className="flex h-7 items-center gap-1 rounded-full border border-dashed border-input px-2.5 text-xs text-muted-foreground hover:border-foreground hover:text-foreground"
                >
                  <Plus className="size-3" />
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}
