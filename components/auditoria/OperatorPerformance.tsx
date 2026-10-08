import { cn } from "@/lib/utils";
import { formatEntero } from "@/lib/format";
import { cardClass } from "@/components/dashboard/CardHeading";
import type { DesempenoRow } from "./calculos";

export function OperatorPerformance({
  filas,
  className,
}: {
  filas: DesempenoRow[];
  className?: string;
}) {
  return (
    <section className={cn(cardClass, "flex flex-col gap-3.5", className)}>
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-[15px] font-semibold">Desempeño por operador</h2>
        <span className="text-xs text-muted-foreground">cumplen / brechas</span>
      </div>

      {filas.length === 0 ? (
        <p className="py-6 text-center text-[13px] text-muted-foreground">
          Sin gestión manual en esta selección.
        </p>
      ) : (
        <ul className="flex max-h-[260px] flex-col gap-3 overflow-y-auto pr-1">
          {filas.map((f) => {
            const total = f.cumplen + f.brechas;
            return (
              <li key={f.nombre} className="flex flex-col gap-1.5">
                <div className="flex items-center justify-between gap-2 text-[13px]">
                  <span className="truncate font-medium">{f.nombre}</span>
                  <span className="shrink-0 font-mono">
                    {formatEntero(f.cumplen)} /{" "}
                    <span className="text-danger-text">{formatEntero(f.brechas)}</span>
                  </span>
                </div>
                <span className="flex h-1.5 overflow-hidden rounded-full bg-track">
                  {total > 0 && (
                    <>
                      <span
                        className="h-full bg-success"
                        style={{ width: `${(f.cumplen / total) * 100}%` }}
                      />
                      <span
                        className="h-full bg-danger"
                        style={{ width: `${(f.brechas / total) * 100}%` }}
                      />
                    </>
                  )}
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
