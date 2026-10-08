import { format } from "date-fns";
import { es } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { formatDecimal, formatEntero, formatPct } from "@/lib/format";
import { SLA_META_PCT } from "@/lib/constants";
import { colorNota, fondoNota } from "@/lib/evaluacion";
import type { ExpedienteData } from "@/lib/expediente";
import { cardClass } from "@/components/dashboard/CardHeading";
import { parseDiaStr } from "@/components/reportes/fechas";

const diaCorto = (f: string) => format(parseDiaStr(f), "d MMM", { locale: es });

/** Diferencia contra el equipo: "+0,3 vs equipo". */
function VsEquipo({ diff }: { diff: number }) {
  if (Math.abs(diff) < 0.05)
    return <span className="text-xs text-muted-foreground">igual al equipo</span>;
  return (
    <span className={cn("text-xs font-medium", diff > 0 ? "text-success-text" : "text-danger-text")}>
      {diff > 0 ? "+" : "-"}
      {formatDecimal(Math.abs(diff))} vs equipo
    </span>
  );
}

export function ScoreBreakdown({ data, className }: { data: ExpedienteData; className?: string }) {
  const detalle: Record<string, string> = {
    sla: `SLA del mes ${formatPct(data.kpis.sla)}`,
    tiempo: `tiempo del mes ${formatDecimal(data.kpis.tiempo)} min`,
    puntualidad: "evaluación diaria",
    proactividad: "evaluación diaria",
  };
  return (
    <section className={cn(cardClass, "flex flex-col gap-4", className)}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-[15px] font-semibold">Desglose de la nota</h2>
        <div className="flex flex-wrap gap-3.5 text-xs text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <span className="size-2.5 rounded-sm bg-chart-in-sla" />
            {data.operador}
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-3 w-0.5 bg-foreground" />
            Promedio del equipo
          </span>
        </div>
      </div>

      <div className="flex flex-col gap-4">
        {data.desglose.map((c) => (
          <div key={c.key} className="flex flex-col gap-1.5">
            <div className="flex flex-wrap items-baseline justify-between gap-x-3">
              <span className="text-sm font-medium">
                {c.label} <span className="text-muted-foreground">· {Math.round(c.peso * 100)}%</span>
              </span>
              <span className="flex items-baseline gap-3">
                <span className="font-mono text-sm font-semibold">{formatDecimal(c.puntaje)} / 10</span>
                <VsEquipo diff={c.puntaje - c.equipo} />
              </span>
            </div>
            <div className="relative h-2.5 rounded-full bg-track">
              <span
                className="absolute inset-y-0 left-0 rounded-full bg-chart-in-sla"
                style={{ width: `${Math.min(100, c.puntaje * 10)}%` }}
              />
              <span
                title={`Equipo: ${formatDecimal(c.equipo)}`}
                className="absolute -inset-y-1 w-0.5 bg-foreground"
                style={{ left: `calc(${Math.min(100, c.equipo * 10)}% - 1px)` }}
              />
            </div>
            <span className="text-xs text-muted-foreground">
              Promedio del puntaje diario ({detalle[c.key]}) → aporta{" "}
              {formatDecimal(c.aporte, 2)} pts
            </span>
          </div>
        ))}
      </div>

      <div className="mt-auto flex flex-wrap items-center justify-between gap-2 border-t border-border pt-3">
        <span className="font-semibold">Nota del mes</span>
        <span className="flex items-baseline gap-2">
          <span className="font-mono text-xs text-muted-foreground">
            {data.desglose.map((c) => formatDecimal(c.aporte, 2)).join(" + ")} =
          </span>
          <span className={cn("text-[22px] font-bold", colorNota(data.kpis.nota))}>
            {formatDecimal(data.kpis.nota, 2)}
          </span>
        </span>
      </div>
    </section>
  );
}

export function SlaByCurrency({ data, className }: { data: ExpedienteData; className?: string }) {
  return (
    <section className={cn(cardClass, "flex flex-col gap-4", className)}>
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-[15px] font-semibold">SLA por moneda</h2>
        <span className="text-xs text-muted-foreground">meta {SLA_META_PCT}%</span>
      </div>
      {data.monedas.length === 0 ? (
        <p className="py-6 text-center text-[13px] text-muted-foreground">
          Sin retiros registrados en el mes.
        </p>
      ) : (
        <ul className="flex flex-col gap-3.5">
          {data.monedas.map((m) => (
            <li key={m.moneda} className="flex flex-col gap-1.5">
              <div className="flex items-center gap-2 text-[13px]">
                <span className="rounded-md bg-muted px-1.5 py-0.5 font-mono text-xs font-semibold">
                  {m.moneda}
                </span>
                <span className="text-muted-foreground">{formatEntero(m.retiros)} retiros</span>
                <span
                  className={cn(
                    "ml-auto font-mono font-semibold",
                    m.sla < SLA_META_PCT && "text-danger-text",
                  )}
                >
                  {formatPct(m.sla)}
                </span>
              </div>
              <div className="relative h-2 rounded-full bg-track">
                <span
                  className={cn(
                    "absolute inset-y-0 left-0 rounded-full",
                    m.sla >= SLA_META_PCT ? "bg-success" : "bg-danger",
                  )}
                  style={{ width: `${Math.min(100, m.sla)}%` }}
                />
                <span
                  className="absolute -inset-y-1 border-l border-dashed border-foreground/60"
                  style={{ left: `${SLA_META_PCT}%` }}
                />
              </div>
            </li>
          ))}
        </ul>
      )}
      <p className="mt-auto text-xs text-muted-foreground">
        Sin Autopago ni exonerados. La línea punteada marca el {SLA_META_PCT}%.
      </p>
    </section>
  );
}

