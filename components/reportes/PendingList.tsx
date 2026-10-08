import { CircleCheck } from "lucide-react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { cardClass } from "@/components/dashboard/CardHeading";
import type { DiaInfo } from "./useReportesMes";
import { diasAtraso, parseDiaStr, parseMesStr, textoAtraso } from "./fechas";

export function PendingList({
  mes,
  dias,
  hoy,
  currency,
  seleccionado,
  onSelect,
  onCargar,
  className,
}: {
  mes: string;
  dias: DiaInfo[] | null;
  hoy: string;
  currency: string;
  seleccionado: string | null;
  onSelect: (dia: string) => void;
  onCargar: (dia: string) => void;
  className?: string;
}) {
  const pendientes = (dias ?? [])
    .filter((d) => d.estado === "faltante")
    .sort((a, b) => b.dia.localeCompare(a.dia));

  return (
    <section className={cn(cardClass, "flex flex-col gap-3", className)}>
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-[15px] font-semibold">Pendientes por cargar</h2>
        {dias && pendientes.length > 0 && (
          <span className="rounded-full bg-warning-soft px-2 py-[3px] font-mono text-xs font-semibold text-warning-text">
            {pendientes.length}
          </span>
        )}
      </div>

      {!dias ? (
        <div className="flex flex-col gap-2.5">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-11 w-full rounded-lg" />
          ))}
        </div>
      ) : pendientes.length === 0 ? (
        <div className="flex items-start gap-2.5 rounded-[10px] border border-day-loaded-border bg-day-loaded-bg px-3.5 py-3 text-[13px] text-success-text">
          <CircleCheck className="mt-px size-4 shrink-0" />
          <span>
            Todos los días de{" "}
            {format(parseMesStr(mes), "LLLL", { locale: es })} están cargados.
          </span>
        </div>
      ) : (
        <ul className="flex max-h-[360px] flex-col overflow-y-auto">
          {pendientes.map((d) => {
            const atraso = diasAtraso(d.dia, hoy);
            return (
              <li
                key={d.dia}
                className={cn(
                  "flex items-center gap-3 border-b border-border py-2.5 last:border-b-0",
                  seleccionado === d.dia && "-mx-2 rounded-lg bg-muted px-2",
                )}
              >
                <button
                  type="button"
                  onClick={() => onSelect(d.dia)}
                  className="flex min-w-0 flex-1 flex-col items-start text-left"
                >
                  <span className="font-mono text-[13px] font-semibold">
                    {format(parseDiaStr(d.dia), "dd MMM yyyy", { locale: es })}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {currency} · {textoAtraso(atraso)} de atraso
                  </span>
                </button>
                <Button
                  size="sm"
                  className="shrink-0 rounded-lg bg-action text-action-foreground hover:bg-action-hover"
                  onClick={() => onCargar(d.dia)}
                >
                  Cargar
                </Button>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
