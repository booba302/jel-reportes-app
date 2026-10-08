import { CircleCheck, Clock, Globe, TriangleAlert } from "lucide-react";
import { cn } from "@/lib/utils";
import { SLA_META_PCT, TIEMPO_META_MIN } from "@/lib/constants";
import { formatDecimal, formatEntero, formatPct } from "@/lib/format";
import type { ModeloMonitor } from "@/lib/monitor";
import { KpiCard } from "@/components/dashboard/KpiCard";
import { TrendPill, calcTrend } from "@/components/dashboard/TrendPill";

/** Las 4 tarjetas resumen. `mesPrevio` es el nombre corto del mes anterior ("ago"). */
export function MonitorKpis({ m, mesPrevio }: { m: ModeloMonitor; mesPrevio: string }) {
  const p = m.previo;
  const sla = m.sla ?? 0;
  const tiempo = m.tiempo ?? 0;
  const pctAutopago = m.total.total ? (m.total.autopago / m.total.total) * 100 : 0;
  const difBajo = p ? m.bajoMeta.length - p.bajoMeta : null;

  return (
    <div className="grid gap-3.5 [grid-template-columns:repeat(auto-fit,minmax(min(230px,100%),1fr))]">
      <KpiCard
        icon={CircleCheck}
        iconClassName="text-icon-green"
        title="SLA regional"
        value={m.sla == null ? "—" : formatPct(sla)}
        valueClassName={m.sla != null && sla < SLA_META_PCT ? "text-danger-text" : undefined}
        trend={
          <TrendPill
            hidden={p?.sla == null || m.sla == null}
            value={sla - (p?.sla ?? 0)}
            unit="pts"
            goodWhen="up"
          />
        }
        footer={`Meta ${SLA_META_PCT}% · sin Autopago ni exonerados`}
      />
      <KpiCard
        icon={Clock}
        iconClassName="text-icon-amber"
        title="Tiempo promedio"
        value={m.tiempo == null ? "—" : formatDecimal(tiempo)}
        unit={m.tiempo == null ? undefined : "min"}
        valueClassName={tiempo > TIEMPO_META_MIN ? "text-danger-text" : undefined}
        trend={
          <TrendPill
            hidden={p?.tiempo == null || m.tiempo == null}
            value={tiempo - (p?.tiempo ?? 0)}
            unit="min"
            goodWhen="down"
          />
        }
        footer={`Meta ${TIEMPO_META_MIN} min · solo gestión manual`}
      />
      <KpiCard
        icon={Globe}
        iconClassName="text-icon-blue"
        title="Retiros del mes"
        value={formatEntero(m.total.total)}
        trend={
          <TrendPill
            hidden={!p}
            value={calcTrend(m.total.total, p?.total.total ?? 0)}
            unit="%"
            goodWhen="up"
          />
        }
        footer={`${formatPct(pctAutopago)} por Autopago · ${m.filas.length} ${m.filas.length === 1 ? "moneda" : "monedas"}`}
      />
      <KpiCard
        icon={TriangleAlert}
        iconClassName={m.bajoMeta.length ? "text-danger-text" : "text-icon-violet"}
        title="Monedas bajo meta"
        value={`${m.bajoMeta.length} de ${m.filas.length}`}
        valueClassName={m.bajoMeta.length ? "text-danger-text" : undefined}
        trend={
          difBajo != null && (
            <span
              className={cn(
                "shrink-0 whitespace-nowrap rounded-full px-2 py-[3px] text-xs font-semibold",
                difBajo === 0
                  ? "bg-muted text-muted-foreground"
                  : difBajo > 0
                    ? "bg-danger-soft text-danger-text"
                    : "bg-success-soft text-success-text",
              )}
            >
              {difBajo === 0
                ? `igual que ${mesPrevio}`
                : `${difBajo > 0 ? "+" : "-"}${Math.abs(difBajo)} vs ${mesPrevio}`}
            </span>
          )
        }
        footer={
          m.bajoMeta.length
            ? `${m.bajoMeta.join(" · ")} · SLA < ${SLA_META_PCT}% o tiempo > ${TIEMPO_META_MIN} min`
            : "Todas las monedas cumplen SLA y tiempo"
        }
      />
    </div>
  );
}
