import { Banknote, CircleCheck, Clock, Star } from "lucide-react";
import { formatDecimal, formatEntero, formatPct } from "@/lib/format";
import { colorNota } from "@/lib/evaluacion";
import { SLA_META_PCT } from "@/lib/constants";
import type { MetricasMes } from "@/lib/cierre";
import { KpiCard } from "@/components/dashboard/KpiCard";
import { TrendPill, calcTrend } from "@/components/dashboard/TrendPill";

export function MonthKpis({
  m,
  previo,
  nombreAnterior,
}: {
  m: MetricasMes;
  previo: MetricasMes | null;
  /** "agosto" */
  nombreAnterior: string;
}) {
  const vs = previo ? `vs ${nombreAnterior}` : "Sin datos del mes anterior";

  return (
    <div className="grid gap-3.5 [grid-template-columns:repeat(auto-fit,minmax(min(220px,100%),1fr))]">
      <KpiCard
        icon={Banknote}
        iconClassName="text-icon-blue"
        title="Retiros gestionados"
        value={formatEntero(m.totalOps)}
        trend={
          <TrendPill
            hidden={!previo}
            value={calcTrend(m.totalOps, previo?.totalOps ?? 0)}
            unit="%"
            goodWhen="up"
          />
        }
        footer={`Gestión manual · ${vs}`}
      />
      <KpiCard
        icon={CircleCheck}
        iconClassName="text-icon-green"
        title="SLA del mes"
        value={formatPct(m.slaGlobal)}
        valueClassName={m.slaGlobal < SLA_META_PCT ? "text-danger-text" : undefined}
        trend={
          <TrendPill
            hidden={!previo}
            value={m.slaGlobal - (previo?.slaGlobal ?? 0)}
            unit="pts"
            goodWhen="up"
          />
        }
        footer={`Sin Autopago ni exonerados · ${vs}`}
      />
      <KpiCard
        icon={Clock}
        iconClassName="text-icon-amber"
        title="Tiempo promedio"
        value={formatDecimal(m.tiempoGlobal)}
        unit="min"
        trend={
          <TrendPill
            hidden={!previo}
            value={m.tiempoGlobal - (previo?.tiempoGlobal ?? 0)}
            unit="min"
            goodWhen="down"
          />
        }
        footer={`Ponderado por retiros · ${vs}`}
      />
      <KpiCard
        icon={Star}
        iconClassName="text-icon-violet"
        title="Nota promedio del equipo"
        value={formatDecimal(m.notaPromedio, 2)}
        unit="/ 10"
        valueClassName={colorNota(m.notaPromedio)}
        trend={
          <TrendPill
            hidden={!previo}
            value={m.notaPromedio - (previo?.notaPromedio ?? 0)}
            unit=""
            decimals={2}
            goodWhen="up"
          />
        }
        footer={`${formatEntero(m.operadores)} operadores · ${vs}`}
      />
    </div>
  );
}
