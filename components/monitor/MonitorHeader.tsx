"use client";

import { cn } from "@/lib/utils";
import { MonthPicker } from "@/components/reportes/MonthPicker";
import { nombreMesAnio } from "@/components/reportes/fechas";
import { VipSwitch } from "@/components/dashboard/PeriodFilter";
import { PdfButton } from "@/components/pdf/PdfButton";

export function MonitorHeader({
  mes,
  mesActual,
  onMes,
  diasConDatos,
  soloVip,
  onSoloVip,
  onPdf,
  pdfDisabled,
}: {
  mes: string;
  mesActual: string;
  onMes: (m: string) => void;
  diasConDatos: number | null;
  soloVip: boolean;
  onSoloVip: (v: boolean) => void;
  onPdf: () => void;
  pdfDisabled: boolean;
}) {
  const enCurso = mes === mesActual;
  return (
    <div className="flex flex-wrap items-end justify-between gap-3.5">
      <div className="flex flex-col gap-0.5">
        <div className="flex flex-wrap items-center gap-2.5">
          <h1 className="text-[26px] font-bold leading-tight tracking-tight">Monitor regional</h1>
          <span
            className={cn(
              "rounded-full px-2.5 py-[3px] text-xs font-semibold",
              enCurso ? "bg-brand-soft text-brand" : "bg-muted text-muted-foreground",
            )}
          >
            {enCurso
              ? `En curso${diasConDatos ? ` · ${diasConDatos} ${diasConDatos === 1 ? "día" : "días"}` : ""}`
              : "Mes completo"}
          </span>
        </div>
        <p className="text-muted-foreground">
          SLA, tiempo y cuellos de botella por moneda · {nombreMesAnio(mes)}
        </p>
      </div>
      <div className="flex flex-wrap items-center gap-2.5">
        <MonthPicker mes={mes} mesActual={mesActual} onChange={onMes} />
        <span aria-hidden className="h-6 w-px bg-border" />
        <VipSwitch checked={soloVip} onCheckedChange={onSoloVip} />
        <PdfButton onClick={onPdf} disabled={pdfDisabled} />
      </div>
    </div>
  );
}
