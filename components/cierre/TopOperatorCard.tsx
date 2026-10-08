import { Trophy } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatDecimal, formatEntero, formatPct } from "@/lib/format";
import { colorNota } from "@/lib/evaluacion";
import type { RankingFila } from "@/lib/cierre";
import { cardClass } from "@/components/dashboard/CardHeading";

export const ChipPreliminar = () => (
  <span className="rounded-full bg-warning-soft px-2 py-[2px] text-[11px] font-semibold text-warning-text">
    Preliminar
  </span>
);

function Mini({ label, valor, className }: { label: string; valor: string; className?: string }) {
  return (
    <div className="flex flex-col gap-0.5 rounded-[9px] bg-muted px-3 py-2">
      <span className="text-[11px] text-muted-foreground">{label}</span>
      <span className={cn("font-mono text-sm font-semibold", className)}>{valor}</span>
    </div>
  );
}

export function TopOperatorCard({
  ranking,
  cerrado,
  enCurso,
  className,
}: {
  ranking: RankingFila[];
  cerrado: boolean;
  enCurso: boolean;
  className?: string;
}) {
  const [primero, ...resto] = ranking;
  const titulo = cerrado
    ? "Operador del mes"
    : enCurso
      ? "Va primero este mes"
      : "Primero del ranking";

  // Empate en nota con el segundo, desempatado por SLA (o retiros).
  const empate =
    primero && resto[0] && resto[0].notaFinalPromedio === primero.notaFinalPromedio
      ? resto[0]
      : null;

  let procedencia = "";
  if (primero) {
    procedencia =
      primero.puestoAnterior === 1
        ? "repite el primer puesto"
        : primero.puestoAnterior
          ? `venía ${primero.puestoAnterior}.º el mes pasado`
          : "primer mes en el ranking";
  }

  return (
    <section className={cn(cardClass, "flex flex-col gap-4", className)}>
      <div className="flex items-center gap-2">
        <Trophy className="size-4 text-gold" />
        <h2 className="text-[15px] font-semibold">{titulo}</h2>
        {!cerrado && <ChipPreliminar />}
      </div>

      {!primero ? (
        <p className="py-8 text-center text-[13px] text-muted-foreground">
          Aún no hay evaluaciones en este mes.
        </p>
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-4">
            <span className="flex size-16 shrink-0 items-center justify-center rounded-full bg-brand-soft text-2xl font-bold text-brand shadow-[0_0_0_3px_var(--card),0_0_0_5px_var(--gold)]">
              {primero.operador.charAt(0).toUpperCase()}
            </span>
            <div className="flex min-w-0 flex-1 flex-col gap-0.5">
              <span className="truncate text-[22px] font-bold leading-tight">
                {primero.operador}
              </span>
              <span className="text-xs text-muted-foreground">
                {formatEntero(primero.diasTrabajados)} días trabajados · {procedencia}
              </span>
              {empate && (
                <span className="text-xs text-warning-text">
                  Empate en nota con {empate.operador}, desempatado por{" "}
                  {empate.slaPromedio === primero.slaPromedio ? "retiros" : "SLA"}
                </span>
              )}
            </div>
            <div className="flex flex-col items-end">
              <span
                className={cn(
                  "text-[36px] font-bold leading-none",
                  colorNota(primero.notaFinalPromedio),
                )}
              >
                {formatDecimal(primero.notaFinalPromedio, 2)}
              </span>
              <span className="text-xs text-muted-foreground">nota del mes</span>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <Mini label="SLA" valor={formatPct(primero.slaPromedio)} />
            <Mini label="Tiempo" valor={`${formatDecimal(primero.tiempoPromedio)} min`} />
            <Mini label="Retiros" valor={formatEntero(primero.totalRetiros)} />
            <Mini
              label="Incidencias"
              valor={formatEntero(primero.inconvenientes + primero.turnosIncompletos)}
              className={
                primero.inconvenientes + primero.turnosIncompletos > 0
                  ? "text-warning-text"
                  : undefined
              }
            />
          </div>

          {resto.length > 0 && (
            <ul className="flex flex-col gap-2 border-t border-border pt-3">
              {resto.slice(0, 2).map((f) => (
                <li key={f.operador} className="flex items-center gap-3 text-sm">
                  <span className="w-5 font-mono font-bold text-muted-foreground">
                    {f.puesto}
                  </span>
                  <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-semibold">
                    {f.operador.charAt(0).toUpperCase()}
                  </span>
                  <span className="min-w-0 flex-1 truncate font-medium">{f.operador}</span>
                  <span
                    className={cn("font-mono font-bold", colorNota(f.notaFinalPromedio))}
                  >
                    {formatDecimal(f.notaFinalPromedio, 2)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </section>
  );
}
