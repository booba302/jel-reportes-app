"use client";

import { useState } from "react";
import { CalendarDays, ChevronDown, ChevronLeft, ChevronRight } from "lucide-react";
import { addMonths } from "date-fns";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { nombreMesAnio, parseMesStr, toMesStr } from "./fechas";

const MESES = [
  "Ene", "Feb", "Mar", "Abr", "May", "Jun",
  "Jul", "Ago", "Sep", "Oct", "Nov", "Dic",
];

export function MonthPicker({
  mes,
  mesActual,
  onChange,
  estados,
  onAnioVisible,
}: {
  mes: string; // "YYYY-MM"
  mesActual: string;
  onChange: (mes: string) => void;
  /** Opcional: punto por mes (true = cerrado, verde; si no, ámbar). */
  estados?: Record<string, boolean>;
  /** Avisa qué año muestra el popover (para cargar sus estados). */
  onAnioVisible?: (anio: number) => void;
}) {
  const [open, setOpen] = useState(false);
  const [anio, setAnio] = useState(() => Number(mes.slice(0, 4)));
  const anioActual = Number(mesActual.slice(0, 4));

  const mover = (delta: number) =>
    onChange(toMesStr(addMonths(parseMesStr(mes), delta)));

  return (
    <div className="flex items-center gap-1.5">
      <Button
        variant="outline"
        size="icon"
        className="size-9 rounded-lg bg-card dark:bg-card"
        onClick={() => mover(-1)}
        aria-label="Mes anterior"
      >
        <ChevronLeft className="size-4" />
      </Button>

      <Popover
        open={open}
        onOpenChange={(o) => {
          setOpen(o);
          if (o) {
            setAnio(Number(mes.slice(0, 4)));
            onAnioVisible?.(Number(mes.slice(0, 4)));
          }
        }}
      >
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            className="h-9 min-w-[176px] justify-between gap-2 rounded-lg bg-card text-[13px] font-medium dark:bg-card"
          >
            <span className="flex items-center gap-2">
              <CalendarDays className="size-4 text-muted-foreground" />
              {nombreMesAnio(mes)}
            </span>
            <ChevronDown className="size-4 text-muted-foreground" />
          </Button>
        </PopoverTrigger>
        <PopoverContent align="end" className="w-64 p-3">
          <div className="mb-3 flex items-center justify-between border-b border-border pb-3">
            <Button
              variant="ghost"
              size="icon"
              className="size-8"
              onClick={() => {
                setAnio(anio - 1);
                onAnioVisible?.(anio - 1);
              }}
              aria-label="Año anterior"
            >
              <ChevronLeft className="size-4" />
            </Button>
            <span className="font-mono font-semibold">{anio}</span>
            <Button
              variant="ghost"
              size="icon"
              className="size-8"
              onClick={() => {
                setAnio(anio + 1);
                onAnioVisible?.(anio + 1);
              }}
              disabled={anio >= anioActual}
              aria-label="Año siguiente"
            >
              <ChevronRight className="size-4" />
            </Button>
          </div>
          <div className="grid grid-cols-3 gap-1.5">
            {MESES.map((m, i) => {
              const val = `${anio}-${String(i + 1).padStart(2, "0")}`;
              const futuro = val > mesActual;
              const activo = val === mes;
              return (
                <button
                  key={m}
                  type="button"
                  disabled={futuro}
                  aria-pressed={activo}
                  onClick={() => {
                    onChange(val);
                    setOpen(false);
                  }}
                  className={cn(
                    "relative h-9 rounded-lg text-[13px] transition-colors",
                    activo
                      ? "bg-foreground font-semibold text-background"
                      : futuro
                        ? "cursor-not-allowed text-day-off-text"
                        : "hover:bg-accent",
                  )}
                >
                  {m}
                  {estados && !futuro && (
                    <span
                      aria-label={estados[val] ? "cerrado" : "sin cerrar"}
                      className={cn(
                        "absolute right-1.5 top-1.5 size-1.5 rounded-full",
                        estados[val] ? "bg-success" : "bg-warning",
                      )}
                    />
                  )}
                </button>
              );
            })}
          </div>
          {estados && (
            <div className="mt-3 flex gap-3 border-t border-border pt-2.5 text-xs text-muted-foreground">
              <span className="flex items-center gap-1.5">
                <span className="size-1.5 rounded-full bg-success" /> Cerrado
              </span>
              <span className="flex items-center gap-1.5">
                <span className="size-1.5 rounded-full bg-warning" /> Sin cerrar
              </span>
            </div>
          )}
        </PopoverContent>
      </Popover>

      <Button
        variant="outline"
        size="icon"
        className="size-9 rounded-lg bg-card dark:bg-card"
        onClick={() => mover(1)}
        disabled={mes >= mesActual}
        aria-label="Mes siguiente"
      >
        <ChevronRight className="size-4" />
      </Button>
    </div>
  );
}
