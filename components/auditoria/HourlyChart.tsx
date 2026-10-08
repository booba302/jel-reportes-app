import { cn } from "@/lib/utils";
import { formatEntero } from "@/lib/format";
import { cardClass } from "@/components/dashboard/CardHeading";
import type { HoraPunto } from "./calculos";

/** Retiros por hora (08–22), apilados: dentro de SLA abajo y brecha arriba. */
export function HourlyChart({
  datos,
  className,
}: {
  datos: HoraPunto[];
  className?: string;
}) {
  const max = Math.max(1, ...datos.map((d) => d.total));
  const totalBrechas = datos.reduce((s, d) => s + d.brecha, 0);
  const pico = datos.reduce((a, b) => (b.total > a.total ? b : a), datos[0]);

  return (
    <section className={cn(cardClass, "flex flex-col gap-3.5", className)}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-[15px] font-semibold">Retiros por hora</h2>
        <div className="flex flex-wrap gap-3.5 text-xs text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <span className="size-2.5 rounded-sm bg-chart-in-sla" />
            Dentro de SLA
          </span>
          <span className="flex items-center gap-1.5">
            <span className="size-2.5 rounded-sm bg-danger" />
            Brecha
          </span>
        </div>
      </div>

      <div
        role="img"
        aria-label={`Retiros por hora. Hora pico ${pico?.hora}:00 con ${formatEntero(pico?.total ?? 0)} retiros; ${formatEntero(totalBrechas)} brechas en el día.`}
        className="grid h-[220px] items-end gap-[3px] sm:gap-1"
        style={{ gridTemplateColumns: `repeat(${datos.length}, minmax(0, 1fr))` }}
      >
        {datos.map((d) => (
          <div
            key={d.hora}
            title={`${d.hora}:00 · ${formatEntero(d.total)} retiros · ${formatEntero(d.brecha)} en brecha`}
            className="flex h-full min-w-0 flex-col items-center justify-end gap-1"
          >
            {d.total > 0 && (
              <span className="hidden font-mono text-[10px] leading-none text-muted-foreground sm:block">
                {d.total}
              </span>
            )}
            <div
              className="flex w-full flex-col overflow-hidden rounded-t-[3px]"
              // Se reserva espacio arriba para la cifra del total.
              style={{ height: `calc(${d.total / max} * (100% - 14px))` }}
            >
              {d.brecha > 0 && (
                <span
                  className="block w-full bg-danger"
                  style={{ height: `${(d.brecha / d.total) * 100}%` }}
                />
              )}
              <span className="block w-full flex-1 bg-chart-in-sla" />
            </div>
          </div>
        ))}
      </div>

      <div
        className="grid gap-[3px] font-mono text-[10px] text-muted-foreground sm:gap-1 sm:text-[11px]"
        style={{ gridTemplateColumns: `repeat(${datos.length}, minmax(0, 1fr))` }}
      >
        {datos.map((d, i) => (
          <span
            key={d.hora}
            className={cn("text-center", i % 3 !== 0 && "invisible sm:visible")}
          >
            {d.hora}
          </span>
        ))}
      </div>
    </section>
  );
}
