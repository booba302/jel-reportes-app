"use client";

import { useState } from "react";
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  RefreshCw,
} from "lucide-react";
import { addDays, format } from "date-fns";
import { es } from "date-fns/locale";
import { PdfButton } from "@/components/pdf/PdfButton";
import { cn } from "@/lib/utils";
import { capitalizar } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { parseDiaStr, toDiaStr } from "@/components/reportes/fechas";

export function EvalHeader({
  dia,
  ayer,
  panel,
  onDia,
  sincronizando,
  onSincronizar,
  onExportar,
  exportarDisabled,
  excluidos,
}: {
  dia: string;
  ayer: string;
  panel: string;
  onDia: (d: string) => void;
  sincronizando: boolean;
  onSincronizar: () => void;
  onExportar: () => void;
  exportarDisabled: boolean;
  excluidos: React.ReactNode;
}) {
  const [calOpen, setCalOpen] = useState(false);
  const d = parseDiaStr(dia);

  return (
    <div className="flex flex-wrap items-end justify-between gap-3.5">
      <div className="flex flex-col gap-0.5">
        <h1 className="text-[26px] font-bold leading-tight tracking-tight">
          Evaluación diaria
        </h1>
        <p className="text-muted-foreground">
          Panel {panel} ·{" "}
          {capitalizar(format(d, "EEEE d 'de' MMMM, yyyy", { locale: es }))}
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-1.5">
          <Button
            variant="outline"
            size="icon"
            className="size-9 rounded-lg bg-card dark:bg-card"
            onClick={() => onDia(toDiaStr(addDays(d, -1)))}
            aria-label="Día anterior"
          >
            <ChevronLeft className="size-4" />
          </Button>
          <Popover open={calOpen} onOpenChange={setCalOpen}>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                className="h-9 gap-2 rounded-lg bg-card font-mono text-[13px] font-medium dark:bg-card"
              >
                <CalendarDays className="size-4 text-muted-foreground" />
                {format(d, "d MMM yyyy", { locale: es })}
              </Button>
            </PopoverTrigger>
            <PopoverContent align="end" className="w-auto p-3">
              <Calendar
                mode="single"
                locale={es}
                selected={d}
                defaultMonth={d}
                disabled={{ after: parseDiaStr(ayer) }}
                onSelect={(sel) => {
                  if (!sel) return;
                  onDia(toDiaStr(sel));
                  setCalOpen(false);
                }}
              />
            </PopoverContent>
          </Popover>
          <Button
            variant="outline"
            size="icon"
            className="size-9 rounded-lg bg-card dark:bg-card"
            onClick={() => onDia(toDiaStr(addDays(d, 1)))}
            disabled={dia >= ayer}
            aria-label="Día siguiente"
          >
            <ChevronRight className="size-4" />
          </Button>
        </div>

        <Button
          variant="outline"
          className="h-9 gap-2 rounded-lg bg-card dark:bg-card"
          onClick={onSincronizar}
          disabled={sincronizando}
        >
          <RefreshCw className={cn("size-4", sincronizando && "animate-spin")} />
          {sincronizando ? "Sincronizando…" : "Sincronizar operadores"}
        </Button>
        <PdfButton onClick={onExportar} disabled={exportarDisabled} />
        {excluidos}
      </div>
    </div>
  );
}
