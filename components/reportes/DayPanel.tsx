"use client";

import { useRouter } from "next/navigation";
import {
  CalendarSearch,
  CloudDownload,
  Eye,
  RotateCw,
  TriangleAlert,
} from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { formatEntero, formatPct } from "@/lib/format";
import { SLA_META_PCT } from "@/lib/constants";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { cardClass } from "@/components/dashboard/CardHeading";
import type { DiaInfo } from "./useReportesMes";
import type { DetalleDia } from "./useDiaDetalle";
import { BorrarReporteDialog } from "./BorrarReporteDialog";
import { diaLargo, diasAtraso, textoAtraso } from "./fechas";

const botonAccion =
  "w-full gap-2 rounded-lg bg-action text-action-foreground hover:bg-action-hover";

function Fila({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-3 border-b border-border py-2.5 text-sm last:border-b-0">
      <span className="text-muted-foreground">{label}</span>
      <span className="text-right">{children}</span>
    </div>
  );
}

function notaExonerados(n: number) {
  if (n === 0) return "sin Autopago";
  return `sin Autopago ni ${formatEntero(n)} ${n === 1 ? "exonerado" : "exonerados"}`;
}

export function DayPanel({
  dia,
  hoy,
  currency,
  detalle,
  cargandoDetalle,
  errorDetalle,
  onCargar,
  onBorrado,
  cargando,
}: {
  dia: DiaInfo | null;
  hoy: string;
  currency: string;
  detalle: DetalleDia | null;
  cargandoDetalle: boolean;
  errorDetalle: boolean;
  onCargar: (dia: string) => void;
  onBorrado: (dia: string) => void;
  /** Mientras se consulta el mes. */
  cargando: boolean;
}) {
  const router = useRouter();

  if (cargando) {
    return (
      <section className={cn(cardClass, "flex flex-col gap-3")}>
        <Skeleton className="h-3 w-24" />
        <Skeleton className="h-5 w-48" />
        <Skeleton className="h-24 w-full rounded-lg" />
        <Skeleton className="h-10 w-full rounded-lg" />
      </section>
    );
  }

  if (!dia) {
    return (
      <section
        className={cn(
          cardClass,
          "flex flex-col items-center gap-2 py-8 text-center",
        )}
      >
        <span className="flex size-10 items-center justify-center rounded-full bg-muted text-muted-foreground">
          <CalendarSearch className="size-5" />
        </span>
        <span className="font-semibold">Selecciona un día</span>
        <span className="max-w-[240px] text-[13px] text-muted-foreground">
          Elige un día del calendario para ver su reporte o cargarlo.
        </span>
      </section>
    );
  }

  const cargado = dia.estado === "cargado" && dia.historial;

  return (
    <section className={cn(cardClass, "flex flex-col gap-4")}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex flex-col gap-0.5">
          <span className="text-xs text-muted-foreground">Día seleccionado</span>
          <h2 className="text-lg font-bold leading-tight">{diaLargo(dia.dia)}</h2>
        </div>
        <span
          className={cn(
            "shrink-0 rounded-full px-2 py-[3px] text-xs font-semibold",
            cargado
              ? "bg-success-soft text-success-text"
              : "bg-warning-soft text-warning-text",
          )}
        >
          {cargado ? "Cargado" : "Faltante"}
        </span>
      </div>

      {cargado ? (
        <>
          <div className="flex flex-col">
            <Fila label="Retiros">
              <span className="font-mono font-semibold">
                {formatEntero(cargado.totalRegistros ?? 0)}
              </span>
            </Fila>
            <Fila label="SLA">
              {cargandoDetalle ? (
                <Skeleton className="ml-auto h-4 w-14" />
              ) : errorDetalle || !detalle ? (
                <span className="text-muted-foreground">No disponible</span>
              ) : (
                <span className="flex flex-col items-end">
                  <span
                    className={cn(
                      "font-mono font-semibold",
                      detalle.sla >= SLA_META_PCT
                        ? "text-success-text"
                        : "text-danger-text",
                    )}
                  >
                    {formatPct(detalle.sla)}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {notaExonerados(detalle.exonerados)}
                  </span>
                </span>
              )}
            </Fila>
            <Fila label="Subido por">{cargado.subidoPor || "Sistema"}</Fila>
            <Fila label="Subido el">
              <span className="font-mono text-muted-foreground">
                {cargado.subidoEl
                  ? format(new Date(cargado.subidoEl), "dd/MM HH:mm")
                  : "—"}
              </span>
            </Fila>
          </div>

          <div className="flex flex-col gap-2">
            <Button
              className={cn(botonAccion, "h-10")}
              onClick={() => {
                const params = new URLSearchParams({
                  fecha: cargado.fechaReporte,
                  moneda: cargado.moneda,
                });
                router.push(`/auditoria-diaria?${params}`);
              }}
            >
              <Eye className="size-4" />
              Ver auditoría del día
            </Button>
            <Button
              variant="outline"
              className="h-10 w-full gap-2 rounded-lg"
              onClick={() => onCargar(dia.dia)}
            >
              <RotateCw className="size-4" />
              Cargar nuevamente
            </Button>
            <BorrarReporteDialog historial={cargado} onBorrado={onBorrado} />
          </div>
        </>
      ) : (
        <>
          <div className="flex items-start gap-2.5 rounded-[10px] border border-day-missing-border bg-day-missing-bg px-3.5 py-3 text-[13px] text-warning-text">
            <TriangleAlert className="mt-px size-4 shrink-0" />
            <span>
              No hay retiros de {currency} cargados para este día. Lleva{" "}
              {textoAtraso(diasAtraso(dia.dia, hoy))} de atraso.
            </span>
          </div>
          <Button
            className={cn(botonAccion, "h-[42px]")}
            onClick={() => onCargar(dia.dia)}
          >
            <CloudDownload className="size-4" />
            Cargar reporte
          </Button>
          <p className="text-xs text-muted-foreground">
            Primero se intenta la sincronización con el API. Si falla, podrás
            subir el archivo Excel de ese día.
          </p>
        </>
      )}
    </section>
  );
}
