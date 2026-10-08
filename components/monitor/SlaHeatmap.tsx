import Link from "next/link";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { SLA_META_PCT } from "@/lib/constants";
import { formatDecimal, formatEntero, formatPct } from "@/lib/format";
import { nivelCelda, type FilaMoneda, type Moneda, type NivelCelda } from "@/lib/monitor";
import { cardClass } from "@/components/dashboard/CardHeading";

export const COLOR_CELDA: Record<NivelCelda, string> = {
  buena: "bg-success",
  revisar: "bg-warning",
  mala: "bg-danger",
  vacio: "bg-muted",
};

const LEYENDA: [NivelCelda, string][] = [
  ["buena", `≥ ${SLA_META_PCT}%`],
  ["revisar", "80–89,9%"],
  ["mala", "< 80%"],
  ["vacio", "Sin datos"],
];

const EJE = [1, 5, 10, 15, 20, 25, 30];

export function SlaHeatmap({
  mes,
  filas,
  seleccionada,
}: {
  mes: string; // "YYYY-MM"
  filas: FilaMoneda[];
  seleccionada: Moneda | null;
}) {
  const diasDelMes = filas[0]?.dias.length ?? 30;
  const bajo = filas.reduce(
    (n, f) => n + f.dias.filter((d) => d.sla != null && d.sla < SLA_META_PCT).length,
    0,
  );

  return (
    <section className={cn(cardClass, "flex flex-col gap-3.5")}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex flex-col gap-0.5">
          <h2 className="text-[15px] font-semibold">SLA diario por moneda</h2>
          <p className="text-[13px] text-muted-foreground">
            Cada celda es un día. Haz clic en una celda para abrir la auditoría de ese día filtrada
            por moneda.
          </p>
        </div>
        <ul className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
          {LEYENDA.map(([n, label]) => (
            <li key={n} className="flex items-center gap-1.5">
              <span className={cn("size-2.5 rounded-[3px]", COLOR_CELDA[n])} />
              {label}
            </li>
          ))}
        </ul>
      </div>

      <div className="overflow-x-auto">
        <div
          role="img"
          aria-label={`SLA diario de ${filas.length} monedas: ${bajo} días-moneda bajo ${SLA_META_PCT}%. El detalle está en la tabla comparativa.`}
          className="flex min-w-[760px] flex-col gap-1.5"
        >
          {filas.map((f) => {
            const sel = f.moneda === seleccionada;
            return (
              <div key={f.moneda} className="flex items-center gap-2">
                <span
                  className={cn(
                    "w-12 shrink-0 font-mono text-[13px]",
                    sel ? "font-bold text-foreground" : "text-muted-foreground",
                  )}
                >
                  {f.moneda}
                </span>
                <div className={cn("flex flex-1 gap-1", !sel && "opacity-80")}>
                  {f.dias.map((d) => {
                    const fecha = `${mes}-${String(d.dia).padStart(2, "0")}`;
                    const clase = cn("h-[26px] flex-1 rounded", COLOR_CELDA[nivelCelda(d.sla)]);
                    if (!d.total) return <span key={d.dia} className={clase} />;
                    const etiqueta =
                      `${f.moneda} · ${format(new Date(`${fecha}T12:00:00`), "EEE d MMM", { locale: es })}: ` +
                      (d.sla == null
                        ? `sin retiros evaluables · ${formatEntero(d.total)} retiros`
                        : `SLA ${formatPct(d.sla)} · ${formatDecimal(d.tiempo ?? 0)} min · ${formatEntero(d.brechas)} brechas de ${formatEntero(d.total)} retiros`);
                    return (
                      <Link
                        key={d.dia}
                        href={`/auditoria-diaria?fecha=${fecha}&moneda=${f.moneda}`}
                        title={etiqueta}
                        aria-label={etiqueta}
                        className={cn(clase, "hover:outline-2 hover:-outline-offset-1 hover:outline-foreground focus-visible:outline-2 focus-visible:-outline-offset-1 focus-visible:outline-foreground")}
                      />
                    );
                  })}
                </div>
              </div>
            );
          })}
          <div className="flex items-center gap-2" aria-hidden>
            <span className="w-12 shrink-0" />
            <div className="flex flex-1 gap-1 font-mono text-[10px] text-muted-foreground">
              {Array.from({ length: diasDelMes }, (_, i) => (
                <span key={i} className="flex-1 text-center">
                  {EJE.includes(i + 1) ? i + 1 : ""}
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
