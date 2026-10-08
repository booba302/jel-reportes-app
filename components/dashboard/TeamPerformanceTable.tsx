import { cn } from "@/lib/utils";
import { formatDecimal, formatEntero, formatPct } from "@/lib/format";
import { SLA_AMARILLO, SLA_UMBRAL_MIN, SLA_VERDE } from "@/lib/constants";
import type { OperadorRow } from "./useDashboardData";
import { cardClass } from "./CardHeading";

const cols =
  "grid-cols-[minmax(130px,1.6fr)_minmax(70px,.8fr)_minmax(70px,.8fr)_minmax(90px,1fr)_minmax(170px,2.2fr)]";

function tono(sla: number) {
  if (sla >= SLA_VERDE)
    return { bar: "bg-success", badge: "bg-success-soft text-success-text" };
  if (sla >= SLA_AMARILLO)
    return { bar: "bg-warning", badge: "bg-warning-soft text-warning-text" };
  return { bar: "bg-danger", badge: "bg-danger-soft text-danger-text" };
}

export function TeamPerformanceTable({
  operadores,
  className,
}: {
  operadores: OperadorRow[];
  className?: string;
}) {
  return (
    <section className={cn(cardClass, "flex flex-col gap-4", className)}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex flex-col gap-0.5">
          <h2 className="text-[15px] font-semibold">Rendimiento del equipo</h2>
          <p className="text-xs text-muted-foreground">
            Ordenado por brechas · gestión manual, excluye Autopago · SLA &lt;{" "}
            {SLA_UMBRAL_MIN} min
          </p>
        </div>
        <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <span className="size-2 rounded-full bg-success" />≥ {SLA_VERDE}%
          </span>
          <span className="flex items-center gap-1.5">
            <span className="size-2 rounded-full bg-warning" />
            {SLA_AMARILLO}–{SLA_VERDE - 1}%
          </span>
          <span className="flex items-center gap-1.5">
            <span className="size-2 rounded-full bg-danger" />
            &lt; {SLA_AMARILLO}%
          </span>
        </div>
      </div>

      <div className="overflow-x-auto">
        <div role="table" className="min-w-[640px] text-sm">
          <div
            role="row"
            className={cn(
              "grid items-center gap-4 rounded-lg border border-border bg-muted px-3.5 py-[9px] text-xs font-medium text-muted-foreground",
              cols,
            )}
          >
            <span role="columnheader">Operador</span>
            <span role="columnheader" className="text-right">
              Retiros
            </span>
            <span role="columnheader" className="text-right">
              Brechas
            </span>
            <span role="columnheader" className="text-right">
              Tiempo prom.
            </span>
            <span role="columnheader">SLA cumplido</span>
          </div>

          {operadores.length === 0 ? (
            <div className="py-8 text-center text-muted-foreground">
              No hay registros de operadores para esta selección.
            </div>
          ) : (
            operadores.map((o) => {
              const t = tono(o.sla);
              return (
                <div
                  key={o.nombre}
                  role="row"
                  className={cn(
                    "grid items-center gap-4 border-b border-border px-3.5 py-[11px]",
                    cols,
                  )}
                >
                  <span role="cell" className="flex min-w-0 items-center gap-2.5">
                    <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-semibold">
                      {o.nombre.charAt(0).toUpperCase()}
                    </span>
                    <span className="truncate font-medium">{o.nombre}</span>
                  </span>
                  <span role="cell" className="text-right font-mono font-medium">
                    {formatEntero(o.retiros)}
                  </span>
                  <span
                    role="cell"
                    className="text-right font-mono font-semibold text-danger-text"
                  >
                    {formatEntero(o.brechas)}
                  </span>
                  <span role="cell" className="text-right font-mono font-medium">
                    {formatDecimal(o.tiempo)}
                    <span className="font-normal text-muted-foreground"> min</span>
                  </span>
                  <span role="cell" className="flex items-center gap-3">
                    <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-track">
                      <span
                        className={cn("block h-full rounded-full", t.bar)}
                        style={{ width: `${Math.min(100, o.sla)}%` }}
                      />
                    </span>
                    <span
                      className={cn(
                        "min-w-[58px] rounded-full px-2 py-[3px] text-center text-xs font-semibold",
                        t.badge,
                      )}
                    >
                      {formatPct(o.sla)}
                    </span>
                  </span>
                </div>
              );
            })
          )}
        </div>
      </div>
    </section>
  );
}
