import { Lightbulb } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatEntero } from "@/lib/format";
import { lecturaFranja, textoFranja, type FilaMoneda } from "@/lib/monitor";
import { cardClass } from "@/components/dashboard/CardHeading";

const EJE = [0, 6, 12, 18, 23];
const hh = (h: number) => String(h).padStart(2, "0");

export function HourlyGaps({ fila, className }: { fila: FilaMoneda; className?: string }) {
  const horas = fila.seg.brechasHora;
  const max = Math.max(1, ...horas);
  const f = fila.franja;
  const enFranja = (h: number) => f != null && h >= f.inicio && h < f.inicio + 3;
  const resumen = f
    ? `Brechas por hora de ${fila.moneda}: ${formatEntero(fila.seg.brechas)} en total, franja crítica ${textoFranja(f)} con ${formatEntero(f.brechas)}.`
    : `Brechas por hora de ${fila.moneda}: sin brechas este mes.`;

  return (
    <section className={cn(cardClass, "flex flex-col gap-3.5", className)}>
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-[15px] font-semibold">Brechas por hora · {fila.moneda}</h2>
        {f && (
          <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <span className="size-2.5 rounded-[3px] bg-danger" />
            Franja crítica {textoFranja(f)}
          </span>
        )}
      </div>

      <div role="img" aria-label={resumen} className="flex flex-col gap-1.5">
        <div className="flex h-[150px] items-end gap-1">
          {horas.map((n, h) => (
            <div
              key={h}
              className="flex h-full flex-1 flex-col items-center justify-end gap-1"
              title={`${hh(h)}:00 · ${formatEntero(n)} ${n === 1 ? "brecha" : "brechas"}${enFranja(h) ? " · franja crítica" : ""}`}
            >
              <span
                className={cn(
                  "font-mono text-[10px] leading-none text-muted-foreground",
                  !enFranja(h) && "hidden sm:block",
                  enFranja(h) && "font-semibold text-danger-text",
                )}
              >
                {n || ""}
              </span>
              <span
                className={cn("w-full rounded-t-[3px]", enFranja(h) ? "bg-danger" : "bg-bar")}
                style={{ height: `${(n / max) * 82}%`, minHeight: n ? 2 : 0 }}
              />
            </div>
          ))}
        </div>
        <div aria-hidden className="flex gap-1 border-t border-border pt-1 font-mono text-[10px] text-muted-foreground">
          {horas.map((_, h) => (
            <span key={h} className="flex-1 text-center">
              {EJE.includes(h) ? hh(h) : ""}
            </span>
          ))}
        </div>
      </div>

      <p className="mt-auto flex items-start gap-2.5 rounded-lg bg-muted px-3.5 py-2.5 text-[13px]">
        <Lightbulb className="mt-px size-4 shrink-0 text-warning-text" />
        {lecturaFranja(fila.moneda, fila.seg)}
      </p>
    </section>
  );
}
