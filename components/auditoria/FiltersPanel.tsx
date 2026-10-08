"use client";

import { useState } from "react";
import { Loader2, Search } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { formatEntero } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cardClass } from "@/components/dashboard/CardHeading";
import { NIVELES, type NivelFiltro } from "./calculos";

function NotasJornada({
  nota,
  onGuardar,
}: {
  nota: string;
  onGuardar: (texto: string) => Promise<void>;
}) {
  const [editando, setEditando] = useState(false);
  const [texto, setTexto] = useState(nota);
  const [guardando, setGuardando] = useState(false);

  const guardar = async () => {
    setGuardando(true);
    try {
      await onGuardar(texto);
      toast.success("Nota de la jornada guardada");
      setEditando(false);
    } catch (err) {
      console.error("Error al guardar la nota:", err);
      toast.error("Hubo un problema al guardar la nota");
    } finally {
      setGuardando(false);
    }
  };

  return (
    <div className="mt-auto flex flex-col gap-2.5 border-t border-border pt-4">
      <Label htmlFor="nota-jornada" className="text-[13px]">
        Notas de la jornada
      </Label>
      {editando ? (
        <>
          <textarea
            id="nota-jornada"
            rows={4}
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            placeholder="Escribe aquí si hubo intermitencias, ausencias, caídas del banco o algún evento relevante de la jornada operativa..."
            className="w-full resize-y rounded-lg border border-input bg-transparent px-2.5 py-2 text-[13px] outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30"
          />
          <div className="flex justify-end gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={guardando}
              onClick={() => {
                setTexto(nota);
                setEditando(false);
              }}
            >
              Cancelar
            </Button>
            <Button
              size="sm"
              disabled={guardando}
              onClick={guardar}
              className="gap-1.5 bg-action text-action-foreground hover:bg-action-hover"
            >
              {guardando && <Loader2 className="size-3.5 animate-spin" />}
              Guardar
            </Button>
          </div>
        </>
      ) : (
        <>
          <div
            className={cn(
              "whitespace-pre-line rounded-lg border border-border bg-muted p-3 text-[13px]",
              !nota && "text-muted-foreground",
            )}
          >
            {nota || "Sin notas para esta jornada."}
          </div>
          <Button
            variant="outline"
            size="sm"
            className="self-start"
            onClick={() => {
              setTexto(nota);
              setEditando(true);
            }}
          >
            {nota ? "Editar nota" : "Agregar nota"}
          </Button>
        </>
      )}
    </div>
  );
}

export function FiltersPanel({
  busqueda,
  onBusqueda,
  operadores,
  operador,
  onOperador,
  nivel,
  onNivel,
  nota,
  notaKey,
  onGuardarNota,
  className,
}: {
  busqueda: string;
  onBusqueda: (v: string) => void;
  operadores: { nombre: string; cantidad: number }[];
  operador: string;
  onOperador: (v: string) => void;
  nivel: NivelFiltro;
  onNivel: (v: NivelFiltro) => void;
  nota: string;
  /** Cambia con el día/moneda para descartar una edición a medias. */
  notaKey: string;
  onGuardarNota: (texto: string) => Promise<void>;
  className?: string;
}) {
  return (
    <aside className={cn(cardClass, "flex flex-col gap-[18px] p-4", className)}>
      <div className="flex flex-col gap-2">
        <Label htmlFor="buscar-jugador" className="text-[13px]">
          Buscar jugador
        </Label>
        <div className="relative">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            id="buscar-jugador"
            type="search"
            value={busqueda}
            onChange={(e) => onBusqueda(e.target.value)}
            placeholder="Usuario o ID"
            className="h-9 pl-8"
          />
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <span className="text-[13px] font-medium" id="filtro-operador">
          Operador
        </span>
        {/* Móvil: Select */}
        <div className="sm:hidden">
          <Select value={operador} onValueChange={onOperador}>
            <SelectTrigger className="h-9 w-full" aria-labelledby="filtro-operador">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {operadores.map((o) => (
                <SelectItem key={o.nombre} value={o.nombre}>
                  {o.nombre} ({formatEntero(o.cantidad)})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        {/* Escritorio: lista */}
        <div
          role="group"
          aria-labelledby="filtro-operador"
          className="hidden max-h-[280px] flex-col gap-0.5 overflow-y-auto sm:flex"
        >
          {operadores.map((o) => {
            const activo = operador === o.nombre;
            return (
              <button
                key={o.nombre}
                type="button"
                aria-pressed={activo}
                onClick={() => onOperador(o.nombre)}
                className={cn(
                  "flex h-8 shrink-0 items-center gap-2 rounded-lg px-2.5 text-left text-[13px] transition-colors",
                  activo
                    ? "bg-brand-soft font-semibold text-brand"
                    : "hover:bg-accent",
                )}
              >
                <span className="truncate">{o.nombre}</span>
                <span className="ml-auto font-mono text-xs text-muted-foreground">
                  {formatEntero(o.cantidad)}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <span className="text-[13px] font-medium" id="filtro-nivel">
          Nivel
        </span>
        <div
          role="group"
          aria-labelledby="filtro-nivel"
          className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1 sm:flex-wrap sm:overflow-visible"
        >
          {NIVELES.map((n) => {
            const activo = nivel === n;
            return (
              <button
                key={n}
                type="button"
                aria-pressed={activo}
                onClick={() => onNivel(n)}
                className={cn(
                  "h-7 shrink-0 rounded-full border px-3 text-xs transition-colors",
                  activo
                    ? "border-action bg-action text-action-foreground"
                    : "border-input hover:bg-accent",
                )}
              >
                {n}
              </button>
            );
          })}
        </div>
      </div>

      <NotasJornada key={`${notaKey}|${nota}`} nota={nota} onGuardar={onGuardarNota} />
    </aside>
  );
}
