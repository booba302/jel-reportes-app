import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { formatDecimal, formatEntero, formatPct } from "@/lib/format";
import type { DiaCritico } from "@/lib/monitor";
import { cardClass } from "@/components/dashboard/CardHeading";

export const fechaCritico = (mes: string, d: DiaCritico) =>
  `${mes}-${String(d.dia).padStart(2, "0")}`;

export const diaSemanaCorto = (fecha: string) =>
  format(new Date(`${fecha}T12:00:00`), "EEE d MMM", { locale: es });

export function WorstDays({
  mes,
  dias,
  className,
}: {
  mes: string;
  dias: DiaCritico[];
  className?: string;
}) {
  return (
    <section className={cn(cardClass, "flex flex-col gap-3", className)}>
      <div className="flex flex-col gap-0.5">
        <h2 className="text-[15px] font-semibold">Días críticos</h2>
        <p className="text-[13px] text-muted-foreground">Los 5 días-moneda con menor SLA del mes</p>
      </div>
      {dias.length === 0 ? (
        <p className="py-6 text-center text-[13px] text-muted-foreground">Sin días con retiros evaluables.</p>
      ) : (
        <ul className="flex flex-col">
          {dias.map((d) => {
            const fecha = fechaCritico(mes, d);
            return (
              <li key={`${d.moneda}-${d.dia}`} className="border-b border-border last:border-0">
                <Link
                  href={`/auditoria-diaria?fecha=${fecha}&moneda=${d.moneda}`}
                  className="flex items-center gap-3 rounded-md px-1.5 py-2.5 hover:bg-muted"
                >
                  <span className="rounded-md bg-muted px-1.5 font-mono text-[12px] font-semibold">
                    {d.moneda}
                  </span>
                  <span className="flex min-w-0 flex-1 flex-col">
                    <span className="text-[13px] font-semibold">{diaSemanaCorto(fecha)}</span>
                    <span className="truncate text-xs text-muted-foreground">
                      {formatDecimal(d.tiempo ?? 0)} min · {formatEntero(d.brechas)} brechas de{" "}
                      {formatEntero(d.evaluables)}
                    </span>
                  </span>
                  <span
                    className={cn(
                      "font-mono text-[13px] font-bold",
                      d.sla >= 80 ? "text-warning-text" : "text-danger-text",
                    )}
                  >
                    {formatPct(d.sla)}
                  </span>
                  <ArrowUpRight className="size-4 shrink-0 text-muted-foreground" />
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
