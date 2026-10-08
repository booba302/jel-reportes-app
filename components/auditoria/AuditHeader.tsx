"use client";

import { useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { addDays, format } from "date-fns";
import { es } from "date-fns/locale";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { capitalizar } from "@/lib/format";
import { PdfButton } from "@/components/pdf/PdfButton";
import { parseDiaStr, toDiaStr } from "@/components/reportes/fechas";

export function AuditHeader({
  fecha,
  ayer,
  currency,
  onFecha,
  onPdf,
  exportDisabled,
}: {
  fecha: string;
  ayer: string;
  currency: string;
  onFecha: (f: string) => void;
  onPdf: () => void;
  exportDisabled: boolean;
}) {
  const [calOpen, setCalOpen] = useState(false);
  const d = parseDiaStr(fecha);
  const titulo = capitalizar(format(d, "EEEE d 'de' MMMM, yyyy", { locale: es }));
  const mover = (delta: number) => onFecha(toDiaStr(addDays(d, delta)));

  return (
    <div className="flex flex-col gap-3">
      <Link
        href={`/reportes?mes=${fecha.slice(0, 7)}&dia=${fecha.slice(8, 10)}`}
        className="flex w-fit items-center gap-1.5 text-[13px] text-muted-foreground transition-colors hover:text-foreground print:hidden"
      >
        <ArrowLeft className="size-3.5" />
        Volver a Reportes
      </Link>

      <div className="flex flex-wrap items-end justify-between gap-3.5">
        <h1 className="text-[26px] font-bold leading-tight tracking-tight">
          {titulo}{" "}
          <span className="text-base font-normal tracking-normal text-muted-foreground">
            · moneda {currency}
          </span>
        </h1>

        <div className="flex flex-wrap items-center gap-2.5">
          <div className="flex items-center gap-1.5">
            <Button
              variant="outline"
              size="icon"
              className="size-9 rounded-lg bg-card dark:bg-card"
              onClick={() => mover(-1)}
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
                  {format(d, "dd MMM yyyy", { locale: es })}
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
                    onFecha(toDiaStr(sel));
                    setCalOpen(false);
                  }}
                />
              </PopoverContent>
            </Popover>
            <Button
              variant="outline"
              size="icon"
              className="size-9 rounded-lg bg-card dark:bg-card"
              onClick={() => mover(1)}
              disabled={fecha >= ayer}
              aria-label="Día siguiente"
            >
              <ChevronRight className="size-4" />
            </Button>
          </div>

          <span aria-hidden className="h-6 w-px bg-border print:hidden" />

          <div className="flex items-center gap-2 print:hidden">
            <PdfButton onClick={onPdf} disabled={exportDisabled} />
          </div>
        </div>
      </div>
    </div>
  );
}
