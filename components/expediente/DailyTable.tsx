import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { formatDecimal, formatEntero, formatPct } from "@/lib/format";
import { SLA_META_PCT } from "@/lib/constants";
import { colorNota } from "@/lib/evaluacion";
import type { DiaExpediente, ExpedienteData } from "@/lib/expediente";
import { cardClass } from "@/components/dashboard/CardHeading";
import { parseDiaStr } from "@/components/reportes/fechas";

export function TurnoChip({ d }: { d: DiaExpediente }) {
  const [label, clase] = !d.completoTurno
    ? ["Incompleto", "bg-danger-soft text-danger-text"]
    : d.tuvoInconveniente
      ? ["Inconveniente", "bg-warning-soft text-warning-text"]
      : ["Completo", "bg-success-soft text-success-text"];
  return (
    <span
      title={d.comentario.trim() || undefined}
      className={cn("rounded-full px-2 py-[2px] text-[11px] font-semibold", clase)}
    >
      {label}
    </span>
  );
}

export function DailyTable({
  data,
  interno,
}: {
  data: ExpedienteData;
  interno: boolean;
}) {
  return (
    <section className={cn(cardClass, "flex flex-col gap-3 p-0")}>
      <div className="flex flex-wrap items-baseline justify-between gap-2 px-[18px] pt-[18px]">
        <h2 className="text-[15px] font-semibold">Evaluaciones diarias</h2>
        <span className="text-xs text-muted-foreground">
          {formatEntero(data.dias.length)} días evaluados ·{" "}
          {data.pendientes ? `${data.pendientes} pendientes` : "todas confirmadas"}
        </span>
      </div>
      <div className="overflow-x-auto">
        <table className={cn("w-full text-[13px]", interno ? "min-w-[940px]" : "min-w-[820px]")}>
          <thead>
            <tr className="border-y border-border bg-muted text-left text-xs text-muted-foreground">
              <th className="px-[18px] py-2 font-medium">Fecha</th>
              <th className="px-3 py-2 text-right font-medium">Retiros</th>
              <th className="px-3 py-2 text-right font-medium">SLA</th>
              <th className="px-3 py-2 text-right font-medium">Tiempo</th>
              <th className="px-3 py-2 text-right font-medium">Puntual.</th>
              <th className="px-3 py-2 text-right font-medium">Proact.</th>
              <th className="px-3 py-2 font-medium">Turno</th>
              <th className={cn("py-2 text-right font-medium", interno ? "px-3" : "pl-3 pr-[18px]")}>
                Nota
              </th>
              {interno && <th className="px-[18px] py-2 text-center font-medium">Auditoría</th>}
            </tr>
          </thead>
          <tbody>
            {data.dias.map((d) => {
              const f = parseDiaStr(d.fecha);
              return (
                <tr key={d.fecha} className="h-[46px] border-b border-border last:border-b-0">
                  <td className="px-[18px]">
                    <span className="font-mono font-semibold">{format(f, "dd/MM")}</span>{" "}
                    <span className="text-muted-foreground">{format(f, "EEE", { locale: es })}</span>
                  </td>
                  <td className="px-3 text-right font-mono">{formatEntero(d.retiros)}</td>
                  <td className={cn("px-3 text-right font-mono", d.sla < SLA_META_PCT && "text-danger-text")}>
                    {formatPct(d.sla)}
                  </td>
                  <td className="whitespace-nowrap px-3 text-right font-mono">
                    {formatDecimal(d.tiempo)}
                    <span className="text-muted-foreground"> min</span>
                  </td>
                  <td className="px-3 text-right font-mono">{formatEntero(d.puntualidad)}</td>
                  <td className="px-3 text-right font-mono">{formatEntero(d.proactividad)}</td>
                  <td className="px-3">
                    <TurnoChip d={d} />
                  </td>
                  <td className={cn("text-right", interno ? "px-3" : "pl-3 pr-[18px]")}>
                    <span className="inline-flex items-center gap-1.5">
                      {d.estado === "Pendiente" && (
                        <span className="rounded-full bg-warning-soft px-1.5 py-[1px] text-[10px] font-semibold text-warning-text">
                          Pendiente
                        </span>
                      )}
                      <span
                        className={cn(
                          "font-mono font-bold",
                          d.estado === "Pendiente" ? "text-muted-foreground" : colorNota(d.nota),
                        )}
                      >
                        {formatDecimal(d.nota, 2)}
                      </span>
                    </span>
                  </td>
                  {interno && (
                    <td className="px-[18px] text-center">
                      <Link
                        href={`/auditoria-diaria?fecha=${d.fecha}&operador=${encodeURIComponent(data.operador)}`}
                        aria-label={`Auditoría del ${format(f, "d 'de' MMMM", { locale: es })}`}
                        className="inline-flex size-8 items-center justify-center rounded-lg border border-input text-muted-foreground hover:bg-accent hover:text-foreground"
                      >
                        <ArrowUpRight className="size-4" />
                      </Link>
                    </td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}
