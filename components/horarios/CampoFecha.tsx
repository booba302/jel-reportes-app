"use client";

import { useState } from "react";
import { CalendarDays } from "lucide-react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import type { Matcher } from "react-day-picker";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { parseDiaStr, toDiaStr } from "@/components/reportes/fechas";

/** Campo de fecha con el mismo calendario que el resto del sistema. `valor` es "YYYY-MM-DD" o "". */
export function CampoFecha({
  id,
  valor,
  onCambio,
  deshabilitadas,
  disabled,
}: {
  id?: string;
  valor: string;
  onCambio: (f: string) => void;
  deshabilitadas?: Matcher;
  disabled?: boolean;
}) {
  const [abierto, setAbierto] = useState(false);
  const d = valor ? parseDiaStr(valor) : undefined;
  return (
    <Popover open={abierto} onOpenChange={setAbierto}>
      <PopoverTrigger asChild>
        <Button
          id={id}
          variant="outline"
          disabled={disabled}
          className={cn(
            "h-9 justify-start gap-2 rounded-lg bg-card font-mono text-[13px] font-medium dark:bg-card",
            !d && "font-sans text-muted-foreground",
          )}
        >
          <CalendarDays className="size-4 text-muted-foreground" />
          {d ? format(d, "dd MMM yyyy", { locale: es }) : "Elegir fecha"}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-auto p-3">
        <Calendar
          mode="single"
          locale={es}
          selected={d}
          defaultMonth={d}
          disabled={deshabilitadas}
          onSelect={(sel) => {
            if (!sel) return;
            onCambio(toDiaStr(sel));
            setAbierto(false);
          }}
        />
      </PopoverContent>
    </Popover>
  );
}
