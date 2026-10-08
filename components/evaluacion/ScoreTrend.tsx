"use client";

import { cn } from "@/lib/utils";
import { formatDecimal, formatEntero } from "@/lib/format";
import { colorNota, fondoNota } from "@/lib/evaluacion";
import { Skeleton } from "@/components/ui/skeleton";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import type { Historial } from "./useHistorialOperador";

export function ScoreTrend({
  operador,
  n,
  onN,
  historial,
  cargando,
  dia,
}: {
  operador: string;
  n: 7 | 30;
  onN: (n: 7 | 30) => void;
  historial: Historial | null;
  cargando: boolean;
  dia: string;
}) {
  const delta =
    historial?.promedio != null && historial.promedioAnterior != null
      ? historial.promedio - historial.promedioAnterior
      : null;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-sm font-semibold">Evolución de la nota</span>
        <ToggleGroup
          type="single"
          value={String(n)}
          onValueChange={(v) => v && onN(Number(v) as 7 | 30)}
          aria-label="Ventana de días"
          spacing={0.5}
          className="rounded-[9px] border border-border bg-muted p-[3px]"
        >
          {[7, 30].map((v) => (
            <ToggleGroupItem
              key={v}
              value={String(v)}
              className="h-7 rounded-[7px] px-2.5 text-xs font-medium text-muted-foreground hover:bg-transparent hover:text-foreground data-[state=on]:bg-segment-active data-[state=on]:text-foreground data-[state=on]:shadow-[0_1px_2px_rgba(0,0,0,.18),0_0_0_1px_var(--input)]"
            >
              {v} días
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
      </div>

      {cargando || !historial ? (
        <Skeleton className="h-[150px] w-full rounded-lg" />
      ) : (
        <>
          <div className="flex flex-wrap gap-x-5 gap-y-1 text-xs text-muted-foreground">
            <span className="flex items-center gap-1.5">
              Promedio
              <span
                className={cn(
                  "font-mono text-sm font-semibold",
                  historial.promedio != null && colorNota(historial.promedio),
                )}
              >
                {historial.promedio != null ? formatDecimal(historial.promedio, 2) : "—"}
              </span>
            </span>
            {delta != null && (
              <span className="flex items-center gap-1.5">
                vs período anterior
                <span
                  className={cn(
                    "rounded-full px-2 py-[2px] font-mono font-semibold",
                    Math.abs(delta) < 0.05
                      ? "bg-muted text-muted-foreground"
                      : delta > 0
                        ? "bg-success-soft text-success-text"
                        : "bg-danger-soft text-danger-text",
                  )}
                >
                  {Math.abs(delta) < 0.05 ? "" : delta > 0 ? "+" : "-"}
                  {formatDecimal(Math.abs(delta), 2)}
                </span>
              </span>
            )}
            <span className="flex items-center gap-1.5">
              Días bajo 6
              <span
                className={cn(
                  "font-mono text-sm font-semibold",
                  historial.diasBajo6 > 0 ? "text-danger-text" : "text-foreground",
                )}
              >
                {formatEntero(historial.diasBajo6)}
              </span>
            </span>
          </div>

          <div className="flex gap-2">
            <div
              role="img"
              aria-label={`Nota diaria de ${operador} en los últimos ${n} días, promedio ${historial.promedio != null ? formatDecimal(historial.promedio, 2) : "sin datos"}`}
              className={cn(
                "relative flex h-24 flex-1 items-end",
                n === 30 ? "gap-[3px]" : "gap-2",
              )}
            >
              {/* Referencias en 8 y 6 */}
              <span className="pointer-events-none absolute inset-x-0 bottom-[80%] border-t border-dashed border-success/70" />
              <span className="pointer-events-none absolute inset-x-0 bottom-[60%] border-t border-dashed border-danger/70" />
              {historial.puntos.map((p) => (
                <span
                  key={p.dia}
                  title={`${p.etiqueta}: ${p.nota != null ? formatDecimal(p.nota, 2) : "sin evaluación"}`}
                  className={cn(
                    "relative flex-1 rounded-t-[3px]",
                    p.nota != null ? fondoNota(p.nota) : "bg-track",
                    p.dia === dia ? "opacity-100 ring-2 ring-foreground" : "opacity-75",
                  )}
                  style={{ height: p.nota != null ? `${p.nota * 10}%` : "2%" }}
                />
              ))}
            </div>
            <div className="relative h-24 w-5 font-mono text-[10px] text-muted-foreground">
              <span className="absolute bottom-[80%] translate-y-1/2">8</span>
              <span className="absolute bottom-[60%] translate-y-1/2">6</span>
            </div>
          </div>
          <div className="flex justify-between pr-7 font-mono text-[11px] text-muted-foreground">
            <span>{historial.puntos[0]?.etiqueta}</span>
            <span>{historial.puntos.at(-1)?.etiqueta}</span>
          </div>
        </>
      )}
    </div>
  );
}