export function DailyScores({ data, className }: { data: ExpedienteData; className?: string }) {
  const porDia = new Map(data.dias.map((d) => [d.fecha, d]));
  const dias = Array.from({ length: data.diasDelMes }, (_, i) => {
    const fecha = `${data.mes}-${String(i + 1).padStart(2, "0")}`;
    return { fecha, n: i + 1, d: porDia.get(fecha) ?? null };
  });
  const evaluados = data.dias;
  const mejor = evaluados.reduce<(typeof evaluados)[number] | null>(
    (a, b) => (!a || b.nota > a.nota ? b : a),
    null,
  );
  const peor = evaluados.reduce<(typeof evaluados)[number] | null>(
    (a, b) => (!a || b.nota < a.nota ? b : a),
    null,
  );
  const bajoEquipo = evaluados.filter((d) => d.nota < data.equipo.nota).length;
  const resumen = mejor
    ? `Mejor día: ${diaCorto(mejor.fecha)} (${formatDecimal(mejor.nota, 2)}) · Peor día: ${diaCorto(peor!.fecha)} (${formatDecimal(peor!.nota, 2)}) · ${bajoEquipo} de ${evaluados.length} días bajo el promedio del equipo`
    : "Sin evaluaciones en el mes";
  const ejes = new Set([1, 8, 15, 22, data.diasDelMes]);

  return (
    <section className={cn(cardClass, "flex flex-col gap-3", className)}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-[15px] font-semibold">Nota diaria</h2>
        <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
          <span className="flex items-center gap-1.5"><span className="size-2 rounded-full bg-success" />≥ 8</span>
          <span className="flex items-center gap-1.5"><span className="size-2 rounded-full bg-warning" />6–7,9</span>
          <span className="flex items-center gap-1.5"><span className="size-2 rounded-full bg-danger" />&lt; 6</span>
          <span className="flex items-center gap-1.5">
            <span className="w-3.5 border-t border-dashed border-foreground" />
            Promedio del equipo ({formatDecimal(data.equipo.nota, 2)})
          </span>
        </div>
      </div>

      <div role="img" aria-label={`Nota diaria de ${data.operador}. ${resumen}.`}>
        <div className="relative flex h-[150px] items-end gap-[3px] sm:gap-1">
          <span
            className="pointer-events-none absolute inset-x-0 border-t border-dashed border-foreground/70"
            style={{ bottom: `${data.equipo.nota * 10}%` }}
          />
          {dias.map(({ fecha, d }) => (
            <span
              key={fecha}
              title={
                d
                  ? `${diaCorto(fecha)}: nota ${formatDecimal(d.nota, 2)} · SLA ${formatPct(d.sla)} · ${formatDecimal(d.tiempo)} min`
                  : `${diaCorto(fecha)}: no trabajó`
              }
              className={cn(
                "min-w-0 flex-1 rounded-t-[3px]",
                d ? fondoNota(d.nota) : "bg-track",
                d?.estado === "Pendiente" && "opacity-60",
              )}
              style={{ height: d ? `${d.nota * 10}%` : "3%" }}
            />
          ))}
        </div>
        <div className="mt-1.5 flex gap-[3px] font-mono text-[11px] text-muted-foreground sm:gap-1">
          {dias.map(({ fecha, n }) => (
            <span key={fecha} className="min-w-0 flex-1 text-center">
              {ejes.has(n) ? n : ""}
            </span>
          ))}
        </div>
      </div>

      <p className="text-xs text-muted-foreground">
        {resumen}
        {mejor && " · barras grises = días libres"}
      </p>
    </section>
  );
}

export function MonthNotes({ data, className }: { data: ExpedienteData; className?: string }) {
  const items = data.dias.filter((d) => d.tuvoInconveniente || !d.completoTurno);
  return (
    <section className={cn(cardClass, "flex flex-col gap-3", className)}>
      <div className="flex items-center gap-2">
        <h2 className="text-[15px] font-semibold">Observaciones del mes</h2>
        <span className="rounded-full bg-muted px-2 py-[2px] font-mono text-xs">{items.length}</span>
      </div>
      {items.length === 0 ? (
        <p className="py-6 text-center text-[13px] text-muted-foreground">
          Sin inconvenientes ni turnos incompletos este mes.
        </p>
      ) : (
        <ul className="flex max-h-[260px] flex-col gap-2 overflow-y-auto">
          {items.map((d) => (
            <li key={d.fecha} className="flex flex-col gap-1 rounded-[9px] bg-muted px-3 py-2.5">
              <span className="flex flex-wrap items-center gap-2">
                <span className="font-mono text-xs font-semibold">
                  {format(parseDiaStr(d.fecha), "dd/MM")}
                </span>
                {d.tuvoInconveniente && (
                  <span className="rounded-full bg-warning-soft px-2 py-[1px] text-[11px] font-semibold text-warning-text">
                    Inconveniente
                  </span>
                )}
                {!d.completoTurno && (
                  <span className="rounded-full bg-danger-soft px-2 py-[1px] text-[11px] font-semibold text-danger-text">
                    Turno incompleto
                  </span>
                )}
              </span>
              <span className="text-[13px]">
                {d.comentario.trim() || (
                  <span className="text-muted-foreground">Sin comentario.</span>
                )}
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
